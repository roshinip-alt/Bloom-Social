package com.bloom.analytics;

import com.bloom.exception.BloomException;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectedSocialAccountRepository;
import com.bloom.auth.CurrentWorkspace;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Resolves which of the current workspace's accounts a read covers; rejects foreign ids. */
@Component
public class AccountScope {
    private final ConnectedSocialAccountRepository accounts;
    private final CurrentWorkspace workspace;

    public AccountScope(ConnectedSocialAccountRepository accounts, CurrentWorkspace workspace) {
        this.accounts = accounts;
        this.workspace = workspace;
    }

    public List<ConnectedSocialAccount> resolve(Collection<UUID> requested, String provider) {
        List<ConnectedSocialAccount> all = accounts.findByWorkspaceIdOrderByProviderAscCreatedAtAsc(workspace.id());
        if (requested != null && !requested.isEmpty()) {
            Set<UUID> want = new HashSet<>(requested);
            List<ConnectedSocialAccount> chosen = all.stream().filter(a -> want.contains(a.getId())).toList();
            if (chosen.size() != want.size()) throw BloomException.notFound("Account");
            all = chosen;
        }
        if (provider != null && !provider.isBlank()) {
            all = all.stream().filter(a -> a.getProvider().name().equalsIgnoreCase(provider)).toList();
        }
        return all;
    }

    public ConnectedSocialAccount one(UUID id) {
        return resolve(List.of(id), null).get(0);
    }

    public static AnalyticsDtos.AccountRef ref(ConnectedSocialAccount a) {
        return new AnalyticsDtos.AccountRef(a.getId(), a.getProvider().name(), a.getHandle(), a.getDisplayName(),
                a.getAvatarUrl(), a.getDataMode().name(), a.getConnectionStatus().name(), a.getLastSuccessfulSyncAt());
    }
}
