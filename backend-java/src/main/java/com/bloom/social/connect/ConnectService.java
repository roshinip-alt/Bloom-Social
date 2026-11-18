package com.bloom.social.connect;

import com.bloom.config.BloomProperties;
import com.bloom.common.crypto.Hashing;
import com.bloom.common.crypto.TokenCipher;
import com.bloom.exception.BloomException;
import com.bloom.common.persistence.Ids;
import com.bloom.social.account.AccountRegistrar;
import com.bloom.social.connect.ConnectDtos.*;
import com.bloom.social.domain.ConnectSessionStatus;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.OAuthConnectSession;
import com.bloom.social.domain.OAuthConnectSessionRepository;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.AuthorizeUrlRequest;
import com.bloom.social.gateway.GatewayDtos.TokenSet;
import com.bloom.social.gateway.GatewayException;
import com.bloom.social.gateway.IntegrationGateway;
import com.bloom.auth.CurrentWorkspace;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * OAuth connection orchestration. Security properties:
 * <ul>
 *   <li>state = 256-bit random, only its SHA-256 is stored; single use (verifier is consumed on resolve).</li>
 *   <li>PKCE S256 verifier generated per session, encrypted at rest.</li>
 *   <li>Session expires after {@code bloom.oauth.session-ttl}.</li>
 *   <li>Redirect URI is fixed per provider from APP_PUBLIC_URL (exact match at the provider).</li>
 * </ul>
 */
@Service
public class ConnectService {
    private static final Logger log = LoggerFactory.getLogger(ConnectService.class);
    private final OAuthConnectSessionRepository sessions;
    private final IntegrationGateway gateway;
    private final TokenCipher cipher;
    private final AccountRegistrar registrar;
    private final CurrentWorkspace workspace;
    private final BloomProperties props;
    private final ObjectMapper mapper;
    private final Clock clock;

    public ConnectService(OAuthConnectSessionRepository sessions, IntegrationGateway gateway, TokenCipher cipher,
                          AccountRegistrar registrar, CurrentWorkspace workspace, BloomProperties props,
                          ObjectMapper mapper, Clock clock) {
        this.sessions = sessions;
        this.gateway = gateway;
        this.cipher = cipher;
        this.registrar = registrar;
        this.workspace = workspace;
        this.props = props;
        this.mapper = mapper;
        this.clock = clock;
    }

    public String redirectUri(Provider provider) {
        String base = props.publicUrl().endsWith("/") ? props.publicUrl().substring(0, props.publicUrl().length() - 1) : props.publicUrl();
        return base + "/oauth/" + provider.slug() + "/callback";
    }

    @Transactional
    public StartResponse start(Provider provider) {
        if (workspace.isDemo()) {
            throw BloomException.conflict("DEMO_WORKSPACE",
                    "The demo workspace only holds synthetic data. Switch to “My workspace” to connect a real account.");
        }
        if (!cipher.isConfigured()) {
            throw BloomException.unavailable("ENCRYPTION_NOT_CONFIGURED",
                    "TOKEN_ENCRYPTION_KEY is not set, so tokens could not be stored safely. Live connections are disabled.");
        }
        if (!props.integration().hasInternalToken()) {
            throw BloomException.unavailable("INTEGRATION_NOT_CONFIGURED", "INTERNAL_API_TOKEN is not set.");
        }
        Instant now = clock.instant();
        String state = Hashing.randomUrlToken(32);
        String verifier = Hashing.randomUrlToken(48);
        OAuthConnectSession s = new OAuthConnectSession(Ids.newId(), workspace.id(), provider, Hashing.sha256Hex(state),
                redirectUri(provider), now, now.plus(props.oauth().sessionTtl()));
        s.setCodeVerifierCiphertext(cipher.encrypt(verifier));
        String url;
        try {
            url = gateway.authorizeUrl(provider, new AuthorizeUrlRequest(state, Hashing.pkceChallenge(verifier), s.getRedirectUri()))
                    .authorizationUrl();
        } catch (GatewayException e) {
            if (e.category() == GatewayException.Category.NOT_CONFIGURED) {
                throw BloomException.unavailable("PROVIDER_NOT_CONFIGURED", e.getMessage());
            }
            throw BloomException.unavailable("INTEGRATION_UNAVAILABLE", "The integration service could not start the connection.");
        }
        sessions.save(s);
        return new StartResponse(s.getId(), url, s.getExpiresAt());
    }

