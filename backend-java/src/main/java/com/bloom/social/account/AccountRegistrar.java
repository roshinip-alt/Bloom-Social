package com.bloom.social.account;

import com.bloom.exception.BloomException;
import com.bloom.common.persistence.Ids;
import com.bloom.social.connect.ConnectDtos.Identity;
import com.bloom.social.domain.Capability;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectedSocialAccountRepository;
import com.bloom.social.domain.ConnectionStatus;
import com.bloom.social.domain.DataMode;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.TokenSet;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/** Creates or reconnects a LIVE account from a provider identity and stores its encrypted credential. */
@Component
public class AccountRegistrar {
    private final ConnectedSocialAccountRepository accounts;
    private final CredentialStore credentials;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AccountRegistrar(ConnectedSocialAccountRepository accounts, CredentialStore credentials,
                            ApplicationEventPublisher events, Clock clock) {
        this.accounts = accounts;
        this.credentials = credentials;
        this.events = events;
        this.clock = clock;
    }

    public ConnectedSocialAccount registerLive(UUID workspaceId, Provider provider, Identity identity, TokenSet tokens,
                                               List<String> capabilities) {
        Instant now = clock.instant();
        ConnectedSocialAccount account = accounts.findByProviderAndProviderAccountId(provider, identity.providerAccountId())
                .map(existing -> {
                    if (!existing.getWorkspaceId().equals(workspaceId)) {
                        throw BloomException.conflict("ACCOUNT_IN_OTHER_WORKSPACE",
                                "This account is already connected to another workspace");
                    }
                    if (existing.isDemo()) {
                        throw BloomException.conflict("IDENTITY_IS_DEMO", "A demo account uses this identifier");
                    }
                    return existing;
                })
                .orElseGet(() -> new ConnectedSocialAccount(Ids.newId(), workspaceId, provider,
                        identity.providerAccountId(), DataMode.LIVE));
        account.setHandle(identity.handle());
        account.setDisplayName(identity.displayName());
        account.setAvatarUrl(identity.avatarUrl());
        account.setAccountType(identity.accountType());
        account.setConnectionStatus(ConnectionStatus.ACTIVE);
        account.setConnectedAt(now);
        account.setDisconnectedAt(null);
        account.setLastSyncError(null);
        account.setGrantedScopes(new ArrayList<>(tokens.scopes() == null ? List.of() : tokens.scopes()));
        account.setCapabilitySet(parseCapabilities(capabilities));
        accounts.save(account);
        credentials.save(account.getId(), tokens, now);
        events.publishEvent(new AccountConnectedEvent(account.getId()));
        return account;
    }

    static Set<Capability> parseCapabilities(List<String> raw) {
        Set<Capability> set = EnumSet.noneOf(Capability.class);
        if (raw != null) {
            for (String r : raw) {
                try {
                    set.add(Capability.valueOf(r));
                } catch (IllegalArgumentException ignored) {
                    // unknown capability from a newer integration service: ignore rather than fail
                }
            }
        }
        set.remove(Capability.PUBLISHING); // publishing is off in V1 regardless of provider support
        return set;
    }
}
