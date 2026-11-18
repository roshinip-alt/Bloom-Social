package com.bloom.goals;

import com.bloom.goals.GoalDtos.State;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Pure rules for a goal's derived state and progress. A goal is AT_RISK when at least 20% of its time has passed
 * and its progress trails the elapsed share of time by more than 15 percentage points.
 */
public final class GoalStateEvaluator {
    static final double AT_RISK_MIN_ELAPSED = 0.20;
    static final double AT_RISK_TOLERANCE = 0.15;

    private GoalStateEvaluator() {}

    /** Progress from start to target in percent, clamped to 0–100. Works for decreasing targets too. */
    public static BigDecimal progressPercent(BigDecimal start, BigDecimal target, BigDecimal current) {
        BigDecimal span = target.subtract(start);
        if (span.signum() == 0) {
            return BigDecimal.valueOf(100);
        }
        BigDecimal pct = current.subtract(start).multiply(BigDecimal.valueOf(100)).divide(span, 1, RoundingMode.HALF_UP);
        return pct.max(BigDecimal.ZERO).min(BigDecimal.valueOf(100));
    }

    public static State evaluate(Goal goal, LocalDate today) {
        if (goal.getStatus() == Goal.Status.ARCHIVED) return State.ARCHIVED;
        if (goal.getStatus() == Goal.Status.COMPLETED) return State.COMPLETED;
        if (today.isBefore(goal.getStartDate())) return State.NOT_STARTED;
        boolean reached = goal.targetReached();
        LocalDate deadline = goal.getDeadline();
        if (deadline == null || reached) return State.ON_TRACK;
        if (today.isAfter(deadline)) return State.OVERDUE;

        long total = Math.max(1, ChronoUnit.DAYS.between(goal.getStartDate(), deadline));
        double elapsed = (double) ChronoUnit.DAYS.between(goal.getStartDate(), today) / total;
        double progress = progressPercent(goal.getStartValue(), goal.getTargetValue(), goal.getCurrentValue())
                .doubleValue() / 100;
        boolean behind = elapsed >= AT_RISK_MIN_ELAPSED && progress < elapsed - AT_RISK_TOLERANCE;
        return behind ? State.AT_RISK : State.ON_TRACK;
    }
}
