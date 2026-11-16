"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Logo, Disclaimer } from "@/components/Logo";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

export default function Forgot() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [res, setRes] = useState(null);
  async function submit(e) { e.preventDefault(); setBusy(true); setErr(""); try { setRes(await api("/api/auth/forgot", { method: "POST", body: { email } })); } catch (x) { setErr(x.details?.email || x.message); } finally { setBusy(false); } }
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4 py-10"><div className="w-full max-w-md">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <Card className="p-7">
        {res ? (<div className="text-center"><MailCheck className="mx-auto h-10 w-10 text-brand-600" aria-hidden /><h1 className="mt-3 text-2xl font-semibold">Check your email</h1><p className="mt-2 text-sm text-navy-600">{res.message}</p>
          {res.demoResetLink && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900"><Badge tone="amber">Demo mode</Badge><p className="mt-2">No email server is configured, so here is your link directly. This is shown only in demo mode.</p><Link href={res.demoResetLink.replace(/^https?:\/\/[^/]+/, "")} className="mt-2 block break-all font-semibold underline">Choose a new password</Link></div>}</div>) : (<>
          <h1 className="text-2xl font-semibold">Reset your password</h1><p className="mt-1 text-sm text-navy-500">Enter your account email. If it exists, we will send a link that works for 60 minutes.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate><Field label="Email" htmlFor="fe" error={err}><Input id="fe" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err} /></Field><Button type="submit" loading={busy} className="w-full" size="lg">Send reset link</Button></form></>)}
        <p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link></p>
      </Card><Disclaimer className="mt-5 text-center" />
    </div></div>
  );
}
