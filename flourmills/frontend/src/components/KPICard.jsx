import { Card } from './ui/Primitives.jsx';
import { cn } from '../lib/utils.js';

export function KPICard({ label, value, sublabel, accent = false, icon: Icon }) {
  return (
    <Card className="h-full p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
          <div className={cn('mt-3 text-2xl font-semibold tabular-nums', accent ? 'text-accent-900' : 'text-primary')}>
            {value}
          </div>
          {sublabel && <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{sublabel}</div>}
        </div>

        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accent ? 'bg-accent-50 text-accent' : 'bg-primary-50 text-primary')}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  );
}
