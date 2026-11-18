package com.bloom.social.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SyncJobRepository extends JpaRepository<SyncJob, UUID> {
    List<SyncJob> findByAccountIdOrderByCreatedAtDesc(UUID accountId, Pageable pageable);

    Optional<SyncJob> findFirstByAccountIdOrderByCreatedAtDesc(UUID accountId);

    boolean existsByAccountIdAndStatusIn(UUID accountId, Collection<SyncJob.Status> statuses);

    List<SyncJob> findByStatusAndNextRetryAtBefore(SyncJob.Status status, Instant now);
}
