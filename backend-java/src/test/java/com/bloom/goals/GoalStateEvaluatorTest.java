package com.bloom.goals;

import static org.assertj.core.api.Assertions.assertThat;

import com.bloom.goals.GoalDtos.State;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GoalStateEvaluatorTest {
    private static final LocalDate START = LocalDate.of(2026, 1, 1);
    private static final LocalDate DEADLINE = START.plusDays(100);

    private static Goal goal(double start, double target, double current) {
        Goal g = new Goal(UUID.randomUUID(), UUID.randomUUID());
        g.setStartValue(BigDecimal.valueOf(start));
        g.setTargetValue(BigDecimal.valueOf(target));
        g.setCurrentValue(BigDecimal.valueOf(current));
        g.setStartDate(START);
        g.setDeadline(DEADLINE);
        return g;
    }

    @Test
    void progressIsClampedAndSupportsDecreasingTargets() {
        assertThat(GoalStateEvaluator.progressPercent(BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.valueOf(5))).isEqualByComparingTo("50");
        assertThat(GoalStateEvaluator.progressPercent(BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.valueOf(15))).isEqualByComparingTo("100");
        assertThat(GoalStateEvaluator.progressPercent(BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.valueOf(-3))).isEqualByComparingTo("0");
        // e.g. reduce screen time from 100 to 60: at 80 we are halfway
        assertThat(GoalStateEvaluator.progressPercent(BigDecimal.valueOf(100), BigDecimal.valueOf(60), BigDecimal.valueOf(80)))
                .isEqualByComparingTo("50");
    }

    @Test
    void notStartedBeforeStartDate() {
        assertThat(GoalStateEvaluator.evaluate(goal(0, 10, 0), START.minusDays(1))).isEqualTo(State.NOT_STARTED);
    }

    @Test
    void atRiskWhenProgressTrailsElapsedTime() {
        LocalDate halfway = START.plusDays(50);
        assertThat(GoalStateEvaluator.evaluate(goal(0, 100, 20), halfway)).isEqualTo(State.AT_RISK);
        assertThat(GoalStateEvaluator.evaluate(goal(0, 100, 45), halfway)).isEqualTo(State.ON_TRACK);
    }

    @Test
    void earlyInTheGoalIsNeverAtRisk() {
        assertThat(GoalStateEvaluator.evaluate(goal(0, 100, 0), START.plusDays(5))).isEqualTo(State.ON_TRACK);
    }

    @Test
    void overdueAfterDeadlineUnlessReached() {
        assertThat(GoalStateEvaluator.evaluate(goal(0, 100, 60), DEADLINE.plusDays(1))).isEqualTo(State.OVERDUE);
        assertThat(GoalStateEvaluator.evaluate(goal(0, 100, 100), DEADLINE.plusDays(1))).isEqualTo(State.ON_TRACK);
    }

    @Test
    void explicitStatusWins() {
        Goal g = goal(0, 100, 0);
        g.setStatus(Goal.Status.COMPLETED);
        assertThat(GoalStateEvaluator.evaluate(g, DEADLINE.plusDays(10))).isEqualTo(State.COMPLETED);
        g.setStatus(Goal.Status.ARCHIVED);
        assertThat(GoalStateEvaluator.evaluate(g, DEADLINE.plusDays(10))).isEqualTo(State.ARCHIVED);
    }
}
