package com.bloom.social.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProviderTokenCredentialRepository extends JpaRepository<ProviderTokenCredential, UUID> {
    Optional<ProviderTokenCredential> findByAccountId(UUID accountId);

    void deleteByAccountId(UUID accountId);
}
