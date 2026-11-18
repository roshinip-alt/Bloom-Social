package com.bloom.analytics;

import com.bloom.common.DateRange;
import com.bloom.analytics.AnalyticsDtos.*;
import com.bloom.analytics.AnalyticsQueries.DailyValue;
import com.bloom.common.api.PageResponse;
import com.bloom.exception.BloomException;
import com.bloom.social.domain.Capability;
import com.bloom.social.domain.ConnectedSocialAccount;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Account analytics. Rules: FLOW metrics sum only AVAILABLE days present; STOCK metrics use the latest value on/before
 * the range end; averages are averaged, never summed. Missing data is reported as missing, never as zero, and history
 * before the first stored snapshot is never invented.
 */
@Service
@Transactional(readOnly = true)
public class AnalyticsService {
    private final MetricDefinitionRepository definitions;
    private final AnalyticsQueries queries;
    private final AccountScope scope;
    private final Clock clock;

    public AnalyticsService(MetricDefinitionRepository definitions, AnalyticsQueries queries, AccountScope scope, Clock clock) {
        this.definitions = definitions;
        this.queries = queries;
        this.scope = scope;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public List<MetricDefinitionView> definitions(String provider) {
        return definitions.findAllByOrderByProviderAscMetricKeyAsc().stream()
                .filter(d -> provider == null || d.getProvider().equalsIgnoreCase(provider))
                .map(MetricDefinitionView::of).toList();
    }

    public SummaryResponse summary(Collection<UUID> accountIds, String provider, DateRange range) {
        List<ConnectedSocialAccount> accounts = scope.resolve(accountIds, provider);
        return new SummaryResponse(range.from(), range.to(), range.previous().from(), range.previous().to(),
                summarize(accounts, range));
    }

    public List<AccountSummary> summarize(List<ConnectedSocialAccount> accounts, DateRange range) {
        if (accounts.isEmpty()) return List.of();
        List<UUID> ids = accounts.stream().map(ConnectedSocialAccount::getId).toList();
        DateRange prev = range.previous();
        Map<UUID, List<DailyValue>> daily = queries.daily(ids, null, prev.from(), range.to()).stream()
                .collect(Collectors.groupingBy(DailyValue::accountId));
        Map<String, DailyValue> latestAtEnd = index(queries.latestOnOrBefore(ids, range.to()));
        Map<String, DailyValue> latestAtPrevEnd = index(queries.latestOnOrBefore(ids, prev.to()));
        Map<String, AnalyticsQueries.Coverage> coverage = queries.coverage(ids).stream()
                .collect(Collectors.toMap(c -> c.accountId() + "|" + c.metricKey(), c -> c));

        List<AccountSummary> out = new ArrayList<>();
        for (ConnectedSocialAccount a : accounts) {
            List<DailyValue> rows = daily.getOrDefault(a.getId(), List.of());
            List<MetricValue> values = new ArrayList<>();
            for (MetricDefinition d : definitions.findByProviderAndScopeOrderByMetricKeyAsc(a.getProvider().name(), "ACCOUNT")) {
                String k = a.getId() + "|" + d.getMetricKey();
                List<DailyValue> cur = rows.stream().filter(r -> r.metricKey().equals(d.getMetricKey())
                        && !r.date().isBefore(range.from())).toList();
                List<DailyValue> before = rows.stream().filter(r -> r.metricKey().equals(d.getMetricKey())
                        && r.date().isBefore(range.from())).toList();
                values.add(metricValue(a, d, range, cur, before, latestAtEnd.get(k), latestAtPrevEnd.get(k), coverage.get(k)));
            }
            out.add(new AccountSummary(AccountScope.ref(a), values));
        }
        return out;
    }

    MetricValue metricValue(ConnectedSocialAccount a, MetricDefinition d, DateRange range, List<DailyValue> cur,
                            List<DailyValue> before, DailyValue latestEnd, DailyValue latestPrevEnd,
                            AnalyticsQueries.Coverage cov) {
        List<DailyValue> curOk = available(cur);
        List<DailyValue> prevOk = available(before);
        BigDecimal value;
        BigDecimal previous;
        if (isAverage(d)) {
            value = mean(curOk);
            previous = mean(prevOk);
        } else if (d.isFlow()) {
            value = curOk.isEmpty() ? null : sum(curOk);
            previous = prevOk.isEmpty() ? null : sum(prevOk);
        } else {
            value = latestEnd != null && "AVAILABLE".equals(latestEnd.availability()) ? latestEnd.value() : null;
            previous = latestPrevEnd != null && "AVAILABLE".equals(latestPrevEnd.availability()) ? latestPrevEnd.value() : null;
        }
        String availability;
        if (value != null) {
            availability = "AVAILABLE";
        } else if (!cur.isEmpty()) {
            availability = cur.get(cur.size() - 1).availability();
        } else if (!a.has(Capability.ACCOUNT_METRICS)) {
            availability = "PERMISSION_MISSING";
        } else if (cov != null && cov.first().isAfter(range.to())) {
            availability = "BEFORE_HISTORY";
        } else {
            availability = "NO_DATA";
        }
        int covered = (int) curOk.stream().map(DailyValue::date).distinct().count();
        boolean demo = !cur.isEmpty() ? cur.get(0).demo() : a.isDemo();
        return new MetricValue(d.getMetricKey(), d.getLabel(), d.getDescription(), d.getUnit(), d.getMeasureType(),
                d.getCanonicalKey(), value, previous, value != null && previous != null ? value.subtract(previous) : null,
                availability, covered, range.days(), cov == null ? null : cov.first(), cov == null ? null : cov.last(),
                cov == null ? null : cov.lastFetched(), d.getApiSource(), demo);
    }

    public SeriesResponse series(UUID accountId, String metricKey, DateRange range) {
        ConnectedSocialAccount a = scope.one(accountId);
        MetricDefinition d = definitions.findById(metricKey)
                .filter(x -> x.getProvider().equals(a.getProvider().name()))
                .orElseThrow(() -> BloomException.notFound("Metric '" + metricKey + "' for this account"));
        List<DailyValue> rows = queries.daily(List.of(a.getId()), List.of(metricKey), range.from(), range.to());
        AnalyticsQueries.Coverage cov = queries.coverage(List.of(a.getId())).stream()
                .filter(c -> c.metricKey().equals(metricKey)).findFirst().orElse(null);
        return new SeriesResponse(a.getId(), metricKey, d.getLabel(), d.getUnit(), range.from(), range.to(),
                rows.stream().map(r -> new SeriesPoint(r.date(), r.value(), r.availability())).toList(),
                cov == null ? null : cov.first(), cov == null ? null : cov.lastFetched(), d.getApiSource(), a.isDemo());
    }

    public PageResponse<PostView> posts(Collection<UUID> accountIds, String provider, DateRange range, String contentType,
                                        String sortMetric, boolean desc, int page, int size) {
        List<ConnectedSocialAccount> accounts = scope.resolve(accountIds, provider);
        if (sortMetric != null) {
            MetricDefinition d = definitions.findById(sortMetric)
                    .orElseThrow(() -> BloomException.badRequest("UNKNOWN_METRIC", "Unknown sort metric"));
            if (!"POST".equals(d.getScope())) throw BloomException.badRequest("NOT_POST_METRIC", "Sort metric must be post-level");
            // Ranking by one platform's metric only makes sense within that platform.
            accounts = accounts.stream().filter(a -> a.getProvider().name().equals(d.getProvider())).toList();
        }
        List<UUID> ids = accounts.stream().map(ConnectedSocialAccount::getId).toList();
        int s = Math.min(Math.max(size, 1), 100);
        int p = Math.max(page, 0);
        Instant from = range.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = range.to().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        long total = queries.countPosts(ids, from, to, contentType);
        List<PostView> items = postViews(queries.posts(ids, from, to, contentType, sortMetric, desc, s, p * s));
        return PageResponse.of(new PageImpl<>(items, PageRequest.of(p, s), total), x -> x);
    }

    public List<PostView> postViews(List<AnalyticsQueries.PostRow> rows) {
        Map<UUID, List<AnalyticsQueries.PostMetricRow>> metrics = queries.latestPostMetrics(
                rows.stream().map(AnalyticsQueries.PostRow::id).toList()).stream()
                .collect(Collectors.groupingBy(AnalyticsQueries.PostMetricRow::postId));
        return rows.stream().map(r -> {
            List<AnalyticsQueries.PostMetricRow> m = metrics.getOrDefault(r.id(), List.of());
            Map<String, BigDecimal> values = new LinkedHashMap<>();
            m.forEach(x -> values.put(x.metricKey(), x.value()));
            LocalDate asOf = m.stream().map(AnalyticsQueries.PostMetricRow::date).max(Comparator.naturalOrder()).orElse(null);
            return new PostView(r.id(), r.accountId(), r.provider(), r.handle(), r.providerContentId(), r.contentType(),
                    r.title(), r.permalink(), r.thumbnailUrl(), r.publishedAt(), r.durationSeconds(), r.demo(),
                    r.fetchedAt(), values, asOf);
        }).toList();
    }

    // ---------------------------------------------------------------- helpers

    static boolean isAverage(MetricDefinition d) {
        return d.getCanonicalKey().contains("avg");
    }

    private static List<DailyValue> available(List<DailyValue> rows) {
        return rows.stream().filter(r -> "AVAILABLE".equals(r.availability()) && r.value() != null).toList();
    }

    private static BigDecimal sum(List<DailyValue> rows) {
        return rows.stream().map(DailyValue::value).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal mean(List<DailyValue> rows) {
        if (rows.isEmpty()) return null;
        return sum(rows).divide(BigDecimal.valueOf(rows.size()), 2, RoundingMode.HALF_UP);
    }

    private static Map<String, DailyValue> index(List<DailyValue> rows) {
        Map<String, DailyValue> m = new HashMap<>();
        rows.forEach(r -> m.put(r.accountId() + "|" + r.metricKey(), r));
        return m;
    }
}
