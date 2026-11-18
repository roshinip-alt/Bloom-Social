package com.bloom.goals;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class GoalDtos {
    private GoalDtos() {}

    /** Derived, never stored: computed from status, dates and progress by {@link GoalStateEvaluator}. */
    public enum State { NOT_STARTED, ON_TRACK, AT_RISK, OVERDUE, COMPLETED, ARCHIVED }

    public record GoalRequest(
            @NotBlank @Size(max = 200) String title,
            @NotNull Goal.Category category,
            @Size(max = 5000) String description,
            @NotBlank @Size(max = 48) String unit,
            BigDecimal startValue,
            @NotNull BigDecimal targetValue,
            @NotNull LocalDate startDate,
            LocalDate deadline,
            Goal.ProgressSource progressSource,
            UUID linkedAccountId,
            @Size(max = 96) String linkedMetricKey) {}

    public record ProgressRequest(@NotNull BigDecimal value, @Size(max = 500) String note) {}

    public record MilestoneRequest(@NotBlank @Size(max = 200) String title, BigDecimal targetValue, LocalDate dueDate,
                                   Boolean achieved, Integer position) {}

    public record MilestoneView(UUID id, String title, BigDecimal targetValue, LocalDate dueDate, Instant achievedAt,
                                int position) {
        static MilestoneView of(GoalMilestone m) {
            return new MilestoneView(m.getId(), m.getTitle(), m.getTargetValue(), m.getDueDate(), m.getAchievedAt(),
                    m.getPosition());
        }
    }

    public record ProgressView(UUID id, BigDecimal value, Goal.ProgressSource source, String note, Instant recordedAt) {
        static ProgressView of(GoalProgressEntry e) {
            return new ProgressView(e.getId(), e.getValue(), e.getSource(), e.getNote(), e.getRecordedAt());
        }
    }

    /** Where analytics-linked progress comes from, labelled so the UI can show its source. */
    public record LinkedMetric(UUID accountId, String accountHandle, String provider, String metricKey, String label,
                               String measureType, boolean available, String note) {}

    public record GoalView(UUID id, String title, Goal.Category category, String description, String unit,
                           BigDecimal startValue, BigDecimal targetValue, BigDecimal currentValue,
                           BigDecimal progressPercent, boolean targetReached, LocalDate startDate, LocalDate deadline,
                           Long daysRemaining, Goal.ProgressSource progressSource, LinkedMetric linkedMetric,
                           Goal.Status status, State state, Instant completedAt, List<MilestoneView> milestones,
                           Instant createdAt, Instant updatedAt) {}
}
