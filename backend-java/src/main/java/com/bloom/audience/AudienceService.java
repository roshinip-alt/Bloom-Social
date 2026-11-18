package com.bloom.audience;

import com.bloom.analytics.AccountScope;
import com.bloom.analytics.AnalyticsQueries;
import com.bloom.analytics.AnalyticsQueries.DimensionRow;
import com.bloom.analytics.AnalyticsService;
import com.bloom.common.DateRange;
import com.bloom.audience.AudienceDtos.*;
import com.bloom.social.domain.Capability;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.Provider;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Audience views are built strictly from stored provider snapshots. Each provider's dimension support is declared here
 * (from docs/integrations/*.md); anything else is reported as unavailable with a reason.
 */
@Service
@Transactional(readOnly = true)
public class AudienceService {
    private record Spec(String dimension, String label, String metricKey, String dimField, String apiField, String unsupportedReason) {}

    private static final Map<Provider, List<Spec>> SPECS = Map.of(
            Provider.INSTAGRAM, List.of(
                    new Spec("age", "Age", "instagram.follower_demographics", "age", "follower_demographics breakdown=age", null),
                    new Spec("gender", "Gender", "instagram.follower_demographics", "gender", "follower_demographics breakdown=gender", null),
                    new Spec("country", "Country", "instagram.follower_demographics", "country", "follower_demographics breakdown=country", null),
                    new Spec("city", "City", "instagram.follower_demographics", "city", "follower_demographics breakdown=city", null),
                    new Spec("activeTimes", "Active times", null, null, "online_followers",
                            "Not collected in Bloom V1: Meta mentions online_followers only in its limitations notes, not in the current insights metrics reference.")),
            Provider.YOUTUBE, List.of(
                    new Spec("age", "Age (logged-in viewers)", "youtube.viewer_percentage", "ageGroup", "viewerPercentage by ageGroup", null),
                    new Spec("gender", "Gender (logged-in viewers)", "youtube.viewer_percentage", "gender", "viewerPercentage by gender", null),
                    new Spec("country", "Views by country", "youtube.views_by_country", "country", "views by country", null),
                    new Spec("city", "City", null, null, null, "Not collected in Bloom V1 for YouTube."),
                    new Spec("activeTimes", "Active times", null, null, null,
                            "Not available from the YouTube Analytics API.")),
            Provider.TIKTOK, List.of(
                    new Spec("age", "Age", null, null, null, "Not available from the TikTok Display API."),
                    new Spec("gender", "Gender", null, null, null, "Not available from the TikTok Display API."),
                    new Spec("country", "Country", null, null, null, "Not available from the TikTok Display API."),
                    new Spec("city", "City", null, null, null, "Not available from the TikTok Display API."),
                    new Spec("activeTimes", "Active times", null, null, null, "Not available from the TikTok Display API.")));

    private static final Map<Provider, String> GROWTH_METRIC = Map.of(
            Provider.INSTAGRAM, "instagram.followers_count",
            Provider.YOUTUBE, "youtube.subscriber_count",
            Provider.TIKTOK, "tiktok.follower_count");

    private final AccountScope scope;
    private final AnalyticsQueries queries;
    private final AnalyticsService analytics;
    private final ObjectMapper mapper;

    public AudienceService(AccountScope scope, AnalyticsQueries queries, AnalyticsService analytics, ObjectMapper mapper) {
        this.scope = scope;
        this.queries = queries;
        this.analytics = analytics;
        this.mapper = mapper;
    }

    public AudienceResponse forAccount(UUID accountId, DateRange range) {
        ConnectedSocialAccount a = scope.one(accountId);
        var series = analytics.series(a.getId(), GROWTH_METRIC.get(a.getProvider()), range);
        Growth growth = new Growth(series.metricKey(), series.label(), series.points(), series.firstDataDate());
        List<DimensionRow> rows = queries.latestDimensioned(a.getId());
        List<Dimension> dims = new ArrayList<>();
        for (Spec spec : SPECS.get(a.getProvider())) {
            dims.add(dimension(a, spec, rows));
        }
        return new AudienceResponse(AccountScope.ref(a), growth, dims);
    }

    private Dimension dimension(ConnectedSocialAccount a, Spec spec, List<DimensionRow> rows) {
        if (spec.metricKey() == null) {
            return new Dimension(spec.dimension(), spec.label(), "NOT_SUPPORTED", spec.unsupportedReason(), null, null,
                    spec.apiField(), null, null, null, null, a.isDemo(), List.of());
        }
        if (!a.has(Capability.AUDIENCE_INSIGHTS)) {
            return new Dimension(spec.dimension(), spec.label(), "PERMISSION_MISSING",
                    "The insights permission was not granted for this account. Reconnect and approve insights access.",
                    spec.metricKey(), null, spec.apiField(), null, null, null, null, a.isDemo(), List.of());
        }
        List<DimensionRow> mine = rows.stream().filter(r -> r.metricKey().equals(spec.metricKey())).toList();
        Map<String, BigDecimal> buckets = new LinkedHashMap<>();
        DimensionRow sample = null;
        String blocked = null;
        for (DimensionRow r : mine) {
            Map<String, String> d = parse(r.dimensions());
            String key = d.get(spec.dimField());
            if (key == null) continue;
            if (!"AVAILABLE".equals(r.availability()) || r.value() == null) {
                blocked = r.availability();
                sample = r;
                continue;
            }
            sample = r;
            buckets.merge(key, r.value(), BigDecimal::add); // marginalise e.g. ageGroup×gender → ageGroup
        }
        if (buckets.isEmpty()) {
            String availability = blocked != null ? blocked : "NO_DATA";
            String reason = switch (availability) {
                case "NOT_ENOUGH_DATA" -> a.getProvider() == Provider.INSTAGRAM
                        ? "Instagram only returns follower demographics for accounts with at least 100 followers."
                        : "The provider did not return enough data for this breakdown.";
                case "PERMISSION_MISSING" -> "The provider reported that the required permission is missing.";
                case "DELAYED" -> "The provider has not finished processing this report yet.";
                default -> "No audience snapshot has been synced yet. Run a sync from Connected Accounts.";
            };
            return new Dimension(spec.dimension(), spec.label(), availability, reason, spec.metricKey(), null,
                    spec.apiField(), sample == null ? null : sample.date(), sample == null ? null : sample.window(),
                    sample == null ? null : sample.fetchedAt(), sample == null ? null : sample.sourceEndpoint(),
                    a.isDemo(), List.of());
        }
        BigDecimal total = buckets.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean percent = spec.metricKey().equals("youtube.viewer_percentage");
        List<Bucket> out = buckets.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(e -> new Bucket(e.getKey(), label(spec.dimension(), e.getKey()), e.getValue(),
                        percent ? e.getValue().setScale(1, RoundingMode.HALF_UP)
                                : total.signum() == 0 ? null : e.getValue().multiply(BigDecimal.valueOf(100))
                                .divide(total, 1, RoundingMode.HALF_UP)))
                .toList();
        if (spec.dimension().equals("age")) {
            out = out.stream().sorted(Comparator.comparing(Bucket::key)).toList();
        }
        return new Dimension(spec.dimension(), spec.label(), "AVAILABLE", null, spec.metricKey(),
                percent ? "PERCENT" : "COUNT", spec.apiField(), sample.date(), sample.window(), sample.fetchedAt(),
                sample.sourceEndpoint(), sample.demo(), out);
    }

    private Map<String, String> parse(String json) {
        try {
            return mapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    static String label(String dimension, String key) {
        return switch (dimension) {
            case "age" -> key.replace("age", "").replace("65-", "65+");
            case "gender" -> switch (key) {
                case "F", "female" -> "Female";
                case "M", "male" -> "Male";
                case "U" -> "Unspecified";
                case "user_specified" -> "User-specified";
                default -> key;
            };
            default -> key;
        };
    }
}
