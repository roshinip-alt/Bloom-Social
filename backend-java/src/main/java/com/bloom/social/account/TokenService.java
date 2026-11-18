package com.bloom.social.account;

import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectionStatus;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.RefreshRequest;
import com.bloom.social.gateway.GatewayDtos.TokenSet;
import com.bloom.social.gateway.GatewayException;
import com.bloom.social.gateway.IntegrationGateway;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Supplies a usable access token, refreshing when close to expiry. Instagram long-lived tokens are refreshed
 * (≥24 h old, before expiry) inside a 7-day window; OAuth refresh-token providers 5 minutes before expiry.
 * invalid_grant / revoked → account EXPIRED; the owner must reconnect (no retry loop).
 */
@Service
public class TokenService {
    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private final CredentialStore store;
    private final IntegrationGateway gateway;
    private final Clock clock;

    public TokenService(CredentialStore store, IntegrationGateway gateway, Clock clock) {
        this.store = store;
        this.gateway = gateway;
        this.clock = clock;
    }

    public CredentialStore.Plain usableCredential(ConnectedSocialAccount account) {
        CredentialStore.Plain cred = store.load(account.getId()).orElseThrow(() -> new GatewayException(
                GatewayException.Category.AUTH_INVALID, "CREDENTIAL_MISSING", "No stored credential; reconnect the account", null));
        Instant now = clock.instant();
        if (cred.accessExpiresAt() != null && !cred.accessExpiresAt().isAfter(now) && !canRefresh(account.getProvider(), cred)) {
            throw new GatewayException(GatewayException.Category.AUTH_INVALID, "TOKEN_EXPIRED",
                    "The access token has expired; reconnect the account", null);
        }
        if (needsRefresh(account.getProvider(), cred, now) && canRefresh(account.getProvider(), cred)) {
            TokenSet fresh = gateway.refresh(account.getProvider(), new RefreshRequest(cred.accessToken(), cred.refreshToken()));
            store.save(account.getId(), fresh, now);
            log.info("Refreshed provider token for account {}", account.getId());
            return store.load(account.getId()).orElseThrow();
        }
        return cred;
    }

    static Duration refreshWindow(Provider p) {
        return p == Provider.INSTAGRAM ? Duration.ofDays(7) : Duration.ofMinutes(5);
    }

    static boolean needsRefresh(Provider p, CredentialStore.Plain cred, Instant now) {
        return cred.accessExpiresAt() != null && cred.accessExpiresAt().minus(refreshWindow(p)).isBefore(now);
    }

    private static boolean canRefresh(Provider p, CredentialStore.Plain cred) {
        if (p == Provider.INSTAGRAM) return true; // long-lived token refreshes itself while unexpired
        return cred.refreshToken() != null
                && (cred.refreshExpiresAt() == null || cred.refreshExpiresAt().isAfter(Instant.now()));
    }

    public static ConnectionStatus statusFor(GatewayException.Category c) {
        return switch (c) {
            case AUTH_INVALID -> ConnectionStatus.EXPIRED;
            case PERMISSION -> ConnectionStatus.PERMISSION_DENIED;
            default -> ConnectionStatus.ERROR;
        };
    }
}
