import { Check } from 'lucide-react';
import { STATUS_LABELS, STATUS_ORDER, statusLabel } from '@/lib/workflow';
import { fmtDate } from '@/lib/client';
import { cn } from './ui';

// Progress tracker: highlights how far along the main path the application is (rejected shows as a branch).
export function ProgressTracker({ status }) {
  const rejected = status === 'rejected';
  const path = rejected ? ['submitted', 'ai_completed', 'assigned', 'under_review', 'rejected'] : STATUS_ORDER;
  const idx = path.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-3" aria-label="Application progress">
      {path.map((s, i) => {
        const done = i < idx; const current = i === idx;
        return (
          <li key={s} className="flex items-center gap-1">
            <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', done && 'bg-brand-100 text-brand-800', current && (rejected ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' : 'bg-brand-600 text-white'), !done && !current && 'bg-navy-50 text-navy-400')}>
              {done && <Check className="h-3 w-3" aria-hidden />}{STATUS_LABELS[s]}
            </span>
            {i < path.length - 1 && <span className="h-px w-3 bg-navy-200" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryList({ items }) {
  if (!items?.length) return <p className="text-sm text-navy-500">No history yet.</p>;
  return (
    <ol className="relative ml-2 space-y-5 border-l border-navy-200 pl-6">
      {items.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" aria-hidden />
          <p className="text-sm font-semibold text-navy-900">{statusLabel(h.newStatus)}</p>
          <p className="text-xs text-navy-500">{fmtDate(h.at, true)} by {h.by}</p>
          {h.remarks && <p className="mt-1 text-sm text-navy-700">{h.remarks}</p>}
        </li>
      ))}
    </ol>
  );
}
