import { createContext, useContext, useState } from 'react';
import { cn } from '../../lib/utils.js';

const TabCtx = createContext(null);

export function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className }) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlledValue ?? internal;
  const setValue = (v) => {
    if (controlledValue === undefined) setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabCtx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabCtx.Provider>
  );
}

export const TabsList = ({ children, className }) => (
  <div className={cn('flex gap-1 p-1 bg-offwhite rounded-md border border-border w-fit', className)}>{children}</div>
);

export const TabsTrigger = ({ value, children, className }) => {
  const { value: active, setValue } = useContext(TabCtx);
  const isActive = active === value;
  return (
    <button
      onClick={() => setValue(value)}
      className={cn(
        'px-4 h-8 text-sm font-medium rounded transition-colors',
        isActive ? 'bg-white text-primary shadow-card' : 'text-muted hover:text-ink',
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
