"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, FilePenLine, Flame, Languages, Mail, NotebookPen, Phone, RefreshCw, UserCog, XCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import AnalysisPanel from "@/components/AnalysisPanel";
import DocumentsPanel from "@/components/DocumentsPanel";
import { DeadlineBadge } from "@/components/ApplicationTable";
import { StatusBadge } from "@/components/StatusBadge";
import { HistoryList, ProgressTracker } from "@/components/Timeline";
import { Badge, Button, ButtonLink, Card, CardHeader, DemoBadge, ErrorState, Field, Modal, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";

export default function Review() {
  const { id } = useParams(); const { toast } = useToast();
  const { data, error, loading, reload, setData } = useApi(`/api/applications/${id}`);
  const { data: depts } = useApi("/api/departments");
  const [officers, setOfficers] = useState([]);
  const [newNote, setNewNote] = useState(""); const [busy, setBusy] = useState(""); const [modal, setModal] = useState(null); const [value, setValue] = useState(""); const [note, setNote] = useState("");
  const viewerRole = data?.application?.viewer?.role;
  useEffect(() => { if (viewerRole === "admin") api("/api/admin/users?role=officer").then((r) => setOfficers(r.items.filter((o) => o.active))).catch(() => {}); }, [viewerRole]);

  async function act(action, payload = {}, ok = "Done.") {
    setBusy(action);
    try { const r = await api(`/api/applications/${id}/actions`, { method: "POST", body: { action, ...payload } }); setData(r); setModal(null); setValue(""); setNote(""); toast(ok); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(""); }
  }
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-96 w-full" /></div>;
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const a = data.application; const mine = a.viewer.isAssignedOfficer; const admin = a.viewer.role === "admin";
  const open = ["assigned", "under_review", "awaiting_approval"].includes(a.status);
  const done = ["response_issued", "rejected"].includes(a.status);
  const approved = a.draft?.approvalStatus === "approved";
  const needsPipeline = ["submitted", "ai_completed", "draft_generated"].includes(a.status);

  return (
    <>
      <Link href={admin ? "/admin/applications" : "/officer"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />Back to list</Link>
      <PageHeader title={a.subject} subtitle={`${a.applicationId} · submitted ${fmtDate(a.createdAt)} by ${a.citizen?.name}`} actions={<div className="flex items-center gap-2">{a.isDemo && <DemoBadge />}<StatusBadge status={a.status} /></div>} />
      <Card className="mb-6 p-5"><ProgressTracker status={a.status} /></Card>
      {admin && <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">You are viewing as an administrator. You can reassign and re-route applications, but only the assigned officer can edit, approve, reject or issue a response.</p>}
      {a.draft?.reviewRemarks && a.draft.approvalStatus === "rejected" && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"><strong>Draft returned:</strong> {a.draft.reviewRemarks}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        <div className="space-y-6">
          <Card><CardHeader title="Citizen request" /><div className="space-y-4 p-5">
            <p className="whitespace-pre-wrap text-[15px] leading-7" lang={a.language === "hi" ? "hi" : "en"}>{a.description}</p>
            {a.referenceInfo && <p className="text-sm"><span className="font-medium">Reference:</span> {a.referenceInfo}</p>}
            {a.translation && <div className="rounded-xl bg-sky-50 p-4 text-sky-900"><p className="flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4" aria-hidden />English translation supplied with the request <Badge tone="sky">{a.translation.engine}</Badge></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{a.translation.text}</p><p className="mt-2 text-xs">{a.translation.note} The text above is the citizen&apos;s original.</p></div>}
            <div className="grid gap-2 text-sm text-navy-600 sm:grid-cols-2"><p className="flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden />{a.citizen?.name}, {a.citizen?.email}</p>{a.applicant?.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden />{a.applicant.phone}</p>}{a.applicant?.address && <p className="sm:col-span-2">Address: {a.applicant.address}</p>}</div>
          </div></Card>
          <Card><CardHeader title="Documents" subtitle="Preview, extract text (PDF text layer or OCR) and summarise" /><div className="p-5"><DocumentsPanel application={a} onChanged={reload} /></div></Card>
          <AnalysisPanel analysis={a.aiAnalysis} staff />
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">Actions</h2>
            <div className="space-y-1 text-sm"><p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-navy-400" />{a.department?.name || "No department"}</p><p className="flex items-center gap-2"><UserCog className="h-4 w-4 text-navy-400" />{a.assignedOfficer?.name || "Unassigned"}</p></div>
            {a.draft && <p className="text-sm"><span className="text-navy-500">Draft:</span> <Badge tone={a.draft.generationMode.startsWith("llm") ? "violet" : "amber"}>{a.draft.generationMode.startsWith("llm") ? a.draft.generationMode : "Template (no LLM)"}</Badge> <Badge tone={approved ? "green" : "slate"}>{a.draft.approvalStatus}</Badge></p>}
            <div className="flex flex-col gap-2">
              {mine && a.status === "assigned" && <Button variant="teal" loading={busy === "start_review"} onClick={() => act("start_review", {}, "Review started.")}>Start review</Button>}
              {mine && ["under_review", "awaiting_approval"].includes(a.status) && <ButtonLink href={`/officer/applications/${a.applicationId}/editor`} variant="teal"><FilePenLine className="h-4 w-4" />Open response editor</ButtonLink>}
              {mine && a.status === "awaiting_approval" && approved && <Button loading={busy === "issue"} onClick={() => act("issue", {}, "Response issued to the citizen.")}>Issue response</Button>}
              {mine && done && <Button variant="outline" loading={busy === "close"} onClick={() => act("close", {}, "Application closed.")}>Close application</Button>}
              {(mine || admin) && open && <Button variant="outline" onClick={() => { setValue(a.department?.id || ""); setModal("dept"); }}><Building2 className="h-4 w-4" />Override department</Button>}
              {(mine || admin) && open && <Button variant="outline" loading={busy === "reanalyze"} onClick={() => act("reanalyze", {}, "Analysis re-run.")}><RefreshCw className="h-4 w-4" />Re-run AI analysis</Button>}
              {admin && open && <Button variant="outline" onClick={() => { setValue(""); setModal("reassign"); }}><UserCog className="h-4 w-4" />Reassign officer</Button>}
              {admin && needsPipeline && <Button variant="teal" loading={busy === "run_pipeline"} onClick={() => act("run_pipeline", {}, "Pipeline completed.")}>Run AI pipeline</Button>}
              {mine && open && <Button variant="dangerOutline" onClick={() => { setValue(""); setModal("reject"); }}><XCircle className="h-4 w-4" />Reject application</Button>}
              {!open && !done && !needsPipeline && <p className="text-sm text-navy-500">This application is closed.</p>}
            </div>
            {a.status === "rejected" && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><strong>Rejection reason:</strong> {a.rejectionReason}</p>}
          </Card>
          <Card className="space-y-2 p-5 text-sm"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Flame className="h-4 w-4 text-rose-500" aria-hidden />Priority</span><span className="flex gap-1.5"><Badge tone={a.priority?.level === "high" ? "rose" : a.priority?.level === "medium" ? "amber" : "slate"}>{a.priority?.level === "none" ? "Finished" : a.priority?.level}</Badge><DeadlineBadge d={a.deadline} /></span></div>
            <p className="text-xs text-navy-500">Target date {fmtDate(a.deadline.dueAt)} ({a.deadlineDays} days from submission, platform setting).</p>
            {a.priority?.reasons?.length ? <ul className="list-disc space-y-1 pl-5 text-navy-700">{a.priority.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-navy-500">No priority rules apply.</p>}<p className="text-xs text-navy-500">Rule-based and explainable. It only orders the queue; it decides nothing.</p></Card>
          <Card><CardHeader title="Internal notes" subtitle="Only staff can see these. Citizens never can." />
            <ul className="divide-y divide-navy-50 text-sm">{a.notes?.length ? a.notes.map((n) => <li key={n.id} className="px-5 py-3"><p className="whitespace-pre-wrap">{n.text}</p><p className="mt-1 text-xs text-navy-500">{n.authorName} · {fmtDate(n.createdAt, true)}</p></li>) : <li className="px-5 py-4 text-navy-500">No notes yet.</li>}</ul>
            {mine && <div className="space-y-2 border-t border-navy-100 p-4"><label htmlFor="note" className="sr-only">Add a note</label><Textarea id="note" rows={2} maxLength={2000} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add an internal note" /><Button size="sm" variant="outline" disabled={newNote.trim().length < 3} loading={busy === "add_note"} onClick={async () => { await act("add_note", { text: newNote }, "Note added."); setNewNote(""); }}><NotebookPen className="h-4 w-4" />Add note</Button></div>}</Card>
          <Card><CardHeader title="Status history" /><div className="p-5"><HistoryList items={a.timeline} /></div></Card>
          <Card><CardHeader title="Officer action log" /><ul className="divide-y divide-navy-50 text-sm">
            {a.actionHistory?.length ? a.actionHistory.map((h) => <li key={h.id} className="px-5 py-3"><p className="font-medium">{h.action}</p><p className="text-xs text-navy-500">{h.by} ({h.role}) · {fmtDate(h.at, true)}</p></li>) : <li className="px-5 py-4 text-navy-500">No officer actions yet.</li>}
          </ul></Card>
        </div>
      </div>

      <Modal open={modal === "dept"} onClose={() => setModal(null)} title="Override suggested department" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!value} loading={busy === "override_department"} onClick={() => act("override_department", { departmentId: value, note }, "Department updated.")}>Save override</Button></>}>
        <div className="space-y-4"><Field label="Department" htmlFor="od"><Select id="od" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a department</option>{depts?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Reason (optional)" htmlFor="on"><Textarea id="on" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      </Modal>
      <Modal open={modal === "reassign"} onClose={() => setModal(null)} title="Reassign to another officer" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!value} loading={busy === "reassign"} onClick={() => act("reassign", { officerId: value }, "Application reassigned.")}>Reassign</Button></>}>
        <Field label="Officer" htmlFor="ro"><Select id="ro" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose an officer</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.departmentName ? ` (${o.departmentName})` : ""}</option>)}</Select></Field>
      </Modal>
      <Modal open={modal === "reject"} onClose={() => setModal(null)} title="Reject this application" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" disabled={value.trim().length < 10} loading={busy === "reject_application"} onClick={() => act("reject_application", { reason: value }, "Application rejected.")}>Reject application</Button></>}>
        <Field label="Reason shown to the citizen" htmlFor="rr" hint="At least 10 characters. State the lawful ground clearly."><Textarea id="rr" rows={4} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      </Modal>
    </>
  );
}
