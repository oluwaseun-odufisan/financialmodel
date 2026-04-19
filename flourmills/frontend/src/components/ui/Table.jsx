import { cn } from '../../lib/utils.js';

export const Table = ({ className, ...p }) =>
  <div className="w-full overflow-auto">
    <table className={cn('w-full text-sm border-collapse', className)} {...p} />
  </div>;

export const THead = ({ className, ...p }) =>
  <thead className={cn('bg-offwhite border-b border-border', className)} {...p} />;

export const TBody = ({ className, ...p }) => <tbody className={className} {...p} />;

export const TR = ({ className, ...p }) =>
  <tr className={cn('border-b border-border last:border-0 hover:bg-offwhite/60', className)} {...p} />;

export const TH = ({ className, align = 'left', ...p }) =>
  <th className={cn(
    'px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted whitespace-nowrap',
    align === 'right' && 'text-right',
    align === 'center' && 'text-center',
    className
  )} {...p} />;

export const TD = ({ className, align = 'left', ...p }) =>
  <td className={cn(
    'px-3 py-2.5 text-sm text-ink whitespace-nowrap',
    align === 'right' && 'text-right num',
    align === 'center' && 'text-center',
    className
  )} {...p} />;
