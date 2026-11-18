package com.bloom.analytics;

import com.bloom.common.DateRange;
import com.bloom.analytics.AnalyticsDtos.*;
import com.bloom.common.api.PageResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AnalyticsController {
    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/analytics/metrics")
    public List<MetricDefinitionView> metrics(@RequestParam(required = false) String provider) {
        return service.definitions(provider);
    }

    @GetMapping("/analytics/summary")
    public SummaryResponse summary(@RequestParam(required = false) List<UUID> accountIds,
                                   @RequestParam(required = false) String provider,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.summary(accountIds, provider, DateRange.orDefault(from, to, service.today()));
    }

    @GetMapping("/analytics/series")
    public SeriesResponse series(@RequestParam UUID accountId, @RequestParam String metricKey,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.series(accountId, metricKey, DateRange.orDefault(from, to, service.today()));
    }

    @GetMapping("/posts")
    public PageResponse<PostView> posts(@RequestParam(required = false) List<UUID> accountIds,
                                        @RequestParam(required = false) String provider,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(required = false) String contentType,
                                        @RequestParam(required = false) String sortMetric,
                                        @RequestParam(defaultValue = "desc") String direction,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "25") int size) {
        LocalDate end = to != null ? to : service.today();
        LocalDate start = from != null ? from : end.minusDays(89);
        return service.posts(accountIds, provider, new DateRange(start, end), contentType, sortMetric,
                !"asc".equalsIgnoreCase(direction), page, size);
    }
}
