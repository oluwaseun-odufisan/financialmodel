import React from 'react';
import { cn } from '../../lib/utils.js';

const buttonVariants = {
  primary: 'bg-primary text-white hover:bg-primary-900 disabled:opacity-50 shadow-card',
  accent: 'bg-accent text-white hover:bg-accent-900 disabled:opacity-50 shadow-card',
  outline: 'border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-muted)] disabled:opacity-50',
  ghost: 'text-[var(--text-main)] hover:bg-[var(--surface-muted)] disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export const Button = React.forwardRef(function Button({ className, variant = 'primary', size = 'md', ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
});

export const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-card', className)}
      {...props}
    />
  );
});

export const CardHeader = ({ className, ...props }) => (
  <div className={cn('border-b border-[var(--border-soft)] px-5 py-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn('font-semibold text-[var(--text-main)]', className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn('mt-1 text-xs leading-5 text-[var(--text-muted)]', className)} {...props} />
);

export const CardBody = ({ className, ...props }) => (
  <div className={cn('px-5 py-5', className)} {...props} />
);

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm text-[var(--text-main)]',
        'placeholder:text-[var(--text-muted)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]',
        className
      )}
      {...props}
    />
  );
});

export const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]', className)}
      {...props}
    />
  );
});

export const Badge = ({ variant = 'neutral', className, ...props }) => {
  const variants = {
    neutral: 'border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
    primary: 'border border-primary-100 bg-primary-50 text-primary',
    accent: 'border border-accent-100 bg-accent-50 text-accent-900',
    success: 'border border-emerald-100 bg-emerald-50 text-emerald-700',
    warning: 'border border-amber-100 bg-amber-50 text-amber-700',
    danger: 'border border-red-100 bg-red-50 text-red-700',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variants[variant], className)} {...props} />
  );
};

export const Progress = ({ value = 0, className }) => (
  <div className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]', className)}>
    <div className="h-full bg-accent transition-all duration-200" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);
