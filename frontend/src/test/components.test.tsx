import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MetricCard } from '@/components/data/MetricCard';
import { TaskRow } from '@/components/data/TaskRow';
import { TooltipProvider } from '@/components/ui/Tooltip';
import type { Task } from '@/types/api';

const task: Task = {
  id: 't1', title: 'Film the Reel', description: null, dueDate: '2026-01-05', dueTime: '10:00:00', priority: 'HIGH', status: 'TODO',
  recurrence: 'WEEKLY', recurrenceUntil: null, goalId: 'g1', goalTitle: 'Grow Instagram', contentDraftId: null, overdue: true,
  completedAt: null, subtasks: [{ id: 's', title: 'Tripod', done: true, position: 0 }, { id: 's2', title: 'Shoot', done: false, position: 1 }],
  createdAt: '', updatedAt: '',
};

describe('MetricCard', () => {
  it('shows the reason instead of zero when a value is unavailable', () => {
    render(<TooltipProvider><MetricCard label="Reach" value={null} unit="COUNT" unavailableReason="Not available from TikTok's API" /></TooltipProvider>);
    expect(screen.getByText("Not available from TikTok's API")).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows value and comparison', () => {
    render(<TooltipProvider><MetricCard label="Followers" value={1200} unit="COUNT" previousValue={1000} change={200} comparisonLabel="vs last month" /></TooltipProvider>);
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('+20%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });
});

describe('TaskRow', () => {
  it('is accessible and toggles completion', async () => {
    const onToggle = vi.fn();
    render(<TaskRow task={task} onToggle={onToggle} onOpen={() => {}} />);
    expect(screen.getByText('High priority:')).toBeInTheDocument();
    expect(screen.getByLabelText('Repeats')).toBeInTheDocument();
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
    expect(screen.getByText('1/2 subtasks')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mark "Film the Reel" as done' }));
    expect(onToggle).toHaveBeenCalledWith(task);
  });
});
