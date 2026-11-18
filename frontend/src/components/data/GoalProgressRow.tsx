import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Archive, TrendingUp } from 'lucide-react';
import type { Goal, GoalState } from '@/types/api';
import { formatNumber } from '@/utils/format';
import { GOAL_STATE_LABEL } from '@/utils/labels';
import { ProgressBar, StatusBadge, type BadgeTone } from '../ui/Badge';

const STATE_STYLE: Record<GoalState, { tone: BadgeTone; icon: JSX.Element; bar: 'accent' | 'warning' | 'danger' }> = {
  NOT_STARTED: { tone: 'neutral', icon: <CircleDashed />, bar: 'accent' },
  ON_TRACK: { tone: 'accent', icon: <TrendingUp />, bar: 'accent' },
  AT_RISK: { tone: 'warning', icon: <AlertTriangle />, bar: 'warning' },
  OVERDUE: { tone: 'danger', icon: <Clock />, bar: 'danger' },
  COMPLETED: { tone: 'accent', icon: <CheckCircle2 />, bar: 'accent' },
  ARCHIVED: { tone: 'neutral', icon: <Archive />, bar: 'accent' },
};

export function GoalStateBadge({ state }: { state: GoalState }) {
  const s = STATE_STYLE[state];
  return <StatusBadge tone={s.tone} icon={s.icon} label={GOAL_STATE_LABEL[state]} />;
}

export function GoalProgress({ goal }: { goal: Goal }) {
  return (
    <div className="space-y-1">
      <ProgressBar value={goal.progressPercent} tone={STATE_STYLE[goal.state].bar} label={`${goal.title} progress`} />
      <p className="tabular flex justify-between text-2xs text-fg-2">
        <span>
          {formatNumber(goal.currentValue)} / {formatNumber(goal.targetValue)} {goal.unit}
        </span>
        <span>{formatNumber(goal.progressPercent, { maximumFractionDigits: 0 })}%</span>
      </p>
    </div>
  );
}
