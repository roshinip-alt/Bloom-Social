package com.bloom.goals;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "goal_progress_entry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GoalProgressEntry {
    @Id
    private UUID id;
    @Column(name = "goal_id")
    private UUID goalId;
    private BigDecimal value;
    @Enumerated(EnumType.STRING)
    private Goal.ProgressSource source;
    private String note;
    @Column(name = "recorded_at")
    private Instant recordedAt;

    public GoalProgressEntry(UUID id, UUID goalId, BigDecimal value, Goal.ProgressSource source, String note, Instant at) {
        this.id = id;
        this.goalId = goalId;
        this.value = value;
        this.source = source;
        this.note = note;
        this.recordedAt = at;
    }
}
