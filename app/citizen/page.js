"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, Clock3, FilePlus2, FolderClock, History, Hourglass, PenLine } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/components/Session";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonRows, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressTracker } from "@/components/Timeline";
import { fmtDate } from "@/lib/client";
import { statusLabel } from "@/lib/workflow";

export default function CitizenDashboard() {
  const { user, t } = useSession();
  const { data, error, loading, reload } = useApi("/api/stats");
  const [sel, setSel] = useState(null);
  const open = data?.recent?.filter((a) => !["response_issued", "rejected", "closed"].includes(a.status)) || [];
  const tracked = (sel && data?.recent?.find((a) => a.applicationId === sel)) || open[0] || data?.recent?.[0];
  useEffect(() => { setSel(null); }, [data]);
  return (
    <>
      <PageHeader title={t("dash.welcome", { name: user.name.split(" ")[0] })} subtitle={t("dash.sub")} actions={<ButtonLink href="/citizen/apply"><FilePlus2 className="h-4 w-4" />{t("nav.newRequest")}</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("dash.total")} value={data?.total} icon={FolderClock} loading={loading} />
        <StatCard label={t("dash.pending")} value={data?.pending} icon={Hourglass} tone="amber" loading={loading} />
        <StatCard label={t("dash.completed")} value={data?.completed} icon={CheckCircle2} tone="green" loading={loading} />
        <StatCard label={t("dash.attention")} value={data?.attention?.length} icon={AlertTriangle} tone="rose" loading={loading} />
      </div>
      {error ? <Card className="mt-6"><ErrorState error={error} onRetry={reload} /></Card> : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden"><CardHeader title="Where is my request?" subtitle={tracked ? `${tracked.subject} (${tracked.applicationId})` : undefined} action={tracked && <Link className="text-sm font-semibold text-brand-700 hover:underline" href={`/citizen/applications/${tracked.applicationId}`}>Open</Link>} />
              {loading ? <SkeletonRows rows={2} /> : tracked ? <div className="space-y-3 p-5"><ProgressTracker status={tracked.status} />{data.recent.length > 1 && <label className="block text-xs font-semibold text-navy-500">Track another request<select className="input mt-1" value={tracked.applicationId} onChange={(e) => setSel(e.target.value)}>{data.recent.map((a) => <option key={a.applicationId} value={a.applicationId}>{a.subject}: {statusLabel(a.status)}</option>)}</select></label>}</div>
                : <EmptyState title="You have not filed a request yet" text="Describe the information you need and we will route it to the right department." action={<ButtonLink href="/citizen/apply">File your first request</ButtonLink>} />}</Card>
            <Card className="overflow-hidden"><CardHeader title={t("dash.attention")} />
              {loading ? <SkeletonRows rows={2} /> : !data.attention.length ? <p className="p-5 text-sm text-navy-500">Nothing needs your attention right now.</p> : <ul className="divide-y divide-navy-50">{data.attention.map((a) => <li key={a.applicationId} className="flex items-center justify-between gap-3 px-5 py-3.5"><div><Link href={`/citizen/applications/${a.applicationId}`} className="font-semibold hover:text-brand-700">{a.subject}</Link><p className="text-xs text-amber-700">{a.reason}</p></div><Badge tone="amber">{a.applicationId}</Badge></li>)}</ul>}</Card>
            <Card className="overflow-hidden"><CardHeader title={t("dash.activity")} action={<Link href="/citizen/applications" className="text-sm font-semibold text-brand-700 hover:underline">All applications</Link>} />
              {loading ? <SkeletonRows rows={3} /> : !data.activity.length ? <p className="p-5 text-sm text-navy-500">{t("dash.none")}</p> : <ol className="divide-y divide-navy-50">{data.activity.map((h) => <li key={h.id} className="flex items-start gap-3 px-5 py-3.5"><History className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden /><div className="min-w-0 text-sm"><p><Link href={`/citizen/applications/${h.applicationId}`} className="font-semibold hover:text-brand-700">{h.subject}</Link> <span className="text-navy-500">→</span> {statusLabel(h.newStatus)}</p><p className="text-xs text-navy-500">{fmtDate(h.at, true)}{h.remarks ? ` · ${h.remarks}` : ""}</p></div></li>)}</ol>}</Card>
          </div>
          <div className="space-y-6">
            <Card><CardHeader title={t("dash.quick")} /><div className="grid gap-2 p-4">
              <ButtonLink href="/citizen/apply" className="justify-start"><FilePlus2 className="h-4 w-4" />{t("nav.newRequest")}</ButtonLink>
              <ButtonLink href="/citizen/apply" variant="outline" className="justify-start"><PenLine className="h-4 w-4" />{t("dash.drafts")} ({data?.drafts ?? 0})</ButtonLink>
              <ButtonLink href="/citizen/applications?" variant="outline" className="justify-start"><FolderClock className="h-4 w-4" />{t("nav.myApplications")}</ButtonLink>
              <ButtonLink href="/help" variant="outline" className="justify-start"><BookOpen className="h-4 w-4" />{t("nav.help")}</ButtonLink></div></Card>
            <Card><CardHeader title={t("dash.deadlines")} subtitle="Target response dates (platform setting)" />
              {loading ? <SkeletonRows rows={2} /> : !data.deadlines.length ? <p className="p-5 text-sm text-navy-500">{t("dash.none")}</p> : <ul className="divide-y divide-navy-50">{data.deadlines.map((d) => <li key={d.applicationId} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><Link href={`/citizen/applications/${d.applicationId}`} className="block truncate text-sm font-semibold hover:text-brand-700">{d.subject}</Link><p className="flex items-center gap-1 text-xs text-navy-500"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{fmtDate(d.dueAt)}</p></div><Badge tone={d.state === "overdue" ? "rose" : d.state === "due_soon" ? "amber" : "slate"}>{d.state === "overdue" ? `${Math.abs(d.daysLeft)}d late` : `${d.daysLeft}d left`}</Badge></li>)}</ul>}</Card>
            <Card><CardHeader title={t("dash.recent")} />{!data?.recentlyViewed?.length ? <p className="p-5 text-sm text-navy-500">{t("dash.none")}</p> : <ul className="divide-y divide-navy-50">{data.recentlyViewed.map((r) => <li key={r.applicationId} className="flex items-center justify-between gap-2 px-5 py-3"><Link href={`/citizen/applications/${r.applicationId}`} className="flex min-w-0 items-center gap-2 text-sm font-medium hover:text-brand-700"><Clock3 className="h-4 w-4 shrink-0 text-navy-400" aria-hidden /><span className="truncate">{r.subject}</span></Link><StatusBadge status={r.status} /></li>)}</ul>}</Card>
          </div>
        </div>)}
    </>
  );
}
