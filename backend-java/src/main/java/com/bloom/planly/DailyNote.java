package com.bloom.planly;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Free-form notes for a day. {@code version} is an optimistic lock so an autosave from a stale tab is rejected
 * (409) instead of silently overwriting newer text.
 */
@Entity
@Table(name = "daily_note")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyNote extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Column(name = "note_date")
    private LocalDate noteDate;
    private String body;
    @Version
    private int version;

    public DailyNote(UUID id, UUID workspaceId, LocalDate noteDate) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.noteDate = noteDate;
        this.body = "";
    }
}
