package com.bloom.goals;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "goal_milestone")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GoalMilestone {
    @Id
    private UUID id;
    @Column(name = "goal_id")
    private UUID goalId;
    private String title;
    @Column(name = "target_value")
    private BigDecimal targetValue;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Column(name = "achieved_at")
    private Instant achievedAt;
    private int position;
    @Column(name = "created_at")
    private Instant createdAt;

    public GoalMilestone(UUID id, UUID goalId, Instant now) {
        this.id = id;
        this.goalId = goalId;
        this.createdAt = now;
    }
}
