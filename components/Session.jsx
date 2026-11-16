'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { api } from '@/lib/client';
import { translate } from '@/lib/i18n';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './Confirm';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);
export const useI18n = () => { const { t, lang } = useContext(Ctx); return { t, lang }; };

const DEFAULT_PREFS = { language: 'en', theme: 'system', textSize: 'normal' };
const KEY = 'rti-prefs';
const readLocal = () => { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT_PREFS; } };

function applyPrefs(p) {
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.classList.toggle('text-large', p.textSize === 'large'); root.classList.toggle('text-xlarge', p.textSize === 'xlarge');
  root.lang = p.language === 'hi' ? 'hi' : 'en';
}

export function Providers({ children }) {
  const [user, setUser] = useState(null); const [pub, setPub] = useState(null); const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS); const [draftText, setDraftText] = useState('');

  useEffect(() => { const p = readLocal(); setPrefs(p); applyPrefs(p); }, []);
  useEffect(() => { // follow the OS theme while the preference is "system"
    const mq = window.matchMedia('(prefers-color-scheme: dark)'); const on = () => prefs.theme === 'system' && applyPrefs(prefs);
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, [prefs]);

  const refresh = useCallback(async () => {
    const [p, me] = await Promise.all([api('/api/public').catch(() => null), api('/api/auth/me').catch(() => null)]);
    setPub(p); setUser(me?.user || null); setLoading(false);
    if (me?.user) { const r = await api('/api/prefs').catch(() => null); if (r?.prefs) { const next = { language: r.prefs.language, theme: r.prefs.theme, textSize: r.prefs.textSize }; setPrefs(next); applyPrefs(next); localStorage.setItem(KEY, JSON.stringify(next)); } }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const setPref = useCallback((k, v) => {
    setPrefs((cur) => { const next = { ...cur, [k]: v }; applyPrefs(next); localStorage.setItem(KEY, JSON.stringify(next)); return next; });
    api('/api/prefs', { method: 'PUT', body: { [k]: v } }).catch(() => {}); // saved to the account when signed in; ignored otherwise
  }, []);
  const logout = useCallback(async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); window.location.href = '/login'; }, []);
  const t = useCallback((key, vars) => translate(prefs.language, key, vars), [prefs.language]);
  const value = useMemo(() => ({ user, pub, loading, refresh, logout, setUser, prefs, setPref, t, lang: prefs.language, draftText, setDraftText }), [user, pub, loading, refresh, logout, prefs, setPref, t, draftText]);
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider><ConfirmProvider><Ctx.Provider value={value}>{children}</Ctx.Provider></ConfirmProvider></ToastProvider>
    </MotionConfig>
  );
}
