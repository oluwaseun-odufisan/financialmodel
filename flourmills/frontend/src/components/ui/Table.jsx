import { cn } from '../../lib/utils.js';

export const Table = ({ className, ...props }) => (
  <div className="w-full overflow-auto">
    <table className={cn('w-full border-collapse text-sm', className)} {...props} />
  </div>
);

export const THead = ({ className, ...props }) => (
  <thead className={cn('border-b border-[var(--border-soft)] bg-[var(--surface-muted)]', className)} {...props} />
);

export const TBody = ({ className, ...props }) => <tbody className={className} {...props} />;

export const TR = ({ className, ...props }) => (
  <tr className={cn('border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]/70', className)} {...props} />
);

export const TH = ({ className, align = 'left', ...props }) => (
  <th
    className={cn(
      'whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className
    )}
    {...props}
  />
);

export const TD = ({ className, align = 'left', ...props }) => (
  <td
      className={cn(
      'whitespace-nowrap px-3 py-3 text-sm text-[var(--text-main)]',
      align === 'right' && 'num text-right',
      align === 'center' && 'text-center',
      className
    )}
    {...props}
  />
);
