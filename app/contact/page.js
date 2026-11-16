"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useSession } from "@/components/Session";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client";

export default function Contact() {
  const { user, t, pub } = useSession(); const { toast } = useToast();
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" }); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({});
    try { await api("/api/support", { method: "POST", body: { ...f, name: f.name || user?.name, email: f.email || user?.email } }); setDone(true); }
    catch (err) { setErrors(err.details || {}); toast(err.message, "error"); } finally { setBusy(false); }
  }
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-[1fr_20rem]">
        <div>
          <h1 className="text-4xl font-semibold">{t("contact.title")}</h1>
          <p className="mt-2 text-navy-600">Ask a question, report a problem or send feedback about this platform. Administrators read every message.</p>
          {done ? <Card className="mt-6 p-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" aria-hidden /><h2 className="mt-3 text-xl font-semibold">Message sent</h2><p className="mt-1 text-sm text-navy-600">Thank you. An administrator will review it.</p></Card> : (
            <Card className="mt-6 p-6"><form onSubmit={submit} className="space-y-4" noValidate>
              {!user && <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name" htmlFor="cn" error={errors.name}><Input id="cn" value={f.name} onChange={set("name")} error={errors.name} /></Field><Field label="Email" htmlFor="ce" error={errors.email}><Input id="ce" type="email" value={f.email} onChange={set("email")} error={errors.email} /></Field></div>}
              <Field label="Subject" htmlFor="cs" error={errors.subject}><Input id="cs" value={f.subject} onChange={set("subject")} error={errors.subject} maxLength={150} /></Field>
              <Field label="Message" htmlFor="cm" error={errors.message} hint={`${f.message.length}/3000`}><Textarea id="cm" rows={6} value={f.message} onChange={set("message")} error={errors.message} maxLength={3000} /></Field>
              <Button type="submit" loading={busy}>{t("common.submit")}</Button>
            </form></Card>)}
        </div>
        <aside className="space-y-4 text-sm leading-6 text-navy-700">
          <Card className="p-5"><h2 className="font-semibold">About replies</h2><p className="mt-2">This is a demo platform. Messages are stored for administrators; there is no promised response time.</p>{pub?.supportEmail && <p className="mt-2">You can also email <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${pub.supportEmail}`}>{pub.supportEmail}</a>.</p>}</Card>
          <Card className="p-5"><h2 className="font-semibold">Not an official helpline</h2><p className="mt-2">We cannot give legal advice or act on your RTI request from here. For a real RTI matter, contact the public authority concerned.</p></Card>
        </aside>
      </div>
    </PublicShell>
  );
}
