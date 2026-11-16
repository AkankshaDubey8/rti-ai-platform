'use client';
import { useState } from 'react';
import { Download, Eye, FileSearch, Paperclip, ScanText } from 'lucide-react';
import { api, fmtSize } from '@/lib/client';
import { useToast } from './Toast';
import { Badge, Button, Modal } from './ui';

const url = (appId, docId, inline) => `/api/documents/${appId}/${docId}${inline ? '?inline=1' : ''}`;

// Attachments: authorised preview (PDF / image / text), download, and text extraction (PDF text layer or OCR) with a summary.
export default function DocumentsPanel({ application, onChanged }) {
  const { toast } = useToast(); const a = application;
  const [preview, setPreview] = useState(null); const [text, setText] = useState(''); const [busy, setBusy] = useState(''); const [open, setOpen] = useState({});
  async function openPreview(d) { setPreview(d); setText(''); if (d.mimeType === 'text/plain') { try { setText(await (await fetch(url(a.applicationId, d.id, true), { credentials: 'same-origin' })).text()); } catch { setText('The file could not be loaded.'); } } }
  async function extract(d) {
    setBusy(d.id);
    try { const r = await api(`/api/documents/${a.applicationId}/${d.id}/text`, { method: 'POST' }); setOpen((o) => ({ ...o, [d.id]: r.extracted })); onChanged?.(); if (r.extracted.warnings?.length) toast(r.extracted.warnings[0], 'error'); else toast('Text extracted.'); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  }
  async function showText(d) { if (open[d.id]) return setOpen((o) => ({ ...o, [d.id]: null })); try { const r = await api(`/api/documents/${a.applicationId}/${d.id}/text`); setOpen((o) => ({ ...o, [d.id]: r.extracted })); } catch (e) { toast(e.message, 'error'); } }
  if (!a.documents.length) return <p className="text-sm text-navy-500">No documents were attached.</p>;
  return (
    <>
      <ul className="space-y-3">
        {a.documents.map((d) => (
          <li key={d.id} className="rounded-xl border border-navy-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4 text-navy-400" aria-hidden />{d.originalName} <span className="font-normal text-navy-400">({fmtSize(d.size)})</span>{d.hasText && <Badge tone="green">text extracted</Badge>}</span>
              <span className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => openPreview(d)}><Eye className="h-4 w-4" />Preview</Button>
                <a href={url(a.applicationId, d.id)} className="inline-flex items-center gap-2 rounded-xl border border-navy-200 px-3 py-1.5 text-[13px] font-semibold text-navy-800 hover:bg-navy-50"><Download className="h-4 w-4" aria-hidden />Download</a>
                <Button size="sm" variant="outline" loading={busy === d.id} onClick={() => extract(d)}><ScanText className="h-4 w-4" />{d.hasText ? 'Re-extract' : 'Extract text'}</Button>
                {d.hasText && <Button size="sm" variant="ghost" onClick={() => showText(d)}><FileSearch className="h-4 w-4" />{open[d.id] ? 'Hide text' : 'Show text'}</Button>}
              </span>
            </div>
            {d.summary && <p className="mt-2 rounded-lg bg-navy-50 p-2.5 text-xs leading-5 text-navy-700"><strong>Summary</strong> <span className="text-navy-400">({d.summaryMethod})</span>: {d.summary}</p>}
            {open[d.id] && <div className="mt-2"><p className="mb-1 flex flex-wrap gap-1.5 text-xs text-navy-500">Extracted by {open[d.id].method}{open[d.id].ocrUsed ? ' (OCR: may contain errors)' : ''}{open[d.id].pages ? `, ${open[d.id].pages} page(s)` : ''}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-navy-50 p-3 text-xs leading-5">{open[d.id].text || '(no text found)'}</pre></div>}
          </li>))}
      </ul>
      <Modal wide open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.originalName || 'Preview'}>
        {preview?.mimeType === 'application/pdf' && <iframe title={`Preview of ${preview.originalName}`} src={url(a.applicationId, preview.id, true)} className="h-[65vh] w-full rounded-lg border border-navy-100" />}
        {preview?.mimeType?.startsWith('image/') && <img alt={`Preview of ${preview.originalName}`} src={url(a.applicationId, preview.id, true)} className="mx-auto max-h-[65vh] rounded-lg" />}
        {preview?.mimeType === 'text/plain' && <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-lg bg-navy-50 p-4 text-sm">{text || 'Loading…'}</pre>}
        <p className="mt-3 text-xs text-navy-500">Only you, the officer handling the request and administrators can open this file.</p>
      </Modal>
    </>
  );
}
