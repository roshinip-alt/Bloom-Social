import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/Feedback';

export default function NotFoundPage() {
  return (
    <div className="panel">
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        description="The link may be outdated. Use the sidebar or press ⌘K to find what you need."
        action={<Link to="/" className="text-sm font-medium text-accent hover:underline">Back to Dashboard</Link>}
      />
    </div>
  );
}
