package com.bloom.goals;

import com.bloom.analytics.AnalyticsQueries;
import com.bloom.analytics.AnalyticsQueries.DailyValue;
import com.bloom.analytics.MetricDefinition;
import com.bloom.analytics.MetricDefinitionRepository;
import com.bloom.common.persistence.Ids;
import com.bloom.social.sync.SyncCompletedEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps analytics-linked goals in step with stored snapshots. STOCK metrics (e.g. followers) use the latest value;
 * FLOW metrics (e.g. views) are summed from the goal's start date. Each change is appended to the progress history
 * with source ANALYTICS so the UI can label it.
 */
@Service
public class GoalProgressService {
    private final GoalRepository goals;
    private final GoalProgressEntryRepository entries;
    private final MetricDefinitionRepository definitions;
    private final AnalyticsQueries queries;
    private final Clock clock;

    public GoalProgressService(GoalRepository goals, GoalProgressEntryRepository entries,
                               MetricDefinitionRepository definitions, AnalyticsQueries queries, Clock clock) {
        this.goals = goals;
        this.entries = entries;
        this.definitions = definitions;
        this.queries = queries;
        this.clock = clock;
    }

    @EventListener
    @Transactional
    public void onSyncCompleted(SyncCompletedEvent event) {
        goals.findByLinkedAccountIdAndStatus(event.accountId(), Goal.Status.ACTIVE).forEach(this::refresh);
    }

    @Transactional
    public void refreshAnalyticsGoals(UUID workspaceId) {
        goals.findByWorkspaceIdAndStatusInOrderByDeadlineAscCreatedAtAsc(workspaceId, List.of(Goal.Status.ACTIVE))
                .stream().filter(g -> g.getProgressSource() == Goal.ProgressSource.ANALYTICS)
                .forEach(this::refresh);
    }

    void refresh(Goal goal) {
        if (goal.getProgressSource() != Goal.ProgressSource.ANALYTICS || goal.getLinkedAccountId() == null) return;
        currentValue(goal).ifPresent(value -> {
            if (value.compareTo(goal.getCurrentValue()) != 0) {
                goal.setCurrentValue(value);
                entries.save(new GoalProgressEntry(Ids.newId(), goal.getId(), value, Goal.ProgressSource.ANALYTICS,
                        "From synced " + goal.getLinkedMetricKey(), clock.instant()));
            }
        });
    }

    /** The metric value the goal tracks, or empty when no snapshot exists yet (never treated as zero). */
    Optional<BigDecimal> currentValue(Goal goal) {
        MetricDefinition d = definitions.findById(goal.getLinkedMetricKey()).orElse(null);
        if (d == null) return Optional.empty();
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        List<UUID> account = List.of(goal.getLinkedAccountId());
        if (d.isFlow()) {
            LocalDate end = goal.getDeadline() != null && goal.getDeadline().isBefore(today) ? goal.getDeadline() : today;
            if (end.isBefore(goal.getStartDate())) return Optional.empty();
            List<DailyValue> rows = queries.daily(account, List.of(d.getMetricKey()), goal.getStartDate(), end).stream()
                    .filter(r -> "AVAILABLE".equals(r.availability()) && r.value() != null).toList();
            return rows.isEmpty() ? Optional.empty()
                    : Optional.of(rows.stream().map(DailyValue::value).reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        return queries.latestOnOrBefore(account, today).stream()
                .filter(r -> r.metricKey().equals(d.getMetricKey()) && "AVAILABLE".equals(r.availability()))
                .map(DailyValue::value).findFirst();
    }
}
