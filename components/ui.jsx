'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';

export const cn = (...c) => c.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  teal: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  outline: 'border border-navy-200 bg-surface text-navy-800 hover:bg-navy-50',
  ghost: 'text-navy-700 hover:bg-navy-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  dangerOutline: 'border border-rose-200 bg-surface text-rose-700 hover:bg-rose-50',
};
const SIZE = { sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-[15px]' };
const btnClass = (variant, size, extra) => cn('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], SIZE[size], extra);

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }) {
  return (
    <button type="button" className={btnClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
export function ButtonLink({ href, variant = 'primary', size = 'md', className, children, ...rest }) {
  return <Link href={href} className={btnClass(variant, size, className)} {...rest}>{children}</Link>;
}

export const Card = ({ className, children, ...rest }) => <div className={cn('rounded-2xl border border-navy-100 bg-surface shadow-soft', className)} {...rest}>{children}</div>;
export const CardHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 border-b border-navy-100 px-5 py-4">
    <div><h2 className="text-lg font-semibold text-navy-900">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-navy-500">{subtitle}</p>}</div>
    {action}
  </div>
);

const TONES = {
  navy: 'bg-navy-100 text-navy-800', teal: 'bg-brand-100 text-brand-800', amber: 'bg-amber-100 text-amber-800', rose: 'bg-rose-100 text-rose-800',
  green: 'bg-emerald-100 text-emerald-800', sky: 'bg-sky-100 text-sky-800', slate: 'bg-slate-100 text-slate-700', violet: 'bg-violet-100 text-violet-800',
};
export const Badge = ({ tone = 'navy', className, children }) => <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>{children}</span>;
export const DemoBadge = () => <Badge tone="amber">DEMO DATA</Badge>;

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-navy-800">{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-navy-500">{hint}</p>}
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
export const Input = ({ error, className, ...p }) => <input className={cn('input', error && 'input-error', className)} aria-invalid={Boolean(error)} {...p} />;
export const Textarea = ({ error, className, ...p }) => <textarea className={cn('input min-h-[7rem] resize-y', error && 'input-error', className)} aria-invalid={Boolean(error)} {...p} />;
export const Select = ({ error, className, children, ...p }) => <select className={cn('input pr-8', error && 'input-error', className)} aria-invalid={Boolean(error)} {...p}>{children}</select>;

export const Spinner = ({ className }) => <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-label="Loading" />;
export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-lg bg-navy-100', className)} aria-hidden />;
export function SkeletonRows({ rows = 5 }) {
  return <div className="space-y-3 p-5" role="status" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-navy-50 p-3 text-navy-400"><Icon className="h-7 w-7" aria-hidden /></div>
      <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-navy-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-rose-500"><AlertTriangle className="h-7 w-7" aria-hidden /></div>
      <h3 className="text-lg font-semibold text-navy-900">This could not be loaded</h3>
      <p className="mt-1 max-w-sm text-sm text-navy-500">{error?.message || 'Something went wrong.'}</p>
      {onRetry && <Button variant="outline" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy-950/50" onClick={onClose} aria-hidden />
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.18 }}
            className={cn('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
            <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-navy-100 bg-navy-50/60 px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return total ? <p className="px-5 py-3 text-xs text-navy-500">{total} result{total === 1 ? '' : 's'}</p> : null;
  return (
    <div className="flex items-center justify-between border-t border-navy-100 px-5 py-3 text-sm text-navy-600">
      <span>Page {page} of {totalPages} <span className="text-navy-400">({total} results)</span></span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-semibold text-navy-900">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-[15px] text-navy-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'navy', loading }) {
  const tones = { navy: 'bg-navy-100 text-navy-700', teal: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700', rose: 'bg-rose-100 text-rose-700' };
  return (
    <Card className="flex items-center gap-4 p-5">
      {Icon && <div className={cn('rounded-xl p-3', tones[tone])}><Icon className="h-5 w-5" aria-hidden /></div>}
      <div><p className="text-sm text-navy-500">{label}</p>{loading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="text-3xl font-semibold leading-tight text-navy-900">{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</p>}</div>
    </Card>
  );
}
