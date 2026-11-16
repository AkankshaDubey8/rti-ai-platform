'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/client';
import { useSession } from './Session';
import { Badge, cn } from './ui';

// Floating RTI assistant. Every answer says whether a language model or the fallback (knowledge base + rules) produced it.
export default function AssistantWidget() {
  const { t, lang, draftText } = useSession();
  const [open, setOpen] = useState(false); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]); const [suggest, setSuggest] = useState([]);
  const box = useRef(null); const field = useRef(null);

  useEffect(() => { if (open && !suggest.length) api('/api/assistant').then((r) => setSuggest(r.suggestions)).catch(() => {}); if (open) setTimeout(() => field.current?.focus(), 80); }, [open, suggest.length]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => { const h = (e) => { setOpen(true); if (e.detail?.ask) setTimeout(() => ask(e.detail.ask), 150); }; window.addEventListener('rti-assistant', h); return () => window.removeEventListener('rti-assistant', h); });
  useEffect(() => { const k = (e) => e.key === 'Escape' && setOpen(false); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);

  async function ask(text) {
    const message = (text ?? input).trim(); if (!message || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content })); setMsgs((m) => [...m, { role: 'user', content: message }]); setInput(''); setBusy(true);
    try {
      const r = await api('/api/assistant', { method: 'POST', body: { message, history, context: { draft: draftText || '' } } });
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, mode: r.mode, label: r.modeLabel, notice: r.notice, sources: r.sources, follow: r.suggestions }]);
    } catch (e) { setMsgs((m) => [...m, { role: 'assistant', content: e.message, mode: 'error' }]); } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="rti-assistant" aria-label={open ? t('ai.close') : t('ai.open')}
        className="no-print fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-xl transition hover:bg-brand-700 hover:scale-105">
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.section id="rti-assistant" role="dialog" aria-label={t('ai.title')} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.18 }}
            className="no-print fixed bottom-24 right-5 z-50 flex h-[min(36rem,calc(100vh-8rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-navy-100 bg-surface shadow-2xl">
            <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Sparkles className="h-[18px] w-[18px]" /></span>
              <div><p className="font-semibold leading-tight">{t('ai.title')}</p><p className="text-xs text-brand-100">Independent project, not legal advice</p></div>
            </header>
            <div ref={box} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-2xl rounded-tl-sm bg-navy-50 p-3 text-sm leading-6 text-navy-800">{t('ai.hello')}</div>
              {!msgs.length && <div className="flex flex-wrap gap-2">{suggest.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-xs font-medium text-brand-700 hover:bg-brand-100">{q}</button>)}</div>}
              {msgs.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
                  <div className={cn('max-w-[92%] rounded-2xl p-3 text-sm leading-6', m.role === 'user' ? 'rounded-tr-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-navy-50 text-navy-800')}>
                    {m.role === 'assistant' && m.mode && m.mode !== 'error' && <div className="mb-2"><Badge tone={m.mode === 'llm' ? 'violet' : 'amber'}>{m.mode === 'llm' ? `${t('ai.llm')}: ${m.label}` : t('ai.fallback')}</Badge></div>}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.notice && <p className="mt-2 text-xs text-navy-500">{m.notice}</p>}
                    {m.sources?.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5 text-xs">{m.sources.map((s) => <Link key={s.id} href={`/help#${s.id}`} onClick={() => setOpen(false)} className="rounded-full bg-surface px-2 py-0.5 text-brand-700 underline">{s.title}</Link>)}</p>}
                    {m.follow && i === msgs.length - 1 && <div className="mt-3 flex flex-wrap gap-1.5">{m.follow.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-brand-200 bg-surface px-2.5 py-1 text-left text-xs text-brand-700 hover:bg-brand-50">{q}</button>)}</div>}
                  </div>
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-navy-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>}
            </div>
            {draftText && draftText.length > 15 && <div className="flex gap-2 border-t border-navy-100 px-4 py-2 text-xs"><button type="button" className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700" onClick={() => ask('Please rewrite my request with clearer wording')}>Rewrite my draft</button><button type="button" className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700" onClick={() => ask('What is missing in my request?')}>What is missing?</button><button type="button" className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700" onClick={() => ask('Which department handles this?')}>Which department?</button></div>}
            <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2 border-t border-navy-100 p-3">
              <label htmlFor="assistant-input" className="sr-only">{t('ai.placeholder')}</label>
              <input id="assistant-input" ref={field} className="input" value={input} maxLength={1500} onChange={(e) => setInput(e.target.value)} placeholder={t('ai.placeholder')} lang={lang} />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t('ai.send')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
