"use client";
import { Download, Star, Activity, Bot, Building2, CheckCheck, Clock, Database, FileStack, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { BarCard, DonutCard, LineCard } from "@/components/Charts";
import { ButtonLink } from "@/components/ui";
import { Badge, Card, CardHeader, ErrorState, PageHeader, StatCard } from "@/components/ui";

export default function AdminOverview() {
  const { data: s, error, loading, reload } = useApi("/api/stats");
  const { data: sys, reload: reloadSys } = useApi("/api/admin/system");
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const t = s?.totals || {};
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Live figures computed from stored applications, users and records." actions={<><a href="/api/admin/export?type=applications" className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-navy-50"><Download className="h-4 w-4" aria-hidden />Applications CSV</a><a href="/api/admin/export?type=audit" className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-navy-50"><Download className="h-4 w-4" aria-hidden />Audit CSV</a></>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={t.applications} icon={FileStack} loading={loading} />
        <StatCard label="Awaiting approval" value={t.draftsAwaitingApproval} icon={Clock} tone="amber" loading={loading} />
        <StatCard label="Completed" value={t.completed} icon={CheckCheck} tone="green" loading={loading} />
        <StatCard label="Unassigned open" value={t.unassigned} icon={Activity} tone="rose" loading={loading} />
        <StatCard label="Citizens" value={t.citizens} icon={Users} loading={loading} />
        <StatCard label="Active officers" value={t.activeOfficers} icon={Users} tone="teal" loading={loading} />
        <StatCard label="Departments" value={t.departments} icon={Building2} loading={loading} />
        <StatCard label="Historical records" value={t.historicalRecords} icon={Database} tone="teal" loading={loading} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LineCard title="Applications per day" subtitle="Last 14 days" data={s?.activity || []} />
        <LineCard title="Applications per month" subtitle="Last six months" data={s?.byMonth || []} />
        <DonutCard title="Applications by status" data={s?.byStatus || []} />
        <BarCard title="By category" data={s?.byCategory || []} horizontal />
        <BarCard title="By department" data={s?.byDepartment || []} horizontal />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Response drafting" subtitle="How stored drafts were generated" /><div className="space-y-3 p-5 text-sm">
          {(s?.generationModes || []).map((m) => <p key={m.name} className="flex justify-between"><span>{m.name}</span><strong>{m.value}</strong></p>)}
          {!s?.generationModes?.length && <p className="text-navy-500">No drafts yet.</p>}
          <p className="flex justify-between border-t border-navy-100 pt-3"><span>Average hours to a response</span><strong>{s?.avgHoursToResponse ?? "n/a"}</strong></p>
        </div></Card>
        <Card><CardHeader title="System health" subtitle={sys ? `Checked ${new Date(sys.checkedAt).toLocaleTimeString("en-IN")}` : undefined} action={<button onClick={reloadSys} className="text-sm font-semibold text-brand-700 hover:underline">Refresh</button>} /><div className="space-y-3 p-5 text-sm">
          <p className="flex justify-between"><span>Database</span><Badge tone={!sys ? "slate" : sys.db.ok ? "green" : "rose"}>{!sys ? "Checking" : sys.db.ok ? `${sys.db.kind === "mongodb" ? "MongoDB" : "Demo JSON store"} · ${sys.db.latencyMs} ms` : `Error: ${sys.db.error}`}</Badge></p>
          <p className="flex justify-between"><span>Python AI service</span><Badge tone={sys?.ai?.reachable ? "green" : "rose"}>{sys ? (sys.ai.reachable ? `Reachable · ${sys.ai.latencyMs} ms` : "Not reachable: local fallback in use") : "Checking"}</Badge></p>
          {sys?.ai?.reachable && <><p className="flex justify-between"><span>MiniLM embedding model</span><Badge tone={sys.ai.embedding_model?.loaded ? "green" : "amber"}>{sys.ai.embedding_model?.loaded ? "Loaded" : "Not loaded"}</Badge></p>
            <p className="flex justify-between"><span>LLM</span><Badge tone={sys.ai.llm?.configured ? "violet" : "slate"}>{sys.ai.llm?.configured ? `${sys.ai.llm.provider}/${sys.ai.llm.model}` : "Not configured (fallback mode)"}</Badge></p>
            <p className="flex justify-between"><span>OCR (Tesseract)</span><Badge tone={sys.ai.capabilities?.ocr ? "green" : "amber"}>{sys.ai.capabilities?.ocr ? "Available" : "Not available"}</Badge></p>
            <p className="flex justify-between"><span>Hindi translation</span><Badge tone={sys.ai.capabilities?.translation?.marian_loaded || sys.ai.capabilities?.translation?.llm ? "green" : "amber"}>{sys.ai.capabilities?.translation?.marian_loaded ? "Local model" : sys.ai.capabilities?.translation?.llm ? "Via LLM" : "Not available"}</Badge></p></>}
          <p className="flex justify-between"><span>Email (SMTP)</span><Badge tone={sys?.smtp?.configured ? "green" : "amber"}>{sys ? (sys.smtp.configured ? "Configured" : "Not configured: emails go to the outbox") : "Checking"}</Badge></p>
          <p className="flex justify-between"><span>Emails sent / stored only</span><strong>{s?.emails?.sent ?? 0} / {s?.emails?.notSent ?? 0}</strong></p>
          <p className="flex justify-between"><span>Records with stored embeddings</span><strong>{s?.embeddedRecords ?? 0} / {t.historicalRecords ?? 0}</strong></p>
          <p className="flex justify-between"><span>Citizen satisfaction</span><strong className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" aria-hidden />{s?.satisfaction?.average ?? "n/a"} ({s?.satisfaction?.responses ?? 0})</strong></p>
          <p className="flex justify-between"><span>Open support tickets</span><strong>{s?.openTickets ?? 0}</strong></p>
        </div></Card>
      </div>
    </>
  );
}
