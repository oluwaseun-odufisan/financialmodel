import { Card } from './ui/Primitives.jsx';
import { cn } from '../lib/utils.js';

export function KPICard({ label, value, sublabel, accent = false, icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted uppercase tracking-wider">{label}</div>
          <div className={cn('mt-2 text-2xl font-semibold tabular-nums',
            accent ? 'text-accent-900' : 'text-primary')}>
            {value}
          </div>
          {sublabel && <div className="mt-1 text-xs text-muted">{sublabel}</div>}
        </div>
        {Icon && (
          <div className={cn(
            'w-10 h-10 rounded-md flex items-center justify-center shrink-0',
            accent ? 'bg-accent-50 text-accent' : 'bg-primary-50 text-primary'
          )}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  );
}
