package com.bloom.planly;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class PlanlyDtos {
    private PlanlyDtos() {}

    public record TaskRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 5000) String description,
            LocalDate dueDate,
            LocalTime dueTime,
            Task.Priority priority,
            Task.Status status,
            Recurrence recurrence,
            LocalDate recurrenceUntil,
            UUID goalId,
            UUID contentDraftId) {}

    public record StatusRequest(@NotNull Task.Status status) {}

    /** Moves a task to another day (or removes its date when {@code dueDate} is null). */
    public record RescheduleRequest(LocalDate dueDate, LocalTime dueTime) {}

    public record SubtaskRequest(@NotBlank @Size(max = 200) String title, Boolean done, Integer position) {}

    public record SubtaskView(UUID id, String title, boolean done, int position) {
        static SubtaskView of(Subtask s) {
            return new SubtaskView(s.getId(), s.getTitle(), s.isDone(), s.getPosition());
        }
    }

    public record TaskView(UUID id, String title, String description, LocalDate dueDate, LocalTime dueTime,
                           Task.Priority priority, Task.Status status, Recurrence recurrence, LocalDate recurrenceUntil,
                           UUID goalId, String goalTitle, UUID contentDraftId, boolean overdue, Instant completedAt,
                           List<SubtaskView> subtasks, Instant createdAt, Instant updatedAt) {}

    /** Result of a status change; {@code nextOccurrence} is set when completing a recurring task created one. */
    public record StatusChangeResult(TaskView task, TaskView nextOccurrence) {}

    public record PlanRequest(@Size(max = 300) String focus) {}

    public record PlanView(LocalDate date, String focus, Instant updatedAt) {}

    /** {@code version} must echo the version last read; a mismatch means another tab saved first. */
    public record NoteRequest(@NotNull @Size(max = 50_000) String body, @NotNull Integer version) {}

    public record NoteView(LocalDate date, String body, int version, Instant updatedAt) {}

    public record DayView(LocalDate date, boolean today, PlanView plan, NoteView note, List<TaskView> tasks) {}

    public record CalendarDay(LocalDate date, int openTasks, int doneTasks, boolean hasNote, String focus) {}

    /** Everything the month/week/agenda views need for a date window in one request. */
    public record CalendarView(LocalDate from, LocalDate to, LocalDate today, String timezone, List<CalendarDay> days,
                               List<TaskView> tasks, List<TaskView> undated, List<TaskView> overdue) {}
}
