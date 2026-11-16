"use client";
import Link from "next/link";
import { useState } from "react";
import { Logo, Disclaimer } from "@/components/Logo";
import { Button, Card, Field, Input } from "@/components/ui";
import { useSession } from "@/components/Session";
import { api, HOME } from "@/lib/client";

const DEMO = [["Citizen", "citizen1@rti-demo.test"], ["Officer (Municipal)", "officer.municipal@rti-demo.test"], ["Officer (Education)", "officer.education@rti-demo.test"], ["Administrator", "admin@rti-demo.test"]];

export default function Login() {
  const { pub, t } = useSession();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({}); setFormError("");
    try {
      const { user } = await api("/api/auth/login", { method: "POST", body: form });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : HOME[user.role];
    } catch (err) { setErrors(err.details || {}); setFormError(err.message); setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Card className="p-7">
          <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{formError}</p>}
            <Field label={t("login.email")} htmlFor="email" error={errors.email}><Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required /></Field>
            <Field label={t("login.password")} htmlFor="password" error={errors.password}><Input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} required /></Field>
            <Button type="submit" loading={busy} className="w-full" size="lg">{t("common.signIn")}</Button>
            <p className="text-center text-sm"><Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">{t("login.forgot")}</Link></p>
          </form>
          <p className="mt-5 text-center text-sm text-navy-600">{t("login.new")} <Link href="/register" className="font-semibold text-brand-700 hover:underline">{t("login.create")}</Link></p>
        </Card>
        {pub?.mode === "demo" && (
          <Card className="mt-4 p-5">
            <p className="text-sm font-semibold">Demo accounts</p>
            <p className="mt-1 text-xs text-navy-500">Demo mode is on. These accounts hold fictional DEMO DATA. The password is in the README (or your DEMO_PASSWORD).</p>
            <div className="mt-3 flex flex-wrap gap-2">{DEMO.map(([l, e]) => <button key={e} type="button" onClick={() => setForm({ ...form, email: e })} className="rounded-lg border border-navy-200 px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50">{l}</button>)}</div>
          </Card>
        )}
        <Disclaimer className="mt-5 text-center" />
      </div>
    </div>
  );
}
