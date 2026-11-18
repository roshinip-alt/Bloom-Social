package com.bloom.dashboard;

import com.bloom.analytics.AnalyticsService;
import com.bloom.common.DateRange;
import com.bloom.dashboard.DashboardDtos.DashboardResponse;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardService service;
    private final AnalyticsService analytics;

    public DashboardController(DashboardService service, AnalyticsService analytics) {
        this.service = service;
        this.analytics = analytics;
    }

    /** Defaults to the 28 days ending yesterday; {@code accountId} narrows to one account. */
    @GetMapping
    public DashboardResponse dashboard(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                       @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                                       @RequestParam(required = false) UUID accountId) {
        return service.dashboard(DateRange.orDefault(from, to, analytics.today()), accountId);
    }
}
