package com.bloom.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.bloom.analytics.AnalyticsDtos.AccountRef;
import com.bloom.analytics.AnalyticsDtos.AccountSummary;
import com.bloom.analytics.AnalyticsDtos.MetricValue;
import com.bloom.dashboard.DashboardDtos.Aggregate;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DashboardAggregationTest {
    private static AccountRef account(String provider, String handle) {
        return new AccountRef(UUID.randomUUID(), provider, handle, handle, null, "LIVE", "ACTIVE", null);
    }

    private static MetricValue metric(String key, String canonical, Integer value, Integer previous) {
        return new MetricValue(key, "Label", "desc", "COUNT", "STOCK", canonical,
                value == null ? null : BigDecimal.valueOf(value), previous == null ? null : BigDecimal.valueOf(previous),
                null, value == null ? "NO_DATA" : "AVAILABLE", 28, 28, null, null, null, "api", false);
    }

    @Test
    void sumsOnlyLikeMetricsAndReportsEveryAccount() {
        AccountRef ig = account("INSTAGRAM", "ig");
        AccountRef tt = account("TIKTOK", "tt");
        AccountRef yt = account("YOUTUBE", "yt");
        List<AccountSummary> summaries = List.of(
                new AccountSummary(ig, List.of(metric("instagram.followers_count", "followers", 1000, 900),
                        metric("instagram.views", "instagram_views", 5000, 4000))),
                new AccountSummary(tt, List.of(metric("tiktok.follower_count", "followers", 500, 450))),
                new AccountSummary(yt, List.of(metric("youtube.subscriber_count", "subscribers", 300, 280),
                        metric("youtube.views", "youtube_views", 7000, 6000))));

        List<Aggregate> aggregates = DashboardService.aggregate(summaries);

        Aggregate followers = aggregates.stream().filter(a -> a.canonicalKey().equals("followers")).findFirst().orElseThrow();
        assertThat(followers.value()).isEqualByComparingTo("1500");
        assertThat(followers.previousValue()).isEqualByComparingTo("1350");
        assertThat(followers.contributors()).extracting(c -> c.account().handle()).containsExactly("ig", "tt");
        assertThat(followers.notReportedBy()).extracting(AccountRef::handle).containsExactly("yt");

        // Views are platform-specific definitions and are never added together.
        Aggregate igViews = aggregates.stream().filter(a -> a.canonicalKey().equals("instagram_views")).findFirst().orElseThrow();
        assertThat(igViews.value()).isEqualByComparingTo("5000");
        Aggregate ytViews = aggregates.stream().filter(a -> a.canonicalKey().equals("youtube_views")).findFirst().orElseThrow();
        assertThat(ytViews.value()).isEqualByComparingTo("7000");
    }

    @Test
    void missingDataIsReportedNotTreatedAsZero() {
        AccountRef a = account("INSTAGRAM", "a");
        AccountRef b = account("INSTAGRAM", "b");
        List<Aggregate> aggregates = DashboardService.aggregate(List.of(
                new AccountSummary(a, List.of(metric("instagram.followers_count", "followers", 1000, 900))),
                new AccountSummary(b, List.of(metric("instagram.followers_count", "followers", null, null)))));
        Aggregate followers = aggregates.get(0);
        assertThat(followers.value()).isEqualByComparingTo("1000");
        assertThat(followers.missing()).extracting(g -> g.account().handle()).containsExactly("b");
        assertThat(followers.missing().get(0).reason()).isEqualTo("NO_DATA");
    }

    @Test
    void noComparisonWhenAContributorLacksAPreviousValue() {
        AccountRef a = account("INSTAGRAM", "a");
        AccountRef b = account("TIKTOK", "b");
        Aggregate followers = DashboardService.aggregate(List.of(
                new AccountSummary(a, List.of(metric("instagram.followers_count", "followers", 1000, 900))),
                new AccountSummary(b, List.of(metric("tiktok.follower_count", "followers", 500, null))))).get(0);
        assertThat(followers.value()).isEqualByComparingTo("1500");
        assertThat(followers.previousValue()).isNull();
        assertThat(followers.change()).isNull();
    }
}
