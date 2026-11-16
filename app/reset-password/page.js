"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, Disclaimer } from "@/components/Logo";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

export default function Reset() {
  const [token, setToken] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);
  async function submit(e) { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/auth/reset", { method: "POST", body: { token, password: pw } }); setOk(true); } catch (x) { setErr(x.details?.password || x.message); } finally { setBusy(false); } }
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4 py-10"><div className="w-full max-w-md">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <Card className="p-7">
        {ok ? <div className="text-center"><h1 className="text-2xl font-semibold">Password changed</h1><p className="mt-2 text-sm text-navy-600">You were signed out everywhere. Sign in with your new password.</p><Link href="/login" className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Sign in</Link></div> : (<>
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          {!token && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">This link is missing its token. <Link href="/forgot-password" className="font-semibold underline">Request a new one</Link>.</p>}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate><Field label="New password" htmlFor="np" error={err} hint="At least 8 characters, with a letter and a number."><Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={err} /></Field><Button type="submit" loading={busy} disabled={!token} className="w-full" size="lg">Change password</Button></form></>)}
      </Card><Disclaimer className="mt-5 text-center" />
    </div></div>
  );
}
