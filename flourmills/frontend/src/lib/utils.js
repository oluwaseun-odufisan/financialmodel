import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const fmtNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const fmtCurrency = (value, decimals = 0) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `NGN ${fmtNumber(value, decimals)}`;

export const fmtMillions = (value, decimals = 1) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `NGN ${fmtNumber(value / 1e6, decimals)}M`;

export const fmtPct = (value, decimals = 2) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(decimals)}%`;

export const fmtMultiplier = (value, decimals = 2) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(decimals)}x`;

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtMonth = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
};
