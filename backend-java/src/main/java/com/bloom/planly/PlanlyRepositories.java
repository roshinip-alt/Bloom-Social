package com.bloom.planly;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface TaskRepository extends JpaRepository<Task, UUID> {
    Optional<Task> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Query("""
            select t from Task t where t.workspaceId = :ws
               and ((t.dueDate between :from and :to) or (:includeUndated = true and t.dueDate is null))
             order by t.dueDate asc nulls last, t.dueTime asc nulls last, t.createdAt asc""")
    List<Task> findInRange(UUID ws, LocalDate from, LocalDate to, boolean includeUndated);

    @Query("""
            select t from Task t where t.workspaceId = :ws and t.status in :statuses
               and t.dueDate is not null and t.dueDate < :before order by t.dueDate asc""")
    List<Task> findOverdue(UUID ws, LocalDate before, Collection<Task.Status> statuses);

    long countByWorkspaceIdAndGoalIdAndStatus(UUID workspaceId, UUID goalId, Task.Status status);
}

interface SubtaskRepository extends JpaRepository<Subtask, UUID> {
    List<Subtask> findByTaskIdInOrderByPositionAsc(Collection<UUID> taskIds);

    List<Subtask> findByTaskIdOrderByPositionAsc(UUID taskId);
}

interface DailyPlanRepository extends JpaRepository<DailyPlan, UUID> {
    Optional<DailyPlan> findByWorkspaceIdAndPlanDate(UUID workspaceId, LocalDate date);

    List<DailyPlan> findByWorkspaceIdAndPlanDateBetween(UUID workspaceId, LocalDate from, LocalDate to);
}

interface DailyNoteRepository extends JpaRepository<DailyNote, UUID> {
    Optional<DailyNote> findByWorkspaceIdAndNoteDate(UUID workspaceId, LocalDate date);

    @Query("select n.noteDate from DailyNote n where n.workspaceId = :ws and n.noteDate between :from and :to and n.body <> ''")
    List<LocalDate> findNonEmptyDates(UUID ws, LocalDate from, LocalDate to);
}
