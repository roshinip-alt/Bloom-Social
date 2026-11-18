package com.bloom.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sync_job")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SyncJob {
    public enum Trigger { MANUAL, SCHEDULED, CONNECT }
    public enum Status { QUEUED, RUNNING, SUCCEEDED, PARTIAL, FAILED }

    @Id
    private UUID id;
    @Column(name = "account_id")
    private UUID accountId;
    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type")
    private Trigger triggerType;
    @Enumerated(EnumType.STRING)
    private Status status;
    private int attempt;
    @Column(name = "items_fetched")
    private int itemsFetched;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cursor_state", columnDefinition = "jsonb")
    private Map<String, Object> cursorState = new HashMap<>();
    @Column(name = "error_code")
    private String errorCode;
    @Column(name = "error_message")
    private String errorMessage;
    @Column(name = "next_retry_at")
    private Instant nextRetryAt;
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;
    @Column(name = "created_at")
    private Instant createdAt;

    public SyncJob(UUID id, UUID accountId, Trigger trigger, Instant now) {
        this.id = id;
        this.accountId = accountId;
        this.triggerType = trigger;
        this.status = Status.QUEUED;
        this.createdAt = now;
    }

    public boolean isActive() {
        return status == Status.QUEUED || status == Status.RUNNING;
    }
}
