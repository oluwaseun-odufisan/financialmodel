import React from 'react';
import { cn } from '../../lib/utils.js';

/* ---------------- Button ---------------- */
const buttonVariants = {
  primary:   'bg-primary text-white hover:bg-primary-900 disabled:opacity-50',
  accent:    'bg-accent text-white hover:bg-accent-900 disabled:opacity-50',
  outline:   'border border-border bg-white text-ink hover:bg-offwhite disabled:opacity-50',
  ghost:     'text-ink hover:bg-offwhite disabled:opacity-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};
const buttonSizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export const Button = React.forwardRef(function Button(
  { className, variant = 'primary', size = 'md', ...props }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        buttonVariants[variant], buttonSizes[size], className
      )}
      {...props}
    />
  );
});

/* ---------------- Card ---------------- */
export const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('bg-white border border-border rounded-lg shadow-card', className)}
      {...props}
    />
  );
});
export const CardHeader = ({ className, ...p }) =>
  <div className={cn('px-5 pt-4 pb-2 border-b border-border', className)} {...p} />;
export const CardTitle = ({ className, ...p }) =>
  <h3 className={cn('font-semibold text-ink', className)} {...p} />;
export const CardDescription = ({ className, ...p }) =>
  <p className={cn('text-xs text-muted mt-0.5', className)} {...p} />;
export const CardBody = ({ className, ...p }) =>
  <div className={cn('px-5 py-4', className)} {...p} />;

/* ---------------- Input ---------------- */
export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink',
        'placeholder:text-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent',
        'disabled:bg-offwhite disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
});

/* ---------------- Label ---------------- */
export const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('text-xs font-medium text-muted uppercase tracking-wide', className)}
      {...props}
    />
  );
});

/* ---------------- Badge ---------------- */
export const Badge = ({ variant = 'neutral', className, ...props }) => {
  const variants = {
    neutral: 'bg-offwhite text-muted border border-border',
    primary: 'bg-primary-50 text-primary border border-primary-100',
    accent:  'bg-accent-50 text-accent-900 border border-accent-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger:  'bg-red-50 text-red-700 border border-red-100',
  };
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
};

/* ---------------- Progress Bar ---------------- */
export const Progress = ({ value = 0, className }) => (
  <div className={cn('h-1.5 w-full bg-offwhite rounded overflow-hidden', className)}>
    <div className="h-full bg-accent transition-all duration-200" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);
