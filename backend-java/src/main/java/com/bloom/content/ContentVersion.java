package com.bloom.content;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Immutable snapshot of a draft's editable text, written whenever that text changes. */
@Entity
@Table(name = "content_version")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContentVersion {
    /** The versioned fields of a draft. */
    public record Snapshot(String title, String caption, String script, java.util.List<String> hashtags, String notes) {}

    @Id
    private UUID id;
    @Column(name = "draft_id")
    private UUID draftId;
    @Column(name = "version_number")
    private int versionNumber;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot", columnDefinition = "jsonb")
    private Snapshot snapshot;
    @Column(name = "change_summary")
    private String changeSummary;
    @Column(name = "created_at")
    private Instant createdAt;

    public ContentVersion(UUID id, UUID draftId, int versionNumber, Snapshot snapshot, String changeSummary, Instant at) {
        this.id = id;
        this.draftId = draftId;
        this.versionNumber = versionNumber;
        this.snapshot = snapshot;
        this.changeSummary = changeSummary;
        this.createdAt = at;
    }
}
