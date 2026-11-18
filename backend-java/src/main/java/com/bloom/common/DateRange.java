package com.bloom.common;

import com.bloom.exception.BloomException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Inclusive date range with the equal-length immediately preceding comparison period. */
public record DateRange(LocalDate from, LocalDate to) {
    public static final int MAX_DAYS = 731;

    public DateRange {
        if (from.isAfter(to)) throw BloomException.badRequest("INVALID_RANGE", "'from' must not be after 'to'");
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw BloomException.badRequest("RANGE_TOO_LARGE", "Ranges are limited to " + MAX_DAYS + " days");
        }
    }

    /** Defaults to the 28 days ending yesterday (provider reports are delayed; "today" is never complete). */
    public static DateRange orDefault(LocalDate from, LocalDate to, LocalDate today) {
        LocalDate end = to != null ? to : today.minusDays(1);
        LocalDate start = from != null ? from : end.minusDays(27);
        return new DateRange(start, end);
    }

    public long days() {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }

    public DateRange previous() {
        return new DateRange(from.minusDays(days()), from.minusDays(1));
    }
}
