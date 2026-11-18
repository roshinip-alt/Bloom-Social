package com.bloom.audience;

import com.bloom.analytics.AnalyticsService;
import com.bloom.common.DateRange;
import com.bloom.audience.AudienceDtos.AudienceResponse;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audience")
public class AudienceController {
    private final AudienceService service;
    private final AnalyticsService analytics;

    public AudienceController(AudienceService service, AnalyticsService analytics) {
        this.service = service;
        this.analytics = analytics;
    }

    @GetMapping
    public AudienceResponse audience(@RequestParam UUID accountId,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : analytics.today().minusDays(1);
        return service.forAccount(accountId, new DateRange(from != null ? from : end.minusDays(89), end));
    }
}