    @Transactional
    public SessionView view(UUID sessionId) {
        OAuthConnectSession s = owned(sessionId);
        expireIfNeeded(s);
        return toView(s);
    }

    @Transactional
    public SessionView select(UUID sessionId, SelectRequest req) {
        OAuthConnectSession s = owned(sessionId);
        expireIfNeeded(s);
        if (s.getStatus() != ConnectSessionStatus.AWAITING_SELECTION) {
            throw BloomException.conflict("SESSION_NOT_AWAITING_SELECTION", "This connection is not waiting for an account choice");
        }
        Set<String> wanted = new HashSet<>(req.providerAccountIds());
        PendingTokens pending = readPending(s);
        List<UUID> created = new ArrayList<>();
        for (Identity identity : pending.identities()) {
            if (wanted.contains(identity.providerAccountId())) {
                if (!identity.eligible()) {
                    throw BloomException.unprocessable("IDENTITY_NOT_ELIGIBLE",
                            identity.ineligibleReason() == null ? "That account cannot be connected" : identity.ineligibleReason());
                }
                created.add(registrar.registerLive(s.getWorkspaceId(), s.getProvider(), identity, pending.tokens(),
                        pending.capabilities()).getId());
            }
        }
        if (created.isEmpty()) {
            throw BloomException.badRequest("NO_MATCHING_IDENTITY", "None of the selected accounts belong to this connection");
        }
        s.setConnectedAccountIds(created);
        s.setStatus(ConnectSessionStatus.COMPLETED);
        s.setCompletedAt(clock.instant());
        s.setTokenSetCiphertext(null);
        return toView(s);
    }

    @Transactional
    public SessionView cancel(UUID sessionId) {
        OAuthConnectSession s = owned(sessionId);
        if (s.getStatus() == ConnectSessionStatus.PENDING || s.getStatus() == ConnectSessionStatus.AWAITING_SELECTION) {
            s.setStatus(ConnectSessionStatus.CANCELLED);
            s.setCompletedAt(clock.instant());
            s.setTokenSetCiphertext(null);
            s.setCodeVerifierCiphertext(null);
        }
        return toView(s);
    }

    // ------------------------------------------------------------------ internal (called by Node)

    /** Validates the callback state. Single use: the PKCE verifier is consumed here. */
    @Transactional
    public ResolveResponse resolve(ResolveRequest req) {
        Provider provider = Provider.fromSlug(req.provider());
        OAuthConnectSession s = sessions.findByStateHash(Hashing.sha256Hex(req.state()))
                .orElseThrow(() -> new BloomException(HttpStatus.BAD_REQUEST, "STATE_INVALID", "Unknown or tampered state"));
        if (s.getProvider() != provider) {
            throw new BloomException(HttpStatus.BAD_REQUEST, "STATE_PROVIDER_MISMATCH", "State was issued for another provider");
        }
        if (expireIfNeeded(s)) {
            throw new BloomException(HttpStatus.GONE, "STATE_EXPIRED", "The connection attempt expired; start again");
        }
        if (s.getStatus() != ConnectSessionStatus.PENDING || s.getCodeVerifierCiphertext() == null) {
            throw new BloomException(HttpStatus.CONFLICT, "STATE_ALREADY_USED", "This connection attempt was already used");
        }
        String verifier = cipher.decrypt(s.getCodeVerifierCiphertext());
        s.setCodeVerifierCiphertext(null);
        return new ResolveResponse(s.getId(), verifier, s.getRedirectUri());
    }

