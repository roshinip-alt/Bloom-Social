package com.bloom.dashboard;

import com.bloom.analytics.AccountScope;
import com.bloom.analytics.AnalyticsDtos.*;
import com.bloom.analytics.AnalyticsQueries;
import com.bloom.analytics.AnalyticsService;
import com.bloom.auth.CurrentWorkspace;
import com.bloom.common.DateRange;
import com.bloom.config.BloomProperties;
import com.bloom.dashboard.DashboardDtos.*;
import com.bloom.goals.Goal;
import com.bloom.goals.GoalService;
import com.bloom.planly.PlanlyService;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectionStatus;
import com.bloom.social.domain.SyncJob;
import com.bloom.social.domain.SyncJobRepository;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Composes the dashboard from the other modules. Aggregation rules:
 * <ul>
 *   <li>Only metrics sharing a canonical key (same definition and unit) are summed across accounts.</li>
 *   <li>Each aggregate lists the accounts that contributed, those that should have but have no data (with the
 *   reason), and those whose platform does not report the metric — no account is silently omitted.</li>
 *   <li>Unique-count metrics (reach, accounts engaged) are not aggregated across accounts.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {
    /** Headline metrics in display order. Each is one canonical definition. */
    static final List<String> HEADLINE = List.of("followers", "subscribers", "instagram_views", "youtube_views",
            "youtube_watch_time", "instagram_interactions");

    private static final Map<String, String> AUDIENCE_METRIC = Map.of(
            "INSTAGRAM", "instagram.followers_count", "YOUTUBE", "youtube.subscriber_count", "TIKTOK", "tiktok.follower_count");
    private static final Map<String, String> TOP_CONTENT_METRIC = Map.of(
            "INSTAGRAM", "instagram.post.views", "YOUTUBE", "youtube.post.views", "TIKTOK", "tiktok.post.view_count");

    private final AccountScope scope;
    private final AnalyticsService analytics;
    private final AnalyticsQueries queries;
    private final PlanlyService planly;
    private final GoalService goals;
    private final SyncJobRepository jobs;
    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentWorkspace workspace;
    private final BloomProperties props;
    private final Clock clock;

    public DashboardService(AccountScope scope, AnalyticsService analytics, AnalyticsQueries queries, PlanlyService planly,
                            GoalService goals, SyncJobRepository jobs, NamedParameterJdbcTemplate jdbc,
                            CurrentWorkspace workspace, BloomProperties props, Clock clock) {
        this.scope = scope;
        this.analytics = analytics;
        this.queries = queries;
        this.planly = planly;
        this.goals = goals;
        this.jobs = jobs;
        this.jdbc = jdbc;
        this.workspace = workspace;
        this.props = props;
        this.clock = clock;
    }

    public DashboardResponse dashboard(DateRange range, UUID accountId) {
        List<ConnectedSocialAccount> accounts = scope.resolve(accountId == null ? null : List.of(accountId), null);
        List<AccountSummary> summaries = analytics.summarize(accounts, range);
        DateRange prev = range.previous();
        return new DashboardResponse(range.from(), range.to(), prev.from(), prev.to(),
                accounts.stream().map(this::health).toList(),
                aggregates(accounts, summaries),
                audienceTrend(accounts, range),
                contentPublished(accounts, range),
                topContent(accounts, range),
                planly.upcoming(7, 8), planly.overdueCount(),
                goals.list(List.of(Goal.Status.ACTIVE)).stream().limit(4).toList(),
                workspace.isDemo());
    }

    static List<Aggregate> aggregate(List<AccountSummary> summaries) {
        List<Aggregate> out = new ArrayList<>();
        for (String key : HEADLINE) {
            List<Contribution> contributors = new ArrayList<>();
            List<Gap> missing = new ArrayList<>();
            List<AccountRef> notReported = new ArrayList<>();
            MetricValue template = null;
            BigDecimal value = null;
            BigDecimal previous = null;
            for (AccountSummary s : summaries) {
                Optional<MetricValue> mv = s.metrics().stream().filter(m -> key.equals(m.canonicalKey())).findFirst();
                if (mv.isEmpty()) {
                    notReported.add(s.account());
                    continue;
                }
                MetricValue m = mv.get();
                template = m;
                if (m.value() == null) {
                    missing.add(new Gap(s.account(), m.availability()));
                    continue;
                }
                contributors.add(new Contribution(s.account(), m.value()));
                value = value == null ? m.value() : value.add(m.value());
                if (m.previousValue() != null) previous = previous == null ? m.previousValue() : previous.add(m.previousValue());
            }
            if (template == null) continue; // no account in scope can report this metric
            // A comparison is only meaningful when every contributor has a previous value.
            boolean comparable = previous != null && contributors.stream().allMatch(c -> summaries.stream()
                    .filter(s -> s.account().id().equals(c.account().id())).flatMap(s -> s.metrics().stream())
                    .anyMatch(m -> key.equals(m.canonicalKey()) && m.previousValue() != null));
            BigDecimal prevValue = comparable ? previous : null;
            out.add(new Aggregate(key, template.label(), template.unit(), template.measureType(), template.description(),
                    value, prevValue, value != null && prevValue != null ? value.subtract(prevValue) : null,
                    contributors, missing, notReported));
        }
        return out;
    }

    private List<Aggregate> aggregates(List<ConnectedSocialAccount> accounts, List<AccountSummary> summaries) {
        return accounts.isEmpty() ? List.of() : aggregate(summaries);
    }

    private List<AudienceSeries> audienceTrend(List<ConnectedSocialAccount> accounts, DateRange range) {
        List<AudienceSeries> out = new ArrayList<>();
        for (ConnectedSocialAccount a : accounts) {
            SeriesResponse s = analytics.series(a.getId(), AUDIENCE_METRIC.get(a.getProvider().name()), range);
            out.add(new AudienceSeries(AccountScope.ref(a), s.metricKey(), s.label(), s.points()));
        }
        return out;
    }

    private ContentPublished contentPublished(List<ConnectedSocialAccount> accounts, DateRange range) {
        Instant from = range.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<PublishedCount> counts = accounts.stream()
                .map(a -> new PublishedCount(AccountScope.ref(a), queries.countPosts(List.of(a.getId()), from, to, null)))
                .toList();
        Long manual = jdbc.queryForObject("""
                SELECT count(*) FROM content_draft WHERE workspace_id = :ws AND stage = 'PUBLISHED'
                   AND publication_source = 'MANUAL' AND published_at >= :from AND published_at < :to""",
                new MapSqlParameterSource("ws", workspace.id()).addValue("from", Timestamp.from(from))
                        .addValue("to", Timestamp.from(to)), Long.class);
        return new ContentPublished(counts, manual == null ? 0 : manual);
    }

    /** Ranked within each platform only, by that platform's own views metric. */
    private List<TopContent> topContent(List<ConnectedSocialAccount> accounts, DateRange range) {
        Instant from = range.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<String, List<UUID>> byProvider = new TreeMap<>();
        accounts.forEach(a -> byProvider.computeIfAbsent(a.getProvider().name(), k -> new ArrayList<>()).add(a.getId()));
        List<TopContent> out = new ArrayList<>();
        byProvider.forEach((provider, ids) -> {
            String metric = TOP_CONTENT_METRIC.get(provider);
            List<PostView> posts = analytics.postViews(queries.posts(ids, from, to, null, metric, true, 3, 0));
            if (!posts.isEmpty()) out.add(new TopContent(provider, metric, "Views", posts));
        });
        return out;
    }

    private AccountHealth health(ConnectedSocialAccount a) {
        SyncJob latest = jobs.findFirstByAccountIdOrderByCreatedAtDesc(a.getId()).orElse(null);
        SyncState state;
        if (a.getConnectionStatus() == ConnectionStatus.DISCONNECTED) {
            state = SyncState.DISCONNECTED;
        } else if (a.getConnectionStatus().needsReconnect()) {
            state = SyncState.NEEDS_RECONNECT;
        } else if (latest != null && latest.isActive()) {
            state = SyncState.SYNCING;
        } else if (a.getConnectionStatus() == ConnectionStatus.ERROR) {
            state = SyncState.ERROR;
        } else if (a.getLastSuccessfulSyncAt() == null) {
            state = SyncState.NEVER_SYNCED;
        } else if (a.getLastSuccessfulSyncAt().isBefore(clock.instant().minus(props.sync().interval().multipliedBy(4)))) {
            state = SyncState.STALE;
        } else {
            state = SyncState.FRESH;
        }
        return new AccountHealth(AccountScope.ref(a), state, a.getLastSuccessfulSyncAt(), a.getLastSyncError());
    }
}
