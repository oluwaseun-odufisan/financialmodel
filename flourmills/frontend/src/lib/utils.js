import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** cn() — Tailwind class merger (shadcn-style). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------------- *
 *  Number / currency / percent formatters
 * ------------------------------------------------------------------------- */
export const fmtNumber = (v, decimals = 0) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const fmtCurrency = (v, decimals = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `₦ ${fmtNumber(v, decimals)}`;

export const fmtMillions = (v, decimals = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `₦ ${fmtNumber(v / 1e6, decimals)}M`;

export const fmtPct = (v, decimals = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(decimals)}%`;

export const fmtMultiplier = (v, decimals = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(decimals)}x`;

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtMonth = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
};
