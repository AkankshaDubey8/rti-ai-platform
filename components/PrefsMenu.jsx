'use client';
import { useState } from 'react';
import { Languages, Monitor, Moon, Sun, Type } from 'lucide-react';
import { LANGS } from '@/lib/i18n';
import { useSession } from './Session';
import { cn } from './ui';

// Language, theme and text-size controls (keyboard accessible, saved per account when signed in).
export default function PrefsMenu({ onDark }) {
  const { prefs, setPref, t } = useSession(); const [open, setOpen] = useState(false);
  const Seg = ({ label, value, current, onPick, children }) => (
    <button type="button" onClick={() => onPick(value)} aria-pressed={current === value} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold', current === value ? 'bg-brand-600 text-white' : 'text-navy-700 hover:bg-navy-100')} aria-label={label}>{children}</button>
  );
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`${t('common.language')}, ${t('common.theme')}, ${t('common.textSize')}`} className={cn('rounded-xl p-2.5 hover:bg-navy-100', onDark ? 'text-white hover:bg-white/10' : 'text-navy-600')}><Languages className="h-5 w-5" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-label="Display preferences" className="absolute right-0 z-40 mt-2 w-72 space-y-4 rounded-2xl border border-navy-100 bg-surface p-4 text-navy-900 shadow-xl">
            <div><p className="mb-1.5 text-xs font-semibold text-navy-500">{t('common.language')}</p><div className="flex gap-1.5">{Object.entries(LANGS).map(([k, l]) => <Seg key={k} value={k} current={prefs.language} onPick={(v) => setPref('language', v)} label={l}>{l}</Seg>)}</div></div>
            <div><p className="mb-1.5 text-xs font-semibold text-navy-500">{t('common.theme')}</p><div className="flex gap-1.5">
              <Seg value="light" current={prefs.theme} onPick={(v) => setPref('theme', v)} label={t('common.light')}><Sun className="mx-auto h-4 w-4" /></Seg>
              <Seg value="dark" current={prefs.theme} onPick={(v) => setPref('theme', v)} label={t('common.dark')}><Moon className="mx-auto h-4 w-4" /></Seg>
              <Seg value="system" current={prefs.theme} onPick={(v) => setPref('theme', v)} label={t('common.system')}><Monitor className="mx-auto h-4 w-4" /></Seg></div></div>
            <div><p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-500"><Type className="h-3.5 w-3.5" />{t('common.textSize')}</p><div className="flex gap-1.5">
              <Seg value="normal" current={prefs.textSize} onPick={(v) => setPref('textSize', v)} label="Normal text">A</Seg>
              <Seg value="large" current={prefs.textSize} onPick={(v) => setPref('textSize', v)} label="Large text"><span className="text-sm">A</span></Seg>
              <Seg value="xlarge" current={prefs.textSize} onPick={(v) => setPref('textSize', v)} label="Extra large text"><span className="text-base">A</span></Seg></div></div>
          </div>
        </>
      )}
    </div>
  );
}
