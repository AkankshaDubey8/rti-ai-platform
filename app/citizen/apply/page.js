"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Download, Info, Languages, Lightbulb, Paperclip, Save, Sparkles, Trash2, Copy } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/Session";
import { useConfirm } from "@/components/Confirm";
import { Badge, Button, ButtonLink, Card, CardHeader, DemoBadge, Field, Input, PageHeader, Select, Textarea, cn } from "@/components/ui";
import { api, fmtDate, fmtSize, uploadForm } from "@/lib/client";
import { detectLanguage } from "@/lib/lang";

const OK_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain"]; const MAX = 5 * 1024 * 1024;
const BLANK = { applicant: { name: "", phone: "", address: "" }, department: "", subject: "", description: "", referenceInfo: "", translation: null };
const STEP_KEYS = ["wiz.s1", "wiz.s2", "wiz.s3", "wiz.s4", "wiz.s5", "wiz.s6", "wiz.s7"];

function Stepper({ step, t, go, maxReached }) {
  return (
    <nav aria-label="Progress" className="mb-6">
      <p className="mb-2 text-sm font-semibold text-navy-600 lg:hidden">Step {step + 1} of 7: {t(STEP_KEYS[step])}</p>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-valuemin={1} aria-valuemax={7} aria-valuenow={step + 1}><motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${((step + 1) / 7) * 100}%` }} transition={{ duration: 0.3 }} /></div>
      <ol className="hidden gap-1 lg:flex">{STEP_KEYS.map((k, i) => (
        <li key={k} className="min-w-0 flex-1"><button type="button" disabled={i > maxReached} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
          className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold", i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-navy-50 text-navy-400")}>
          <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]", i === step ? "bg-white/20" : "bg-surface")}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span><span className="truncate">{t(k)}</span></button></li>))}</ol>
    </nav>
  );
}

function Preview({ form, files, deptName, t }) {
  return (
    <Card className="lg:sticky lg:top-24"><CardHeader title={t("wiz.preview")} subtitle="How your request will look to the officer" />
      <div className="space-y-3 p-5 text-sm">
        <div><p className="text-xs text-navy-500">Applicant</p><p className="font-medium">{form.applicant.name || "…"}{form.applicant.phone ? ` · ${form.applicant.phone}` : ""}</p></div>
        <div><p className="text-xs text-navy-500">Department</p><p className="font-medium">{deptName || "Let the system suggest"}</p></div>
        <div><p className="text-xs text-navy-500">Subject</p><p className="font-semibold">{form.subject || "…"}</p></div>
        <div><p className="text-xs text-navy-500">Request</p><p className="max-h-48 overflow-y-auto whitespace-pre-wrap leading-6">{form.description || "…"}</p></div>
        {form.translation && <div className="rounded-lg bg-sky-50 p-2.5 text-xs text-sky-900"><p className="font-semibold">{t("wiz.translation")}</p><p className="mt-1 whitespace-pre-wrap">{form.translation.text}</p></div>}
        {form.referenceInfo && <div><p className="text-xs text-navy-500">Reference</p><p>{form.referenceInfo}</p></div>}
        <div><p className="text-xs text-navy-500">Documents</p><p>{files.length ? files.map((f) => f.name).join(", ") : "None"}</p></div>
      </div>
    </Card>
  );
}

export default function Apply() {
  const { toast } = useToast(); const { user, t, setDraftText } = useSession(); const confirm = useConfirm();
  const { data: depts } = useApi("/api/departments"); const { data: drafts, reload: reloadDrafts } = useApi("/api/drafts");
  const [form, setForm] = useState(BLANK); const [files, setFiles] = useState([]); const [step, setStep] = useState(0); const [maxReached, setMaxReached] = useState(0);
  const [draftId, setDraftId] = useState(null); const [savedAt, setSavedAt] = useState(null); const [errors, setErrors] = useState({}); const [started, setStarted] = useState(false);
  const [analysis, setAnalysis] = useState(null); const [anBusy, setAnBusy] = useState(false); const [anError, setAnError] = useState("");
  const [trBusy, setTrBusy] = useState(false); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [done, setDone] = useState(null);
  const input = useRef(null); const heading = useRef(null);
  const lang = useMemo(() => detectLanguage(form.description).code, [form.description]);
  const deptName = depts?.items.find((d) => d.id === form.department)?.name;
  useEffect(() => { if (user && !form.applicant.name) setForm((f) => ({ ...f, applicant: { ...f.applicant, name: user.name, phone: user.phone || "" } })); }, [user]); // eslint-disable-line
  useEffect(() => { setDraftText(form.description); return () => setDraftText(""); }, [form.description, setDraftText]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("draft"); if (id) resume(id); }, []); // eslint-disable-line
  useEffect(() => { heading.current?.focus(); }, [step]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setApplicant = (k) => (e) => setForm((f) => ({ ...f, applicant: { ...f.applicant, [k]: e.target.value } }));

  async function resume(id) {
    try { const { draft } = await api(`/api/drafts/${id}`); setForm({ ...BLANK, ...draft.data, applicant: { ...BLANK.applicant, ...draft.data.applicant }, department: draft.data.department || "" }); setDraftId(id); setStep(draft.step); setMaxReached(draft.step); setStarted(true); toast("Draft loaded. Re-attach any files before submitting."); }
    catch (e) { toast(e.message, "error"); }
  }
  async function saveDraft(silent) {
    if (!form.subject.trim() && !form.description.trim()) return toast("Write something first, then save.", "error");
    try { const r = await api("/api/drafts", { method: "POST", body: { id: draftId, step, data: form } }); setDraftId(r.draft.id); setSavedAt(new Date()); reloadDrafts(); if (!silent) toast(t("wiz.saved")); }
    catch (e) { toast(e.message, "error"); }
  }
  async function deleteDraft(d) { if (!(await confirm({ title: "Delete this draft?", text: `“${d.title}” will be removed. This cannot be undone.`, confirmLabel: "Delete", danger: true }))) return; await api(`/api/drafts/${d.id}`, { method: "DELETE" }); reloadDrafts(); }

  function validate(s) {
    const e = {};
    if (s === 0) { if (form.applicant.name.trim().length < 2) e.applicantName = "Enter your name."; if (form.applicant.phone && !/^[0-9+()\-\s]{6,20}$/.test(form.applicant.phone)) e.applicantPhone = "Enter a valid phone number."; }
    if (s === 2 && form.subject.trim().length < 5) e.subject = "Enter a subject of at least 5 characters.";
    if (s === 3 && form.description.trim().length < 20) e.description = "Describe the information you need in at least 20 characters.";
    setErrors(e); return !Object.keys(e).length;
  }
  const go = (n) => { setStep(n); setMaxReached((m) => Math.max(m, n)); };
  const next = () => { if (!validate(step)) return; if (step >= 1 && draftId) saveDraft(true); go(step + 1); };

  const runAnalysis = useCallback(async () => {
    setAnBusy(true); setAnError("");
    try { setAnalysis((await api("/api/assist/analyze", { method: "POST", body: { subject: form.subject, description: form.translation?.text ? `${form.description}\n${form.translation.text}` : form.description, department: form.department || null } })).analysis); }
    catch (e) { setAnError(e.message); } finally { setAnBusy(false); }
  }, [form.subject, form.description, form.department, form.translation]);
  useEffect(() => { if (step === 5) runAnalysis(); }, [step]); // eslint-disable-line

  async function translate() {
    setTrBusy(true);
    try { const r = await api("/api/translate", { method: "POST", body: { text: form.description } }); setForm((f) => ({ ...f, translation: { text: r.translation.text, engine: r.translation.engine } })); toast("Translated. Please read it and correct anything that is wrong."); }
    catch (e) { toast(e.message, "error"); } finally { setTrBusy(false); }
  }
  function addFiles(list) {
    const next = [...files]; let problem = "";
    for (const f of list) { if (!OK_TYPES.includes(f.type)) problem = `${f.name}: use a PDF, PNG, JPG or TXT file.`; else if (f.size > MAX) problem = `${f.name}: files must be 5 MB or smaller.`; else if (next.length >= 5) problem = "You can attach up to 5 files."; else next.push(f); }
    setFiles(next); setErrors((e) => ({ ...e, documents: problem })); if (input.current) input.current.value = "";
  }
  async function submit() {
    if (!confirmed) return;
    const fd = new FormData(); fd.append("subject", form.subject); fd.append("description", form.description); fd.append("referenceInfo", form.referenceInfo); fd.append("department", form.department);
    fd.append("applicant", JSON.stringify(form.applicant)); if (form.translation) fd.append("translation", JSON.stringify(form.translation)); if (draftId) fd.append("draftId", draftId); files.forEach((f) => fd.append("documents", f));
    setBusy(true); setProgress(0);
    try { const { application } = await uploadForm("/api/applications", fd, setProgress); setDone(application); toast("Request submitted."); }
    catch (e) { toast(e.message, "error"); setErrors(e.details || {}); if (e.details?.subject || e.details?.description) go(e.details.subject ? 2 : 3); } finally { setBusy(false); }
  }

  if (done) return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" aria-hidden /><h1 className="mt-4 text-3xl font-semibold">Request submitted</h1><p className="mt-2 text-navy-600">Keep this number to track your request.</p>
        <p className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-xl bg-navy-50 px-5 py-3 text-2xl font-semibold tracking-wide">{done.applicationId}<button type="button" aria-label="Copy application ID" onClick={() => { navigator.clipboard?.writeText(done.applicationId); toast("Copied."); }} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-100"><Copy className="h-4 w-4" /></button></p>
        <div className="mx-auto mt-6 max-w-md space-y-2 rounded-2xl bg-mist p-4 text-left text-sm"><p><span className="text-navy-500">Suggested category:</span> <strong>{done.category}</strong></p><p><span className="text-navy-500">Suggested department:</span> <strong>{done.department?.name || "Not yet routed"}</strong></p>
          <p><span className="text-navy-500">Target response date:</span> <strong>{fmtDate(done.deadline?.dueAt)}</strong> <span className="text-xs text-navy-500">({done.deadlineDays} days, platform setting)</span></p><p className="text-xs text-navy-500">These are AI suggestions. An officer reviews them before anything is decided.</p></div>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><a href={`/api/applications/${done.applicationId}/receipt`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"><Download className="h-4 w-4" aria-hidden />Download acknowledgement (PDF)</a>
          <ButtonLink href={`/citizen/applications/${done.applicationId}`} variant="outline">View application</ButtonLink><ButtonLink href={`/citizen/applications/${done.applicationId}/analysis`} variant="outline">See AI analysis</ButtonLink></div>
      </Card>
    </motion.div>);

  if (!started && !draftId && drafts?.items?.length) return (
    <>
      <PageHeader title={t("wiz.title")} subtitle="Start a new request or continue one you saved." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6"><h2 className="text-lg font-semibold">Start a new request</h2><p className="mt-1 text-sm text-navy-600">Seven short steps. You review everything before it is sent.</p><Button className="mt-5" onClick={() => setStarted(true)}>Start</Button></Card>
        <Card><CardHeader title={`${t("dash.drafts")} (${drafts.items.length})`} /><ul className="divide-y divide-navy-50">{drafts.items.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{d.title}</p><p className="text-xs text-navy-500">Step {d.step + 1} of 7 · saved {fmtDate(d.updatedAt, true)}</p></div>
            <div className="flex gap-1.5"><Button size="sm" onClick={() => resume(d.id)}>Continue</Button><Button size="sm" variant="dangerOutline" onClick={() => deleteDraft(d)} aria-label={`Delete draft ${d.title}`}><Trash2 className="h-4 w-4" /></Button></div></li>))}</ul></Card>
      </div>
    </>);

  const Nav = ({ last }) => (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-5">
      <Button variant="outline" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft className="h-4 w-4" />{t("common.back")}</Button>
      <div className="flex flex-wrap items-center gap-3">{savedAt && <span className="text-xs text-navy-500">{t("wiz.saved")} {savedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
        <Button variant="outline" onClick={() => saveDraft(false)}><Save className="h-4 w-4" />{t("wiz.saveDraft")}</Button>
        {!last && <Button onClick={next}>{t("common.next")}<ArrowRight className="h-4 w-4" /></Button>}</div>
    </div>);

  return (
    <>
      <PageHeader title={t("wiz.title")} subtitle="Nothing is sent until you confirm on the last step. You can save a draft at any time." />
      <Stepper step={step} t={t} go={go} maxReached={maxReached} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-6">
          <h2 ref={heading} tabIndex={-1} className="mb-5 text-xl font-semibold outline-none">{step + 1}. {t(STEP_KEYS[step])}</h2>
          <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-5">
            {step === 0 && <>
              <Field label="Your full name" htmlFor="an" error={errors.applicantName}><Input id="an" autoComplete="name" value={form.applicant.name} onChange={setApplicant("name")} error={errors.applicantName} /></Field>
              <Field label="Phone (optional)" htmlFor="ap" error={errors.applicantPhone} hint="Only the officer handling your request can see this."><Input id="ap" type="tel" autoComplete="tel" value={form.applicant.phone} onChange={setApplicant("phone")} error={errors.applicantPhone} /></Field>
              <Field label="Postal address (optional)" htmlFor="aa"><Textarea id="aa" rows={2} maxLength={300} value={form.applicant.address} onChange={setApplicant("address")} /></Field></>}
            {step === 1 && <Field label="Department (optional)" htmlFor="dept" hint="Leave it blank and the AI will suggest one in step 6. An officer confirms it either way.">
              <Select id="dept" value={form.department} onChange={set("department")}><option value="">Let the system suggest</option>{depts?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>}
            {step === 2 && <Field label="Subject" htmlFor="subject" error={errors.subject} hint="A short title, for example “Street light repairs in Ward 7”."><Input id="subject" maxLength={200} value={form.subject} onChange={set("subject")} error={errors.subject} /></Field>}
            {step === 3 && <>
              <Field label="What information do you need?" htmlFor="description" error={errors.description} hint={`${form.description.length}/5000 characters. You may write in English or Hindi.`}>
                <Textarea id="description" rows={9} maxLength={5000} lang={lang === "hi" ? "hi" : "en"} value={form.description} onChange={(e) => { set("description")(e); if (form.translation) setForm((f) => ({ ...f, description: e.target.value, translation: null })); }} error={errors.description} placeholder="List each item you want, for example: the number of repairs in 2023, the amount spent and who did the work." /></Field>
              <Field label="Reference information (optional)" htmlFor="ref" hint="File numbers, earlier application IDs, dates or order numbers."><Input id="ref" maxLength={500} value={form.referenceInfo} onChange={set("referenceInfo")} /></Field>
              {(lang === "hi" || lang === "mixed") && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900"><p className="flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4" aria-hidden />Your request is in Hindi</p><p className="mt-1 text-sm">Your original text is always kept and is what counts. You can add an English translation to help officers; read it and correct it before using it.</p>
                <Button className="mt-3" variant="outline" size="sm" loading={trBusy} onClick={translate}>{t("wiz.translate")}</Button>
                {form.translation && <div className="mt-3 space-y-2"><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-semibold">{t("wiz.original")}</p><p className="whitespace-pre-wrap rounded-lg bg-surface p-2.5 text-sm text-navy-900">{form.description}</p></div>
                  <div><label htmlFor="tr" className="mb-1 block text-xs font-semibold">{t("wiz.translation")} <Badge tone="sky">{form.translation.engine}</Badge></label><Textarea id="tr" rows={5} value={form.translation.text} onChange={(e) => setForm((f) => ({ ...f, translation: { ...f.translation, text: e.target.value } }))} /></div></div>
                  <button type="button" className="text-xs font-semibold underline" onClick={() => setForm((f) => ({ ...f, translation: null }))}>Remove translation</button></div>}</div>}</>}
            {step === 4 && <>
              <Field label="Supporting documents (optional)" error={errors.documents} hint="PDF, PNG, JPG or TXT. Up to 5 files, 5 MB each. Files are not saved in drafts: attach them again before submitting.">
                <input ref={input} id="docs" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" className="sr-only" onChange={(e) => addFiles([...e.target.files])} />
                <label htmlFor="docs" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 px-3 py-8 text-sm font-medium text-navy-700 focus-within:ring-2 hover:border-brand-500 hover:bg-brand-50"><Paperclip className="h-4 w-4" />Choose files</label></Field>
              {files.length > 0 && <ul className="space-y-1.5">{files.map((f, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-navy-50 px-3 py-2 text-sm"><span className="truncate">{f.name} <span className="text-navy-400">({fmtSize(f.size)})</span></span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-navy-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}</>}
            {step === 5 && <div className="space-y-4" aria-live="polite">
              <p className="text-sm text-navy-600">Suggestions to make your request clear. You decide what to change.</p>
              {anBusy && <p className="text-sm text-navy-500" role="status">Analysing your request…</p>}
              {anError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{anError} <button className="font-semibold underline" onClick={runAnalysis}>Try again</button></p>}
              {analysis && !anBusy && <>
                <div className="rounded-xl border border-navy-100 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-600" aria-hidden />AI suggestion <Badge tone="slate">{analysis.engine}</Badge></p>
                  <p className="mt-2 text-sm">Category: <strong>{analysis.category}</strong>{analysis.categoryKeywords?.length ? <span className="text-navy-500"> (keywords: {analysis.categoryKeywords.join(", ")})</span> : null}</p>
                  <p className="mt-1 text-sm">Department: <strong>{analysis.recommendedDepartment?.name || "No suggestion"}</strong></p><p className="mt-1 text-xs text-navy-500">{analysis.departmentReason}</p>
                  {analysis.recommendedDepartment && form.department !== analysis.recommendedDepartment.id && <Button size="sm" variant="outline" className="mt-3" onClick={() => { setForm((f) => ({ ...f, department: analysis.recommendedDepartment.id })); toast("Department selected."); }}>Use this department</Button>}</div>
                <div className="rounded-xl border border-navy-100 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />Missing information <Badge tone="slate">rule-based check</Badge></p>
                  {analysis.missingInformation.length ? <ul className="mt-3 space-y-2">{analysis.missingInformation.map((m) => <li key={m.code} className={cn("flex gap-2 rounded-lg p-2.5 text-sm", m.severity === "warn" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900")}>{m.severity === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}<span><strong>{m.message}</strong> {m.suggestion}</span></li>)}</ul> : <p className="mt-2 text-sm text-green-700">Nothing obviously missing.</p>}
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => window.dispatchEvent(new CustomEvent("rti-assistant", { detail: { ask: "Please rewrite my request with clearer wording" } }))}>Ask the assistant to rewrite it</Button></div>
                {analysis.similarOwn.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden />You may have asked something similar before</p>
                  <ul className="mt-2 space-y-1.5 text-sm">{analysis.similarOwn.map((s) => <li key={s.id}>{s.kind === "application" ? <Link className="font-semibold underline" href={`/citizen/applications/${s.id}`} target="_blank">{s.subject}</Link> : <span className="font-semibold">{s.subject} (saved draft)</span>} <span className="text-xs">({s.kind === "application" ? s.id : "draft"}, similarity {s.similarity})</span></li>)}</ul><p className="mt-2 text-xs">Only your own earlier requests are compared. You can still submit if this is a new request.</p></div>}
                <ul className="list-disc space-y-1 pl-5 text-xs text-navy-500">{analysis.notes.map((n) => <li key={n}>{n}</li>)}</ul></>}
            </div>}
            {step === 6 && <div className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">{[["Applicant", `${form.applicant.name}${form.applicant.phone ? ` · ${form.applicant.phone}` : ""}`], ["Department", deptName || "Let the system suggest"], ["Subject", form.subject], ["Documents", files.length ? `${files.length} file(s)` : "None"]].map(([k, v]) => <div key={k}><dt className="text-xs text-navy-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
              {errors.subject || errors.description || errors.documents ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errors.subject || errors.description || errors.documents}</p> : null}
              <p className="rounded-xl bg-navy-50 p-3 text-sm leading-6">The target response date will be shown on your acknowledgement. This is a platform setting, not a promise by any authority.</p>
              <label className="flex items-start gap-3 rounded-xl border border-navy-200 p-4 text-sm font-medium"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#2754D1]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t("wiz.confirm")}</label>
              {busy && <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress"><div className="h-2 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-navy-500">{progress < 100 ? `Uploading… ${progress}%` : "Analysing your request…"}</p></div>}
              <Button size="lg" disabled={!confirmed} loading={busy} onClick={submit}>{t("wiz.submit")}</Button></div>}
          </motion.div></AnimatePresence>
          <Nav last={step === 6} />
        </Card>
        <Preview form={form} files={files} deptName={deptName} t={t} />
      </div>
    </>
  );
}
