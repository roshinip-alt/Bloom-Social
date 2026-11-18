package com.bloom.goals;

import com.bloom.analytics.AnalyticsQueries;
import com.bloom.analytics.MetricDefinition;
import com.bloom.analytics.MetricDefinitionRepository;
import com.bloom.auth.CurrentWorkspace;
import com.bloom.common.persistence.Ids;
import com.bloom.exception.BloomException;
import com.bloom.goals.GoalDtos.*;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectedSocialAccountRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class GoalService {
    private final GoalRepository goals;
    private final GoalMilestoneRepository milestones;
    private final GoalProgressEntryRepository entries;
    private final GoalProgressService progress;
    private final MetricDefinitionRepository definitions;
    private final AnalyticsQueries queries;
    private final ConnectedSocialAccountRepository accounts;
    private final CurrentWorkspace workspace;
    private final Clock clock;

    public GoalService(GoalRepository goals, GoalMilestoneRepository milestones, GoalProgressEntryRepository entries,
                       GoalProgressService progress, MetricDefinitionRepository definitions, AnalyticsQueries queries,
                       ConnectedSocialAccountRepository accounts, CurrentWorkspace workspace, Clock clock) {
        this.goals = goals;
        this.milestones = milestones;
        this.entries = entries;
        this.progress = progress;
        this.definitions = definitions;
        this.queries = queries;
        this.accounts = accounts;
        this.workspace = workspace;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<GoalView> list(List<Goal.Status> statuses) {
        List<Goal> found = statuses == null || statuses.isEmpty()
                ? goals.findByWorkspaceIdOrderByDeadlineAscCreatedAtAsc(workspace.id())
                : goals.findByWorkspaceIdAndStatusInOrderByDeadlineAscCreatedAtAsc(workspace.id(), statuses);
        Map<UUID, List<GoalMilestone>> ms = milestones.findByGoalIdIn(found.stream().map(Goal::getId).toList()).stream()
                .collect(Collectors.groupingBy(GoalMilestone::getGoalId));
        LocalDate today = today();
        return found.stream().map(g -> view(g, ms.getOrDefault(g.getId(), List.of()), today)).toList();
    }

    @Transactional(readOnly = true)
    public GoalView get(UUID id) {
        Goal g = owned(id);
        return view(g, milestones.findByGoalIdOrderByPositionAsc(id), today());
    }

    public GoalView create(GoalRequest req) {
        Goal g = new Goal(Ids.newId(), workspace.id());
        apply(g, req);
        goals.save(g);
        progress.refresh(g);
        return get(g.getId());
    }

    public GoalView update(UUID id, GoalRequest req) {
        Goal g = owned(id);
        apply(g, req);
        progress.refresh(g);
        return get(id);
    }

    public void delete(UUID id) {
        goals.delete(owned(id));
    }

    public GoalView setStatus(UUID id, Goal.Status status) {
        Goal g = owned(id);
        g.setStatus(status);
        g.setCompletedAt(status == Goal.Status.COMPLETED ? clock.instant() : null);
        return get(id);
    }

    public GoalView recordProgress(UUID id, ProgressRequest req) {
        Goal g = owned(id);
        if (g.getProgressSource() == Goal.ProgressSource.ANALYTICS) {
            throw BloomException.conflict("PROGRESS_IS_ANALYTICS_LINKED",
                    "This goal's progress comes from synced analytics and cannot be edited manually");
        }
        g.setCurrentValue(req.value());
        entries.save(new GoalProgressEntry(Ids.newId(), id, req.value(), Goal.ProgressSource.MANUAL,
                blankToNull(req.note()), clock.instant()));
        return get(id);
    }

    @Transactional(readOnly = true)
    public List<ProgressView> history(UUID id, int limit) {
        owned(id);
        return entries.findByGoalIdOrderByRecordedAtDesc(id, PageRequest.of(0, Math.min(Math.max(limit, 1), 500)))
                .stream().map(ProgressView::of).toList();
    }

    public void deleteProgress(UUID goalId, UUID entryId) {
        Goal g = owned(goalId);
        GoalProgressEntry e = entries.findById(entryId).filter(x -> x.getGoalId().equals(goalId))
                .orElseThrow(() -> BloomException.notFound("Progress entry"));
        if (e.getSource() == Goal.ProgressSource.ANALYTICS) {
            throw BloomException.conflict("PROGRESS_IS_ANALYTICS_LINKED", "Synced progress entries cannot be deleted");
        }
        entries.delete(e);
        entries.flush();
        g.setCurrentValue(entries.findByGoalIdOrderByRecordedAtDesc(goalId, PageRequest.of(0, 1)).stream()
                .findFirst().map(GoalProgressEntry::getValue).orElse(g.getStartValue()));
    }

    // ---------------------------------------------------------------- milestones

    public MilestoneView addMilestone(UUID goalId, MilestoneRequest req) {
        owned(goalId);
        GoalMilestone m = new GoalMilestone(Ids.newId(), goalId, clock.instant());
        int next = milestones.findByGoalIdOrderByPositionAsc(goalId).stream()
                .mapToInt(GoalMilestone::getPosition).max().orElse(-1) + 1;
        m.setPosition(req.position() != null ? req.position() : next);
        applyMilestone(m, req);
        return MilestoneView.of(milestones.save(m));
    }

    public MilestoneView updateMilestone(UUID goalId, UUID milestoneId, MilestoneRequest req) {
        GoalMilestone m = ownedMilestone(goalId, milestoneId);
        if (req.position() != null) m.setPosition(req.position());
        applyMilestone(m, req);
        return MilestoneView.of(m);
    }

    public void deleteMilestone(UUID goalId, UUID milestoneId) {
        milestones.delete(ownedMilestone(goalId, milestoneId));
    }

    // ---------------------------------------------------------------- helpers

    private void apply(Goal g, GoalRequest req) {
        if (req.deadline() != null && req.deadline().isBefore(req.startDate())) {
            throw BloomException.badRequest("INVALID_DATES", "The deadline must be on or after the start date");
        }
        BigDecimal start = req.startValue() == null ? BigDecimal.ZERO : req.startValue();
        if (req.targetValue().compareTo(start) == 0) {
            throw BloomException.badRequest("INVALID_TARGET", "The target must differ from the starting value");
        }
        Goal.ProgressSource source = req.progressSource() == null ? Goal.ProgressSource.MANUAL : req.progressSource();
        g.setTitle(req.title().trim());
        g.setCategory(req.category());
        g.setDescription(blankToNull(req.description()));
        g.setUnit(req.unit().trim());
        g.setStartValue(start);
        g.setTargetValue(req.targetValue());
        g.setStartDate(req.startDate());
        g.setDeadline(req.deadline());
        if (source == Goal.ProgressSource.ANALYTICS) {
            validateAnalyticsLink(req);
            g.setLinkedAccountId(req.linkedAccountId());
            g.setLinkedMetricKey(req.linkedMetricKey());
        } else {
            if (g.getProgressSource() == Goal.ProgressSource.ANALYTICS) {
                g.setCurrentValue(start);
            }
            g.setLinkedAccountId(null);
            g.setLinkedMetricKey(null);
        }
        g.setProgressSource(source);
        if (g.getCreatedAt() == null) {
            g.setCurrentValue(start);
        }
    }

    /** Analytics-linked progress is only allowed for an existing, additive/stock account metric with stored data. */
    private void validateAnalyticsLink(GoalRequest req) {
        if (req.linkedAccountId() == null || req.linkedMetricKey() == null) {
            throw BloomException.badRequest("ANALYTICS_LINK_REQUIRED", "Choose an account and a metric to track");
        }
        ConnectedSocialAccount a = accounts.findByIdAndWorkspaceId(req.linkedAccountId(), workspace.id())
                .orElseThrow(() -> BloomException.notFound("Account"));
        MetricDefinition d = definitions.findById(req.linkedMetricKey())
                .orElseThrow(() -> BloomException.badRequest("UNKNOWN_METRIC", "Unknown metric"));
        if (!"ACCOUNT".equals(d.getScope()) || !d.getProvider().equals(a.getProvider().name())) {
            throw BloomException.badRequest("METRIC_NOT_FOR_ACCOUNT", "That metric is not available for this account");
        }
        if (d.getCanonicalKey().contains("avg")) {
            throw BloomException.badRequest("METRIC_NOT_TRACKABLE", "Averages cannot be tracked as a goal target");
        }
        boolean hasData = queries.coverage(List.of(a.getId())).stream().anyMatch(c -> c.metricKey().equals(d.getMetricKey()));
        if (!hasData) {
            throw BloomException.unprocessable("METRIC_HAS_NO_DATA",
                    "No synced data exists for this metric yet. Sync the account first or track progress manually.");
        }
    }

    private void applyMilestone(GoalMilestone m, MilestoneRequest req) {
        m.setTitle(req.title().trim());
        m.setTargetValue(req.targetValue());
        m.setDueDate(req.dueDate());
        if (req.achieved() != null) {
            m.setAchievedAt(req.achieved() ? (m.getAchievedAt() != null ? m.getAchievedAt() : clock.instant()) : null);
        }
    }

    private GoalView view(Goal g, List<GoalMilestone> ms, LocalDate today) {
        LinkedMetric linked = null;
        if (g.getProgressSource() == Goal.ProgressSource.ANALYTICS) {
            ConnectedSocialAccount a = g.getLinkedAccountId() == null ? null : accounts.findById(g.getLinkedAccountId()).orElse(null);
            MetricDefinition d = definitions.findById(g.getLinkedMetricKey()).orElse(null);
            boolean available = a != null && d != null && a.isSyncable();
            String note = a == null ? "The linked account was removed; progress is frozen at the last synced value."
                    : !a.isSyncable() ? "The linked account needs attention (" + a.getConnectionStatus() + "); progress may be stale."
                    : null;
            linked = new LinkedMetric(a == null ? null : a.getId(), a == null ? null : a.getHandle(),
                    a == null ? null : a.getProvider().name(), g.getLinkedMetricKey(), d == null ? g.getLinkedMetricKey() : d.getLabel(),
                    d == null ? null : d.getMeasureType(), available, note);
        }
        Long daysRemaining = g.getDeadline() == null ? null : ChronoUnit.DAYS.between(today, g.getDeadline());
        return new GoalView(g.getId(), g.getTitle(), g.getCategory(), g.getDescription(), g.getUnit(), g.getStartValue(),
                g.getTargetValue(), g.getCurrentValue(),
                GoalStateEvaluator.progressPercent(g.getStartValue(), g.getTargetValue(), g.getCurrentValue()),
                g.targetReached(), g.getStartDate(), g.getDeadline(), daysRemaining, g.getProgressSource(), linked,
                g.getStatus(), GoalStateEvaluator.evaluate(g, today), g.getCompletedAt(),
                ms.stream().sorted(Comparator.comparingInt(GoalMilestone::getPosition)).map(MilestoneView::of).toList(),
                g.getCreatedAt(), g.getUpdatedAt());
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(workspace.zone()));
    }

    private Goal owned(UUID id) {
        return goals.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Goal"));
    }

    private GoalMilestone ownedMilestone(UUID goalId, UUID milestoneId) {
        owned(goalId);
        return milestones.findById(milestoneId).filter(m -> m.getGoalId().equals(goalId))
                .orElseThrow(() -> BloomException.notFound("Milestone"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
