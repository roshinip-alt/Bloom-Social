package com.bloom.social.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

public interface OAuthConnectSessionRepository extends JpaRepository<OAuthConnectSession, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<OAuthConnectSession> findByStateHash(String stateHash);

    Optional<OAuthConnectSession> findByIdAndWorkspaceId(UUID id, UUID workspaceId);
}
