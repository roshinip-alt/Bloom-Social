package com.bloom.goals;

import com.bloom.goals.GoalDtos.*;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/goals")
public class GoalController {
    private final GoalService service;

    public GoalController(GoalService service) {
        this.service = service;
    }

    @GetMapping
    public List<GoalView> list(@RequestParam(required = false) List<Goal.Status> status) {
        return service.list(status);
    }

    @GetMapping("/{id}")
    public GoalView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GoalView create(@Valid @RequestBody GoalRequest body) {
        return service.create(body);
    }

    @PutMapping("/{id}")
    public GoalView update(@PathVariable UUID id, @Valid @RequestBody GoalRequest body) {
        return service.update(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PostMapping("/{id}/complete")
    public GoalView complete(@PathVariable UUID id) {
        return service.setStatus(id, Goal.Status.COMPLETED);
    }

    @PostMapping("/{id}/archive")
    public GoalView archive(@PathVariable UUID id) {
        return service.setStatus(id, Goal.Status.ARCHIVED);
    }

    @PostMapping("/{id}/reopen")
    public GoalView reopen(@PathVariable UUID id) {
        return service.setStatus(id, Goal.Status.ACTIVE);
    }

    @GetMapping("/{id}/progress")
    public List<ProgressView> history(@PathVariable UUID id, @RequestParam(defaultValue = "100") int limit) {
        return service.history(id, limit);
    }

    @PostMapping("/{id}/progress")
    @ResponseStatus(HttpStatus.CREATED)
    public GoalView recordProgress(@PathVariable UUID id, @Valid @RequestBody ProgressRequest body) {
        return service.recordProgress(id, body);
    }

    @DeleteMapping("/{id}/progress/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProgress(@PathVariable UUID id, @PathVariable UUID entryId) {
        service.deleteProgress(id, entryId);
    }

    @PostMapping("/{id}/milestones")
    @ResponseStatus(HttpStatus.CREATED)
    public MilestoneView addMilestone(@PathVariable UUID id, @Valid @RequestBody MilestoneRequest body) {
        return service.addMilestone(id, body);
    }

    @PutMapping("/{id}/milestones/{milestoneId}")
    public MilestoneView updateMilestone(@PathVariable UUID id, @PathVariable UUID milestoneId,
                                         @Valid @RequestBody MilestoneRequest body) {
        return service.updateMilestone(id, milestoneId, body);
    }

    @DeleteMapping("/{id}/milestones/{milestoneId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMilestone(@PathVariable UUID id, @PathVariable UUID milestoneId) {
        service.deleteMilestone(id, milestoneId);
    }
}
