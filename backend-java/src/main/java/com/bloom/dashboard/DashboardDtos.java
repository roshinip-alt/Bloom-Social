package com.bloom.dashboard;

import com.bloom.analytics.AnalyticsDtos.AccountRef;
import com.bloom.analytics.AnalyticsDtos.PostView;
import com.bloom.analytics.AnalyticsDtos.SeriesPoint;
import com.bloom.goals.GoalDtos.GoalView;
import com.bloom.planly.PlanlyDtos.TaskView;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class DashboardDtos {
    private DashboardDtos() {}

    /** Freshness of one account's data, derived from its connection status and last successful sync. */
    public enum SyncState { FRESH, STALE, SYNCING, NEEDS_RECONNECT, ERROR, DISCONNECTED, NEVER_SYNCED }

    public record AccountHealth(AccountRef account, SyncState syncState, Instant lastSuccessfulSyncAt,
                                String lastSyncError) {}

    public record Contribution(AccountRef account, BigDecimal value) {}

    /** An account that could have contributed but has no value, with the reason. */
    public record Gap(AccountRef account, String reason) {}

    /**
     * A cross-account total for ONE metric definition (canonical key). Unlike metrics are never combined.
     * {@code value} is null when no account in scope reported it.
     */
    public record Aggregate(String canonicalKey, String label, String unit, String measureType, String description,
                            BigDecimal value, BigDecimal previousValue, BigDecimal change, List<Contribution> contributors,
                            List<Gap> missing, List<AccountRef> notReportedBy) {}

    public record AudienceSeries(AccountRef account, String metricKey, String label, List<SeriesPoint> points) {}

    public record PublishedCount(AccountRef account, long posts) {}

    public record ContentPublished(List<PublishedCount> syncedPosts, long manuallyRecordedDrafts) {}

    public record TopContent(String provider, String metricKey, String metricLabel, List<PostView> posts) {}

    public record DashboardResponse(LocalDate from, LocalDate to, LocalDate previousFrom, LocalDate previousTo,
                                    List<AccountHealth> accounts, List<Aggregate> headline,
                                    List<AudienceSeries> audienceTrend, ContentPublished contentPublished,
                                    List<TopContent> topContent, List<TaskView> upcomingTasks, long overdueTasks,
                                    List<GoalView> goals, boolean demoWorkspace) {}
}
