package com.bloom.social.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConnectedSocialAccountRepository extends JpaRepository<ConnectedSocialAccount, UUID> {
    List<ConnectedSocialAccount> findByWorkspaceIdOrderByProviderAscCreatedAtAsc(UUID workspaceId);

    Optional<ConnectedSocialAccount> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    Optional<ConnectedSocialAccount> findByProviderAndProviderAccountId(Provider provider, String providerAccountId);

    List<ConnectedSocialAccount> findByDataModeAndConnectionStatusIn(DataMode mode, Collection<ConnectionStatus> statuses);

    List<ConnectedSocialAccount> findByWorkspaceIdAndDataMode(UUID workspaceId, DataMode mode);
}
