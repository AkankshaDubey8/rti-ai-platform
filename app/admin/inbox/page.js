"use client";
import { useState } from "react";
import { Download, Mail, MessageSquare, Star } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";

const TABS = [["tickets", "Support messages", MessageSquare], ["feedback", "Citizen feedback", Star], ["outbox", "Email outbox", Mail]];

export default function Inbox() {
  const { toast } = useToast(); const [tab, setTab] = useState("tickets");
  const { data, error, loading, reload } = useApi("/api/admin/support");
  async function setStatus(t, status) { try { await api(`/api/admin/support/${t.id}`, { method: "PATCH", body: { status } }); reload(); } catch (e) { toast(e.message, "error"); } }
  return (
    <>
      <PageHeader title="Support & feedback" subtitle="Messages from the contact form, ratings from citizens, and every email the platform tried to send." actions={<a href={`/api/admin/export?type=${tab === "tickets" ? "support" : tab}`} className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-navy-50"><Download className="h-4 w-4" aria-hidden />Export CSV</a>} />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">{TABS.map(([k, l, Icon]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-brand-600 text-white" : "border border-navy-200 text-navy-700 hover:bg-navy-50"}`}><Icon className="h-4 w-4" aria-hidden />{l}{data && <span className="rounded-full bg-black/10 px-1.5 text-xs">{data[k].length}</span>}</button>)}</div>
      <Card className="overflow-hidden">
        {loading && !data ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data[tab].length ? <EmptyState title="Nothing here yet" /> : tab === "tickets" ? (
          <ul className="divide-y divide-navy-50">{data.tickets.map((t) => <li key={t.id} className="space-y-1 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{t.subject}</p><div className="flex items-center gap-2"><Badge tone={t.status === "open" ? "amber" : "green"}>{t.status}</Badge><Button size="sm" variant="outline" onClick={() => setStatus(t, t.status === "open" ? "resolved" : "open")}>{t.status === "open" ? "Mark resolved" : "Reopen"}</Button></div></div><p className="text-sm text-navy-700 whitespace-pre-wrap">{t.message}</p><p className="text-xs text-navy-500">{t.name} · <a className="underline" href={`mailto:${t.email}`}>{t.email}</a> · {fmtDate(t.createdAt, true)}</p></li>)}</ul>
        ) : tab === "feedback" ? (
          <ul className="divide-y divide-navy-50">{data.feedback.map((f) => <li key={f.id} className="px-5 py-4"><p className="flex items-center gap-1 font-semibold">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < f.rating ? "fill-amber-400 text-amber-400" : "text-navy-300"}`} aria-hidden />)}<span className="sr-only">{f.rating} out of 5</span><span className="ml-2 text-xs font-normal text-navy-500">{f.applicationId} · {fmtDate(f.createdAt)}</span></p>{f.comment && <p className="mt-1 text-sm">{f.comment}</p>}</li>)}</ul>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-navy-50/70 text-xs font-semibold text-navy-500"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-navy-50">{data.outbox.map((e) => <tr key={e.id}><td className="whitespace-nowrap px-4 py-3 text-navy-600">{fmtDate(e.createdAt, true)}</td><td className="px-4 py-3">{e.to}</td><td className="px-4 py-3">{e.subject}</td><td className="px-4 py-3"><Badge tone={e.status === "sent" ? "green" : e.status === "failed" ? "rose" : "amber"}>{e.status === "not_sent_no_smtp" ? "stored, not sent (no SMTP)" : e.status}</Badge>{e.error && <p className="mt-1 text-xs text-rose-600">{e.error}</p>}</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </>
  );
}
