package com.bloom.analytics;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AnalyticsDtos {
    private AnalyticsDtos() {}

    public record MetricDefinitionView(String metricKey, String provider, String sourceMetric, String canonicalKey,
                                       String scope, String label, String description, String unit, String measureType,
                                       String apiSource) {
        static MetricDefinitionView of(MetricDefinition d) {
            return new MetricDefinitionView(d.getMetricKey(), d.getProvider(), d.getSourceMetric(), d.getCanonicalKey(),
                    d.getScope(), d.getLabel(), d.getDescription(), d.getUnit(), d.getMeasureType(), d.getApiSource());
        }
    }

    /**
     * Value of one metric for one account over a range. {@code value == null} means not available — the
     * {@code availability} field says why; the UI must never render it as zero.
     * FLOW metrics are summed over days present; STOCK metrics take the latest value on/before {@code to}.
     */
    public record MetricValue(String metricKey, String label, String description, String unit, String measureType,
                              String canonicalKey, BigDecimal value, BigDecimal previousValue, BigDecimal change,
                              String availability, int coveredDays, long rangeDays, LocalDate firstDataDate,
                              LocalDate lastDataDate, Instant lastFetchedAt, String apiSource, boolean demo) {}

    public record AccountRef(UUID id, String provider, String handle, String displayName, String avatarUrl,
                             String dataMode, String connectionStatus, Instant lastSuccessfulSyncAt) {}

    public record AccountSummary(AccountRef account, List<MetricValue> metrics) {}

    public record SummaryResponse(LocalDate from, LocalDate to, LocalDate previousFrom, LocalDate previousTo,
                                  List<AccountSummary> accounts) {}

    public record SeriesPoint(LocalDate date, BigDecimal value, String availability) {}

    public record SeriesResponse(UUID accountId, String metricKey, String label, String unit, LocalDate from,
                                 LocalDate to, List<SeriesPoint> points, LocalDate firstDataDate,
                                 Instant lastFetchedAt, String apiSource, boolean demo) {}

    public record PostView(UUID id, UUID accountId, String provider, String accountHandle, String providerContentId,
                           String contentType, String title, String permalink, String thumbnailUrl,
                           Instant publishedAt, Integer durationSeconds, boolean demo, Instant fetchedAt,
                           Map<String, BigDecimal> metrics, LocalDate metricsAsOf) {}
}