    @Transactional
    public CompleteResponse complete(UUID sessionId, CompleteRequest req) {
        OAuthConnectSession s = sessions.findById(sessionId).orElseThrow(() -> BloomException.notFound("Connection"));
        if (s.getStatus() != ConnectSessionStatus.PENDING || s.getCodeVerifierCiphertext() != null) {
            throw BloomException.conflict("SESSION_NOT_RESOLVED", "Session must be resolved and pending to complete");
        }
        Instant now = clock.instant();
        s.setCandidates(req.identities().stream().map(Identity::toCandidate).toList());
        List<Identity> eligible = req.identities().stream().filter(Identity::eligible).toList();
        if (eligible.isEmpty()) {
            String reason = req.identities().stream().map(Identity::ineligibleReason).filter(r -> r != null).findFirst()
                    .orElse("The provider returned no account that Bloom can connect.");
            s.fail("NO_ELIGIBLE_ACCOUNT", reason, now);
        } else if (req.identities().size() == 1) {
            ConnectedSocialAccount a = registrar.registerLive(s.getWorkspaceId(), s.getProvider(), eligible.get(0),
                    req.tokens(), req.capabilities());
            s.setConnectedAccountIds(List.of(a.getId()));
            s.setStatus(ConnectSessionStatus.COMPLETED);
            s.setCompletedAt(now);
        } else {
            s.setTokenSetCiphertext(cipher.encrypt(writePending(new PendingTokens(req.tokens(), req.identities(), req.capabilities()))));
            s.setStatus(ConnectSessionStatus.AWAITING_SELECTION);
        }
        log.info("OAuth session {} for {} -> {}", s.getId(), s.getProvider(), s.getStatus());
        return new CompleteResponse(s.getId(), s.getStatus(), returnPath(s));
    }

    @Transactional
    public CompleteResponse failByState(FailRequest req) {
        OAuthConnectSession s = sessions.findByStateHash(Hashing.sha256Hex(req.state()))
                .orElseThrow(() -> new BloomException(HttpStatus.BAD_REQUEST, "STATE_INVALID", "Unknown or tampered state"));
        return failSession(s, req.errorCode(), req.errorMessage());
    }

    @Transactional
    public CompleteResponse failById(UUID sessionId, String code, String message) {
        OAuthConnectSession s = sessions.findById(sessionId).orElseThrow(() -> BloomException.notFound("Connection"));
        return failSession(s, code, message);
    }

    private CompleteResponse failSession(OAuthConnectSession s, String code, String message) {
        if (s.getStatus() == ConnectSessionStatus.PENDING) {
            s.fail(code, message == null ? "The provider did not complete the connection." : truncate(message), clock.instant());
        }
        return new CompleteResponse(s.getId(), s.getStatus(), returnPath(s));
    }

    // ------------------------------------------------------------------ helpers

    public static String returnPath(OAuthConnectSession s) {
        return "/settings/connected-accounts?session=" + s.getId();
    }

    private OAuthConnectSession owned(UUID id) {
        return sessions.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Connection"));
    }

    private boolean expireIfNeeded(OAuthConnectSession s) {
        boolean open = s.getStatus() == ConnectSessionStatus.PENDING || s.getStatus() == ConnectSessionStatus.AWAITING_SELECTION;
        if (open && s.isExpired(clock.instant())) {
            s.setStatus(ConnectSessionStatus.EXPIRED);
            s.setTokenSetCiphertext(null);
            s.setCodeVerifierCiphertext(null);
            s.setErrorCode("SESSION_EXPIRED");
            s.setErrorMessage("The connection attempt expired. Start again from Connected Accounts.");
            return true;
        }
        return s.getStatus() == ConnectSessionStatus.EXPIRED;
    }

    private static SessionView toView(OAuthConnectSession s) {
        return new SessionView(s.getId(), s.getProvider().name(), s.getStatus(), s.getCandidates(), s.getConnectedAccountIds(),
                s.getErrorCode(), s.getErrorMessage(), s.getCreatedAt(), s.getExpiresAt());
    }

    private static String truncate(String m) {
        return m.length() > 500 ? m.substring(0, 500) : m;
    }

    record PendingTokens(TokenSet tokens, List<Identity> identities, List<String> capabilities) {}

    private String writePending(PendingTokens p) {
        try {
            return mapper.writeValueAsString(p);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private PendingTokens readPending(OAuthConnectSession s) {
        if (s.getTokenSetCiphertext() == null) {
            throw BloomException.conflict("SESSION_TOKENS_MISSING", "This connection can no longer be completed; start again");
        }
        try {
            return mapper.readValue(cipher.decrypt(s.getTokenSetCiphertext()), PendingTokens.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
