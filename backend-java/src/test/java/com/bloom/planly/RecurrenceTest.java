package com.bloom.planly;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RecurrenceTest {
    private static final LocalDate JAN_31 = LocalDate.of(2026, 1, 31);

    @Test
    void computesNextOccurrence() {
        assertThat(Recurrence.DAILY.next(JAN_31, null)).contains(LocalDate.of(2026, 2, 1));
        assertThat(Recurrence.WEEKLY.next(JAN_31, null)).contains(LocalDate.of(2026, 2, 7));
        // Month arithmetic clamps to the last valid day instead of overflowing into March.
        assertThat(Recurrence.MONTHLY.next(JAN_31, null)).contains(LocalDate.of(2026, 2, 28));
    }

    @Test
    void stopsAtUntilDateAndForNonRecurring() {
        assertThat(Recurrence.DAILY.next(JAN_31, JAN_31)).isEmpty();
        assertThat(Recurrence.NONE.next(JAN_31, null)).isEmpty();
        assertThat(Recurrence.WEEKLY.next(null, null)).isEmpty();
    }
}
