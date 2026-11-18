package com.bloom.audience;

import com.bloom.analytics.AnalyticsDtos.AccountRef;
import com.bloom.analytics.AnalyticsDtos.SeriesPoint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AudienceDtos {
    private AudienceDtos() {}

    public record Bucket(String key, String label, BigDecimal value, BigDecimal sharePercent) {}

    /** One audience dimension. When {@code availability != AVAILABLE}, {@code reason} explains why — nothing is estimated. */
    public record Dimension(String dimension, String label, String availability, String reason, String metricKey,
                            String unit, String apiField, LocalDate asOf, String window, Instant fetchedAt,
                            String source, boolean demo, List<Bucket> buckets) {}

    public record Growth(String metricKey, String label, List<SeriesPoint> points, LocalDate firstDataDate) {}

    public record AudienceResponse(AccountRef account, Growth growth, List<Dimension> dimensions) {}
}
