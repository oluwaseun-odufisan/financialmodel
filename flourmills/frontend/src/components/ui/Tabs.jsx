import { createContext, useContext, useState } from 'react';
import { cn } from '../../lib/utils.js';

const TabCtx = createContext(null);

export function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className }) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlledValue ?? internal;
  const setValue = (nextValue) => {
    if (controlledValue === undefined) setInternal(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <TabCtx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabCtx.Provider>
  );
}

export const TabsList = ({ children, className }) => (
  <div className={cn('flex w-fit gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-1', className)}>
    {children}
  </div>
);

export const TabsTrigger = ({ value, children, className }) => {
  const { value: active, setValue } = useContext(TabCtx);
  const isActive = active === value;

  return (
    <button
      onClick={() => setValue(value)}
      className={cn(
        'h-9 rounded-xl px-4 text-sm font-medium transition-colors',
        isActive ? 'bg-[var(--surface)] text-primary shadow-card' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]',
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className }) => {
  const { value: active } = useContext(TabCtx);
  if (active !== value) return null;
  return <div className={cn('mt-4', className)}>{children}</div>;
};
