package com.bloom.social.account;

import com.bloom.exception.BloomException;
import com.bloom.social.account.AccountDtos.*;
import com.bloom.social.connect.ConnectService;
import com.bloom.social.domain.*;
import com.bloom.social.gateway.GatewayDtos.ProviderStatus;
import com.bloom.social.gateway.GatewayDtos.RevokeRequest;
import com.bloom.social.gateway.GatewayDtos.RevokeResponse;
import com.bloom.social.gateway.GatewayException;
import com.bloom.social.gateway.IntegrationGateway;
import com.bloom.social.sync.SyncService;
import com.bloom.auth.CurrentWorkspace;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {
    private static final Logger log = LoggerFactory.getLogger(AccountService.class);
    private final ConnectedSocialAccountRepository accounts;
    private final SyncJobRepository jobs;
    private final CredentialStore credentials;
    private final IntegrationGateway gateway;
    private final ProviderCatalog catalog;
    private final ConnectService connect;
    private final DemoAccountFactory demoFactory;
    private final SyncService sync;
    private final CurrentWorkspace workspace;
    private final Clock clock;

    public AccountService(ConnectedSocialAccountRepository accounts, SyncJobRepository jobs, CredentialStore credentials,
                          IntegrationGateway gateway, ProviderCatalog catalog, ConnectService connect,
                          DemoAccountFactory demoFactory, SyncService sync, CurrentWorkspace workspace, Clock clock) {
        this.accounts = accounts;
        this.jobs = jobs;
        this.credentials = credentials;
        this.gateway = gateway;
        this.catalog = catalog;
        this.connect = connect;
        this.demoFactory = demoFactory;
        this.sync = sync;
        this.workspace = workspace;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AccountView> list() {
        return accounts.findByWorkspaceIdOrderByProviderAscCreatedAtAsc(workspace.id()).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public AccountView get(UUID id) {
        return view(owned(id));
    }

    @Transactional(readOnly = true)
    public List<SyncJobView> jobs(UUID id, int limit) {
        owned(id);
        return jobs.findByAccountIdOrderByCreatedAtDesc(id, PageRequest.of(0, Math.min(Math.max(limit, 1), 100)))
                .stream().map(SyncJobView::of).toList();
    }

    public SyncJobView requestSync(UUID id) {
        owned(id);
        return SyncJobView.of(sync.request(id, SyncJob.Trigger.MANUAL));
    }

    public AccountView createDemo(Provider provider) {
        if (!workspace.isDemo()) {
            throw BloomException.conflict("NOT_DEMO_WORKSPACE",
                    "Demo accounts can only be added to the demo workspace, so synthetic data never mixes with live data.");
        }
        ConnectedSocialAccount a = demoFactory.create(workspace.id(), provider, null, null);
        sync.request(a.getId(), SyncJob.Trigger.CONNECT);
        return get(a.getId());
    }

    @Transactional
    public DisconnectResult disconnect(UUID id, boolean deleteHistory) {
        ConnectedSocialAccount a = owned(id);
        Revocation revocation = Revocation.NOT_APPLICABLE;
        String note;
        if (a.isDemo()) {
            note = "Demo account — no provider credentials existed.";
        } else {
            RevokeOutcome r = revoke(a);
            revocation = r.revocation();
            note = r.note();
            credentials.delete(a.getId());
        }
        if (deleteHistory) {
            accounts.delete(a);
            return new DisconnectResult(id, revocation, note + " The account and all its stored snapshots were deleted.", false);
        }
        a.setConnectionStatus(ConnectionStatus.DISCONNECTED);
        a.setDisconnectedAt(clock.instant());
        a.setLastSyncError(null);
        return new DisconnectResult(id, revocation,
                note + " Historical snapshots remain visible and labelled as from a disconnected account.", true);
    }

    @Transactional
    public void delete(UUID id) {
        ConnectedSocialAccount a = owned(id);
        if (!a.isDemo() && a.getConnectionStatus() != ConnectionStatus.DISCONNECTED) {
            throw BloomException.conflict("DISCONNECT_FIRST", "Disconnect the account before deleting it");
        }
        credentials.delete(a.getId());
        accounts.delete(a);
    }

    /** Provider-initiated deauthorization (webhook). Returns whether a matching account existed. */
    @Transactional
    public boolean markDeauthorized(Provider provider, String providerAccountId) {
        return accounts.findByProviderAndProviderAccountId(provider, providerAccountId).map(a -> {
            credentials.delete(a.getId());
            a.setConnectionStatus(ConnectionStatus.REVOKED);
            a.setLastSyncError("Access was removed at " + provider.name().charAt(0)
                    + provider.name().substring(1).toLowerCase() + ". Reconnect to resume syncing.");
            log.info("Account {} deauthorized by provider webhook", a.getId());
            return true;
        }).orElse(false);
    }

    /** Provider-initiated data deletion request (webhook): removes the account and all stored snapshots. */
    @Transactional
    public boolean deleteForProviderRequest(Provider provider, String providerAccountId) {
        return accounts.findByProviderAndProviderAccountId(provider, providerAccountId).map(a -> {
            credentials.delete(a.getId());
            accounts.delete(a);
            log.info("Account {} deleted on provider data-deletion request", a.getId());
            return true;
        }).orElse(false);
    }

    public List<ProviderView> providers() {
        Map<String, ProviderStatus> live;
        boolean reachable;
        try {
            live = gateway.providers().providers().stream()
                    .collect(Collectors.toMap(p -> p.provider().toUpperCase(), Function.identity()));
            reachable = true;
        } catch (GatewayException e) {
            live = Map.of();
            reachable = false;
        }
        final Map<String, ProviderStatus> status = live;
        final boolean ok = reachable;
        return catalog.all().stream().map(d -> {
            ProviderStatus s = status.get(d.provider().name());
            return new ProviderView(d.provider().name(), d.displayName(), d.apiFamily(), d.docsPath(),
                    s != null && s.scopes() != null && !s.scopes().isEmpty() ? s.scopes() : d.requestedScopes(),
                    d.supportedCapabilities().stream().map(Enum::name).sorted().toList(), d.dataAccessed(),
                    d.notAvailable(), d.prerequisites(), d.accessExplanation(), d.docsVerified(),
                    s != null && s.configured(), ok,
                    s == null ? List.of() : Optional.ofNullable(s.missingConfig()).orElse(List.of()),
                    connect.redirectUri(d.provider()), workspace.isDemo());
        }).toList();
    }

    // ---------------------------------------------------------------- helpers

    private record RevokeOutcome(Revocation revocation, String note) {}

    private RevokeOutcome revoke(ConnectedSocialAccount a) {
        Optional<CredentialStore.Plain> cred;
        try {
            cred = credentials.load(a.getId());
        } catch (RuntimeException e) {
            return new RevokeOutcome(Revocation.FAILED, "Stored credentials could not be read, so they were deleted without provider revocation.");
        }
        if (cred.isEmpty()) {
            return new RevokeOutcome(Revocation.NOT_APPLICABLE, "No stored credentials.");
        }
        try {
            RevokeResponse r = gateway.revoke(a.getProvider(), new RevokeRequest(cred.get().accessToken(), cred.get().refreshToken()));
            if (!r.supported()) {
                return new RevokeOutcome(Revocation.NOT_SUPPORTED, r.note() != null ? r.note()
                        : "This provider has no revocation API; remove Bloom from the app's connected-apps settings.");
            }
            return r.revoked() ? new RevokeOutcome(Revocation.REVOKED, "Access was revoked at the provider.")
                    : new RevokeOutcome(Revocation.FAILED, "The provider did not confirm revocation; remove Bloom from its connected-apps settings.");
        } catch (GatewayException e) {
            log.warn("Revocation failed for account {}: {}", a.getId(), e.code());
            return new RevokeOutcome(Revocation.FAILED,
                    "Bloom could not reach the provider to revoke access; stored credentials were deleted anyway.");
        }
    }

    private ConnectedSocialAccount owned(UUID id) {
        return accounts.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Account"));
    }

    private AccountView view(ConnectedSocialAccount a) {
        SyncJobView latest = jobs.findFirstByAccountIdOrderByCreatedAtDesc(a.getId()).map(SyncJobView::of).orElse(null);
        return new AccountView(a.getId(), a.getProvider().name(), a.getProviderAccountId(), a.getHandle(),
                a.getDisplayName(), a.getAvatarUrl(), a.getAccountType(), a.getDataMode(), a.getConnectionStatus(),
                a.getConnectionStatus().needsReconnect(), List.copyOf(a.getGrantedScopes()), List.copyOf(a.getCapabilities()),
                a.getLastSyncAt(), a.getLastSuccessfulSyncAt(), a.getLastSyncError(), a.getConnectedAt(),
                a.getDisconnectedAt(), a.isDemo() ? null : credentials.accessExpiry(a.getId()).orElse(null), latest);
    }
}
