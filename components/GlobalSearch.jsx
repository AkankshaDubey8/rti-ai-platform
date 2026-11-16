'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Clock, FileText, Search } from 'lucide-react';
import { api } from '@/lib/client';
import { useDebounced } from '@/hooks/useApi';
import { useSession } from './Session';
import { StatusBadge } from './StatusBadge';

// Header search: your applications (including text found inside attached documents), help articles, and your recent searches.
export default function GlobalSearch() {
  const { user, t } = useSession();
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const [hist, setHist] = useState([]); const [open, setOpen] = useState(false); const [err, setErr] = useState('');
  const dq = useDebounced(q, 350); const wrap = useRef(null);
  const base = user.role === 'citizen' ? '/citizen' : '/officer';
  useEffect(() => { if (dq.trim().length < 2) { setRes(null); setErr(''); return; } api(`/api/search?q=${encodeURIComponent(dq.trim())}`).then((r) => { setRes(r); setErr(''); }).catch((e) => setErr(e.message)); }, [dq]);
  useEffect(() => { if (open && q.length < 2) api('/api/prefs').then((r) => setHist(r.prefs.searchHistory)).catch(() => {}); }, [open, q]);
  useEffect(() => { const c = (e) => !wrap.current?.contains(e.target) && setOpen(false); document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  const clearHist = async () => { await api('/api/prefs/history', { method: 'DELETE' }); setHist([]); };
  return (
    <div ref={wrap} className="relative w-full max-w-md" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
      <input className="input pl-9" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder={`${t('common.search')}…`} aria-label={t('common.search')} aria-expanded={open} aria-controls="global-search-results" />
      {open && (
        <div id="global-search-results" className="absolute z-40 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-navy-100 bg-surface p-2 shadow-xl">
          {q.length < 2 && (hist.length ? <><div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-navy-500"><span>Recent searches</span><button onClick={clearHist} className="text-brand-700 hover:underline">Clear</button></div>
            {hist.map((h) => <button key={h} onClick={() => setQ(h)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-navy-50"><Clock className="h-4 w-4 text-navy-400" />{h}</button>)}</> : <p className="px-2 py-3 text-sm text-navy-500">Search applications, document text and help articles.</p>)}
          {err && <p className="px-2 py-3 text-sm text-rose-600" role="alert">{err}</p>}
          {res && !res.applications.length && !res.help.length && <p className="px-2 py-3 text-sm text-navy-500">No results for “{dq}”.</p>}
          {res?.applications.length > 0 && <p className="px-2 pt-1 text-xs font-semibold text-navy-500">Applications</p>}
          {res?.applications.map((a) => (
            <Link key={a.applicationId} href={`${base}/applications/${a.applicationId}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-navy-50">
              <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-navy-400" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{a.subject}</span><span className="block text-xs text-navy-500">{a.applicationId}{a.matchedInDocument ? ' · found in a document' : ''}</span></span></span><StatusBadge status={a.status} />
            </Link>))}
          {res?.help.length > 0 && <p className="px-2 pt-2 text-xs font-semibold text-navy-500">Help</p>}
          {res?.help.map((h) => <Link key={h.id} href={`/help#${h.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-navy-50"><BookOpen className="h-4 w-4 text-navy-400" />{h.title}</Link>)}
        </div>
      )}
    </div>
  );
}
