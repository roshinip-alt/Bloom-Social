package com.bloom.planly;

import com.bloom.common.DateRange;
import com.bloom.planly.PlanlyDtos.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/planly")
public class PlanlyController {
    private final PlanlyService service;

    public PlanlyController(PlanlyService service) {
        this.service = service;
    }

    /** Month, week, day and agenda views all read this window (defaults to the 7 days from today). */
    @GetMapping("/calendar")
    public CalendarView calendar(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                                 @RequestParam(required = false) Task.Status status,
                                 @RequestParam(required = false) Task.Priority priority,
                                 @RequestParam(required = false) UUID goalId) {
        LocalDate start = from != null ? from : service.today();
        LocalDate end = to != null ? to : start.plusDays(6);
        return service.calendar(new DateRange(start, end), status, priority, goalId);
    }

    @GetMapping("/days/{date}")
    public DayView day(@PathVariable @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
        return service.day(date);
    }

    @PutMapping("/days/{date}/plan")
    public PlanView savePlan(@PathVariable @DateTimeFormat(iso = ISO.DATE) LocalDate date, @Valid @RequestBody PlanRequest body) {
        return service.savePlan(date, body);
    }

    @PutMapping("/days/{date}/note")
    public NoteView saveNote(@PathVariable @DateTimeFormat(iso = ISO.DATE) LocalDate date, @Valid @RequestBody NoteRequest body) {
        return service.saveNote(date, body);
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskView create(@Valid @RequestBody TaskRequest body) {
        return service.create(body);
    }

    @PutMapping("/tasks/{id}")
    public TaskView update(@PathVariable UUID id, @Valid @RequestBody TaskRequest body) {
        return service.update(id, body);
    }

    @PatchMapping("/tasks/{id}/status")
    public StatusChangeResult status(@PathVariable UUID id, @Valid @RequestBody StatusRequest body) {
        return service.changeStatus(id, body.status());
    }

    @PatchMapping("/tasks/{id}/schedule")
    public TaskView reschedule(@PathVariable UUID id, @RequestBody RescheduleRequest body) {
        return service.reschedule(id, body);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PostMapping("/tasks/{id}/subtasks")
    @ResponseStatus(HttpStatus.CREATED)
    public SubtaskView addSubtask(@PathVariable UUID id, @Valid @RequestBody SubtaskRequest body) {
        return service.addSubtask(id, body);
    }

    @PutMapping("/tasks/{id}/subtasks/{subtaskId}")
    public SubtaskView updateSubtask(@PathVariable UUID id, @PathVariable UUID subtaskId, @Valid @RequestBody SubtaskRequest body) {
        return service.updateSubtask(id, subtaskId, body);
    }

    @DeleteMapping("/tasks/{id}/subtasks/{subtaskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubtask(@PathVariable UUID id, @PathVariable UUID subtaskId) {
        service.deleteSubtask(id, subtaskId);
    }
}
