package com.bloom.planly;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A Planly task. Due dates are calendar dates in the workspace timezone (no instant conversion). */
@Entity
@Table(name = "task")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Task extends Timestamped {
    public enum Priority { LOW, MEDIUM, HIGH, URGENT }
    public enum Status { TODO, IN_PROGRESS, DONE, CANCELLED }

    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    private String title;
    private String description;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Column(name = "due_time")
    private LocalTime dueTime;
    @Enumerated(EnumType.STRING)
    private Priority priority;
    @Enumerated(EnumType.STRING)
    private Status status;
    @Enumerated(EnumType.STRING)
    private Recurrence recurrence;
    @Column(name = "recurrence_until")
    private LocalDate recurrenceUntil;
    @Column(name = "recurrence_source_id")
    private UUID recurrenceSourceId;
    @Column(name = "goal_id")
    private UUID goalId;
    @Column(name = "content_draft_id")
    private UUID contentDraftId;
    @Column(name = "completed_at")
    private Instant completedAt;

    public Task(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.status = Status.TODO;
        this.priority = Priority.MEDIUM;
        this.recurrence = Recurrence.NONE;
    }

    public boolean isOpen() {
        return status == Status.TODO || status == Status.IN_PROGRESS;
    }
}
