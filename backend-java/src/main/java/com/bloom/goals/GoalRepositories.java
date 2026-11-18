package com.bloom.goals;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface GoalRepository extends JpaRepository<Goal, UUID> {
    List<Goal> findByWorkspaceIdOrderByDeadlineAscCreatedAtAsc(UUID workspaceId);

    List<Goal> findByWorkspaceIdAndStatusInOrderByDeadlineAscCreatedAtAsc(UUID workspaceId, Collection<Goal.Status> statuses);

    Optional<Goal> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    List<Goal> findByLinkedAccountIdAndStatus(UUID accountId, Goal.Status status);
}

interface GoalMilestoneRepository extends JpaRepository<GoalMilestone, UUID> {
    List<GoalMilestone> findByGoalIdOrderByPositionAsc(UUID goalId);

    List<GoalMilestone> findByGoalIdIn(Collection<UUID> goalIds);
}

interface GoalProgressEntryRepository extends JpaRepository<GoalProgressEntry, UUID> {
    List<GoalProgressEntry> findByGoalIdOrderByRecordedAtDesc(UUID goalId, Pageable pageable);

    List<GoalProgressEntry> findByGoalIdOrderByRecordedAtAsc(UUID goalId);
}
