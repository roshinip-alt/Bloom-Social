package com.bloom.planly;

import com.bloom.auth.CurrentWorkspace;
import com.bloom.common.DateRange;
import com.bloom.common.persistence.Ids;
import com.bloom.exception.BloomException;
import com.bloom.planly.PlanlyDtos.*;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Planly: tasks, subtasks, recurrence, daily plans and notes. "Today" is always computed in the workspace timezone,
 * so a task due on a date stays on that date regardless of the viewer's clock.
 */
@Service
@Transactional
public class PlanlyService {
    private static final List<Task.Status> OPEN = List.of(Task.Status.TODO, Task.Status.IN_PROGRESS);

    private final TaskRepository tasks;
    private final SubtaskRepository subtasks;
    private final DailyPlanRepository plans;
    private final DailyNoteRepository notes;
    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentWorkspace workspace;
    private final Clock clock;

    public PlanlyService(TaskRepository tasks, SubtaskRepository subtasks, DailyPlanRepository plans,
                         DailyNoteRepository notes, NamedParameterJdbcTemplate jdbc, CurrentWorkspace workspace,
                         Clock clock) {
        this.tasks = tasks;
        this.subtasks = subtasks;
        this.plans = plans;
        this.notes = notes;
        this.jdbc = jdbc;
        this.workspace = workspace;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(workspace.zone()));
    }

    // ---------------------------------------------------------------- reads

    @Transactional(readOnly = true)
    public CalendarView calendar(DateRange range, Task.Status status, Task.Priority priority, UUID goalId) {
        UUID ws = workspace.id();
        LocalDate today = today();
        List<Task> inRange = filter(tasks.findInRange(ws, range.from(), range.to(), true), status, priority, goalId);
        List<Task> dated = inRange.stream().filter(t -> t.getDueDate() != null).toList();
        List<Task> undated = inRange.stream().filter(t -> t.getDueDate() == null).toList();
        List<Task> overdue = filter(tasks.findOverdue(ws, today, OPEN), status, priority, goalId);

        Map<LocalDate, String> focus = plans.findByWorkspaceIdAndPlanDateBetween(ws, range.from(), range.to()).stream()
                .filter(p -> p.getFocus() != null && !p.getFocus().isBlank())
                .collect(Collectors.toMap(DailyPlan::getPlanDate, DailyPlan::getFocus));
        Set<LocalDate> noteDates = new HashSet<>(notes.findNonEmptyDates(ws, range.from(), range.to()));
        Map<LocalDate, List<Task>> byDate = dated.stream().collect(Collectors.groupingBy(Task::getDueDate));

        List<CalendarDay> days = new ArrayList<>();
        for (LocalDate d = range.from(); !d.isAfter(range.to()); d = d.plusDays(1)) {
            List<Task> ts = byDate.getOrDefault(d, List.of());
            days.add(new CalendarDay(d, (int) ts.stream().filter(Task::isOpen).count(),
                    (int) ts.stream().filter(t -> t.getStatus() == Task.Status.DONE).count(),
                    noteDates.contains(d), focus.get(d)));
        }
        List<Task> all = new ArrayList<>(inRange);
        all.addAll(overdue);
        Map<UUID, TaskView> views = views(all, today).stream().collect(Collectors.toMap(TaskView::id, Function.identity(), (a, b) -> a));
        return new CalendarView(range.from(), range.to(), today, workspace.workspace().getTimezone(), days,
                dated.stream().map(t -> views.get(t.getId())).toList(),
                undated.stream().map(t -> views.get(t.getId())).toList(),
                overdue.stream().map(t -> views.get(t.getId())).toList());
    }

    @Transactional(readOnly = true)
    public DayView day(LocalDate date) {
        UUID ws = workspace.id();
        LocalDate today = today();
        PlanView plan = plans.findByWorkspaceIdAndPlanDate(ws, date)
                .map(p -> new PlanView(date, p.getFocus(), p.getUpdatedAt())).orElse(new PlanView(date, null, null));
        NoteView note = notes.findByWorkspaceIdAndNoteDate(ws, date)
                .map(n -> new NoteView(date, n.getBody(), n.getVersion(), n.getUpdatedAt()))
                .orElse(new NoteView(date, "", -1, null));
        return new DayView(date, date.equals(today), plan, note, views(tasks.findInRange(ws, date, date, false), today));
    }

    @Transactional(readOnly = true)
    public List<TaskView> upcoming(int days, int limit) {
        LocalDate today = today();
        return views(tasks.findInRange(workspace.id(), today, today.plusDays(days), false).stream()
                .filter(Task::isOpen).limit(limit).toList(), today);
    }

    @Transactional(readOnly = true)
    public long overdueCount() {
        return tasks.findOverdue(workspace.id(), today(), OPEN).size();
    }

    // ---------------------------------------------------------------- tasks

    public TaskView create(TaskRequest req) {
        Task t = new Task(Ids.newId(), workspace.id());
        apply(t, req);
        tasks.save(t);
        return view(t);
    }

    public TaskView update(UUID id, TaskRequest req) {
        Task t = owned(id);
        apply(t, req);
        return view(t);
    }

    public StatusChangeResult changeStatus(UUID id, Task.Status status) {
        Task t = owned(id);
        boolean completing = status == Task.Status.DONE && t.getStatus() != Task.Status.DONE;
        t.setStatus(status);
        t.setCompletedAt(status == Task.Status.DONE ? clock.instant() : null);
        TaskView next = null;
        if (completing) {
            next = t.getRecurrence().next(t.getDueDate(), t.getRecurrenceUntil()).map(date -> {
                Task n = new Task(Ids.newId(), t.getWorkspaceId());
                n.setTitle(t.getTitle());
                n.setDescription(t.getDescription());
                n.setPriority(t.getPriority());
                n.setDueDate(date);
                n.setDueTime(t.getDueTime());
                n.setRecurrence(t.getRecurrence());
                n.setRecurrenceUntil(t.getRecurrenceUntil());
                n.setRecurrenceSourceId(t.getId());
                n.setGoalId(t.getGoalId());
                tasks.save(n);
                List<Subtask> template = subtasks.findByTaskIdOrderByPositionAsc(t.getId());
                template.forEach(s -> subtasks.save(new Subtask(Ids.newId(), n.getId(), s.getTitle(), s.getPosition(), clock.instant())));
                return view(n);
            }).orElse(null);
        }
        return new StatusChangeResult(view(t), next);
    }

    public TaskView reschedule(UUID id, RescheduleRequest req) {
        Task t = owned(id);
        if (req.dueDate() == null && t.getRecurrence() != Recurrence.NONE) {
            throw BloomException.badRequest("RECURRING_NEEDS_DATE", "A recurring task needs a due date");
        }
        t.setDueDate(req.dueDate());
        t.setDueTime(req.dueDate() == null ? null : req.dueTime());
        return view(t);
    }

    public void delete(UUID id) {
        tasks.delete(owned(id));
    }

    // ---------------------------------------------------------------- subtasks

    public SubtaskView addSubtask(UUID taskId, SubtaskRequest req) {
        owned(taskId);
        int next = subtasks.findByTaskIdOrderByPositionAsc(taskId).stream().mapToInt(Subtask::getPosition).max().orElse(-1) + 1;
        Subtask s = new Subtask(Ids.newId(), taskId, req.title().trim(), req.position() != null ? req.position() : next, clock.instant());
        s.setDone(Boolean.TRUE.equals(req.done()));
        return SubtaskView.of(subtasks.save(s));
    }

    public SubtaskView updateSubtask(UUID taskId, UUID subtaskId, SubtaskRequest req) {
        Subtask s = ownedSubtask(taskId, subtaskId);
        s.setTitle(req.title().trim());
        if (req.done() != null) s.setDone(req.done());
        if (req.position() != null) s.setPosition(req.position());
        return SubtaskView.of(s);
    }

    public void deleteSubtask(UUID taskId, UUID subtaskId) {
        subtasks.delete(ownedSubtask(taskId, subtaskId));
    }

    // ---------------------------------------------------------------- plans & notes

    public PlanView savePlan(LocalDate date, PlanRequest req) {
        DailyPlan p = plans.findByWorkspaceIdAndPlanDate(workspace.id(), date)
                .orElseGet(() -> new DailyPlan(Ids.newId(), workspace.id(), date));
        p.setFocus(req.focus() == null || req.focus().isBlank() ? null : req.focus().trim());
        plans.saveAndFlush(p);
        return new PlanView(date, p.getFocus(), p.getUpdatedAt());
    }

    /** Autosave target. Rejects stale versions with 409 STALE_VERSION so the UI can show a conflict. */
    public NoteView saveNote(LocalDate date, NoteRequest req) {
        Optional<DailyNote> existing = notes.findByWorkspaceIdAndNoteDate(workspace.id(), date);
        DailyNote n;
        if (existing.isPresent()) {
            n = existing.get();
            if (n.getVersion() != req.version()) {
                throw BloomException.conflict("STALE_VERSION", "This note was changed in another tab. Reload to see the latest text.");
            }
        } else {
            if (req.version() != -1) {
                throw BloomException.conflict("STALE_VERSION", "This note was deleted elsewhere. Reload to continue.");
            }
            n = new DailyNote(Ids.newId(), workspace.id(), date);
        }
        n.setBody(req.body());
        notes.saveAndFlush(n);
        return new NoteView(date, n.getBody(), n.getVersion(), n.getUpdatedAt());
    }

    // ---------------------------------------------------------------- helpers

    private void apply(Task t, TaskRequest req) {
        Recurrence recurrence = req.recurrence() == null ? Recurrence.NONE : req.recurrence();
        if (recurrence != Recurrence.NONE && req.dueDate() == null) {
            throw BloomException.badRequest("RECURRING_NEEDS_DATE", "A recurring task needs a due date");
        }
        if (req.dueTime() != null && req.dueDate() == null) {
            throw BloomException.badRequest("TIME_NEEDS_DATE", "Set a due date before adding a time");
        }
        if (req.goalId() != null) requireInWorkspace("goal", req.goalId(), "Goal");
        if (req.contentDraftId() != null) requireInWorkspace("content_draft", req.contentDraftId(), "Content draft");
        t.setTitle(req.title().trim());
        t.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());
        t.setDueDate(req.dueDate());
        t.setDueTime(req.dueTime());
        t.setPriority(req.priority() == null ? Task.Priority.MEDIUM : req.priority());
        if (req.status() != null && req.status() != t.getStatus()) {
            t.setStatus(req.status());
            t.setCompletedAt(req.status() == Task.Status.DONE ? clock.instant() : null);
        }
        t.setRecurrence(recurrence);
        t.setRecurrenceUntil(recurrence == Recurrence.NONE ? null : req.recurrenceUntil());
        t.setGoalId(req.goalId());
        t.setContentDraftId(req.contentDraftId());
    }

    private void requireInWorkspace(String table, UUID id, String label) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE id = :id AND workspace_id = :ws",
                new MapSqlParameterSource("id", id).addValue("ws", workspace.id()), Integer.class);
        if (n == null || n == 0) throw BloomException.notFound(label);
    }

    private static List<Task> filter(List<Task> list, Task.Status status, Task.Priority priority, UUID goalId) {
        return list.stream()
                .filter(t -> status == null || t.getStatus() == status)
                .filter(t -> priority == null || t.getPriority() == priority)
                .filter(t -> goalId == null || goalId.equals(t.getGoalId()))
                .toList();
    }

    private TaskView view(Task t) {
        return views(List.of(t), today()).get(0);
    }

    private List<TaskView> views(List<Task> list, LocalDate today) {
        if (list.isEmpty()) return List.of();
        Map<UUID, List<Subtask>> subs = subtasks.findByTaskIdInOrderByPositionAsc(list.stream().map(Task::getId).toList())
                .stream().collect(Collectors.groupingBy(Subtask::getTaskId));
        Set<UUID> goalIds = list.stream().map(Task::getGoalId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> goalTitles = new HashMap<>();
        if (!goalIds.isEmpty()) {
            jdbc.query("SELECT id, title FROM goal WHERE id IN (:ids)", new MapSqlParameterSource("ids", goalIds),
                    rs -> { goalTitles.put(rs.getObject(1, UUID.class), rs.getString(2)); });
        }
        return list.stream().map(t -> new TaskView(t.getId(), t.getTitle(), t.getDescription(), t.getDueDate(),
                t.getDueTime(), t.getPriority(), t.getStatus(), t.getRecurrence(), t.getRecurrenceUntil(), t.getGoalId(),
                goalTitles.get(t.getGoalId()), t.getContentDraftId(),
                t.isOpen() && t.getDueDate() != null && t.getDueDate().isBefore(today), t.getCompletedAt(),
                subs.getOrDefault(t.getId(), List.of()).stream().map(SubtaskView::of).toList(),
                t.getCreatedAt(), t.getUpdatedAt())).toList();
    }

    private Task owned(UUID id) {
        return tasks.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Task"));
    }

    private Subtask ownedSubtask(UUID taskId, UUID subtaskId) {
        owned(taskId);
        return subtasks.findById(subtaskId).filter(s -> s.getTaskId().equals(taskId))
                .orElseThrow(() -> BloomException.notFound("Subtask"));
    }
}
