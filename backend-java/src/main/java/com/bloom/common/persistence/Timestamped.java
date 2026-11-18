package com.bloom.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import org.springframework.data.domain.Persistable;

/**
 * created_at / updated_at maintained by JPA callbacks (UTC instants).
 *
 * <p>Ids are assigned by the application, so Spring Data cannot infer "new" from a null id. Implementing
 * {@link Persistable} makes {@code save()} call {@code persist} for new entities instead of {@code merge}; the
 * caller's instance then stays managed and later changes to it are flushed.</p>
 */
@Getter
@MappedSuperclass
public abstract class Timestamped implements Persistable<UUID> {
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Transient
    private boolean persisted;

    @Override
    @Transient
    public boolean isNew() {
        return !persisted;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PostPersist
    @PostLoad
    void markPersisted() {
        persisted = true;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
