package com.bloom.planly;

import java.time.LocalDate;
import java.util.Optional;

/** How a task repeats. Completing a recurring task creates its next occurrence (date arithmetic only). */
public enum Recurrence {
    NONE, DAILY, WEEKLY, MONTHLY;

    /** The next due date after {@code due}, or empty when the task does not repeat or the series has ended. */
    public Optional<LocalDate> next(LocalDate due, LocalDate until) {
        if (this == NONE || due == null) return Optional.empty();
        LocalDate next = switch (this) {
            case DAILY -> due.plusDays(1);
            case WEEKLY -> due.plusWeeks(1);
            case MONTHLY -> due.plusMonths(1);
            case NONE -> throw new IllegalStateException();
        };
        return until != null && next.isAfter(until) ? Optional.empty() : Optional.of(next);
    }
}
