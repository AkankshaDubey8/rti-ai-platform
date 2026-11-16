"use client";
import { useParams } from "next/navigation";
import { CalendarClock, Download, FileText, Languages, Printer, Sparkles, User } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Badge, Button, ButtonLink, Card, CardHeader, DemoBadge, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { HistoryList, ProgressTracker } from "@/components/Timeline";
import DocumentsPanel from "@/components/DocumentsPanel";
import Feedback from "@/components/Feedback";
import { fmtDate } from "@/lib/client";

const dl = "inline-flex items-center gap-2 rounded-xl border border-navy-200 px-3 py-1.5 text-[13px] font-semibold text-navy-800 hover:bg-navy-50";

export default function ApplicationDetails() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/api/applications/${id}`);
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <Card><ErrorState error={error.status === 404 ? { message: "We could not find this application. Check the ID, or it may belong to another account." } : error} onRetry={reload} /></Card>;
  const a = data.application; const issued = (a.status === "response_issued" || a.status === "closed") && a.finalResponse; const d = a.deadline;
  return (
    <>
      <PageHeader title={a.subject} subtitle={`${a.applicationId} · submitted ${fmtDate(a.createdAt)}`} actions={<div className="flex items-center gap-2">{a.isDemo && <DemoBadge />}<StatusBadge status={a.status} /></div>} />
      <Card className="mb-6 p-5"><ProgressTracker status={a.status} /></Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {issued && (
            <Card className="border-brand-300">
              <CardHeader title="Response from the department" subtitle={`Issued ${fmtDate(a.respondedAt, true)} by an authorised officer`} action={
                <div className="no-print flex flex-wrap gap-2"><a href={`/api/applications/${a.applicationId}/response?format=pdf`} className={dl}><Download className="h-4 w-4" aria-hidden />PDF</a><a href={`/api/applications/${a.applicationId}/response`} className={dl}><FileText className="h-4 w-4" aria-hidden />Text</a><Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button></div>} />
              <pre className="whitespace-pre-wrap p-5 font-sans text-[15px] leading-7">{a.finalResponse}</pre>
            </Card>)}
          {a.status === "rejected" && <Card className="border-rose-200"><CardHeader title="Why this request was rejected" /><p className="p-5 text-[15px] leading-7">{a.rejectionReason}</p><p className="border-t border-navy-100 px-5 py-3 text-xs text-navy-500">If you disagree, the <a className="font-semibold text-brand-700 underline" href="/help#how-to-appeal">appeal guide</a> explains how to prepare an appeal.</p></Card>}
          {(issued || a.status === "rejected" || a.status === "closed") && <Feedback application={a} onSaved={reload} />}
          <Card><CardHeader title="Your request" /><div className="space-y-4 p-5">
            <p className="whitespace-pre-wrap text-[15px] leading-7" lang={a.language === "hi" ? "hi" : "en"}>{a.description}</p>
            {a.translation && <div className="rounded-xl bg-sky-50 p-4 text-sky-900"><p className="flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4" aria-hidden />English translation <Badge tone="sky">{a.translation.engine}</Badge></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{a.translation.text}</p><p className="mt-2 text-xs">{a.translation.note}</p></div>}
            {a.referenceInfo && <p className="text-sm text-navy-600"><span className="font-medium">Reference:</span> {a.referenceInfo}</p>}
          </div></Card>
          <Card><CardHeader title="Documents" subtitle="Private: only you, the handling officer and administrators can open them" /><div className="p-5"><DocumentsPanel application={a} onChanged={reload} /></div></Card>
          <Card><CardHeader title="History" /><div className="p-5"><HistoryList items={a.timeline} /></div></Card>
        </div>
        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            <div><p className="text-navy-500">Category</p><p className="font-semibold">{a.category}</p></div>
            <div><p className="text-navy-500">Department</p><p className="font-semibold">{a.department?.name || "Not routed yet"}</p></div>
            <div><p className="text-navy-500">Handled by</p><p className="font-semibold">{a.assignedOfficer?.name || "Not assigned yet"}</p></div>
            {a.applicant && <div><p className="flex items-center gap-1 text-navy-500"><User className="h-3.5 w-3.5" aria-hidden />Applicant</p><p className="font-semibold">{a.applicant.name}</p></div>}
          </Card>
          <Card className="space-y-2 p-5 text-sm"><div className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-brand-600" aria-hidden />Target response date</div>
            <p className="text-lg font-semibold">{fmtDate(d.dueAt)}</p>
            {d.state === "done" ? <Badge tone={d.metOnTime ? "green" : "amber"}>{d.metOnTime ? "Responded within the target" : "Responded after the target"}</Badge> : <Badge tone={d.state === "overdue" ? "rose" : d.state === "due_soon" ? "amber" : "slate"}>{d.state === "overdue" ? `${Math.abs(d.daysLeft)} days past the target` : `${d.daysLeft} days left`}</Badge>}
            <p className="text-xs text-navy-500">{a.deadlineDays} days from submission, a platform setting. Check the rules that apply to your authority.{d.state === "overdue" && <> The <a className="font-semibold text-brand-700 underline" href="/help#how-to-appeal">appeal guide</a> may help.</>}</p></Card>
          <Card className="space-y-3 p-5"><div className="font-semibold">Downloads</div><a href={`/api/applications/${a.applicationId}/receipt`} className={dl}><Download className="h-4 w-4" aria-hidden />Acknowledgement receipt (PDF)</a></Card>
          <Card className="space-y-3 p-5"><div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-violet-600" aria-hidden />AI analysis</div><p className="text-sm text-navy-600">See how the system categorised and routed your request.</p><ButtonLink href={`/citizen/applications/${a.applicationId}/analysis`} variant="outline" size="sm">View analysis</ButtonLink></Card>
        </div>
      </div>
    </>
  );
}
