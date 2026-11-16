"use client";
import Link from "next/link";
import { useState } from "react";
import { Logo, Disclaimer } from "@/components/Logo";
import { Button, Card, Field, Input } from "@/components/ui";
import { useSession } from "@/components/Session";
import { api } from "@/lib/client";

export default function Register() {
  const { pub, t } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({}); setFormError("");
    try { await api("/api/auth/register", { method: "POST", body: form }); window.location.href = "/citizen"; }
    catch (err) { setErrors(err.details || {}); setFormError(err.message); setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Card className="p-7">
          <h1 className="text-2xl font-semibold">{t("register.title")}</h1>
          <p className="mt-1 text-sm text-navy-500">Officer and administrator accounts are created by an administrator.</p>
          {pub && !pub.allowRegistrations && <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">New registrations are currently closed.</p>}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {formError && !Object.keys(errors).length && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{formError}</p>}
            <Field label={t("register.name")} htmlFor="name" error={errors.name}><Input id="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} required /></Field>
            <Field label={t("login.email")} htmlFor="email" error={errors.email}><Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required /></Field>
            <Field label={t("login.password")} htmlFor="password" error={errors.password} hint="At least 8 characters, with a letter and a number."><Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} required /></Field>
            <Button type="submit" loading={busy} className="w-full" size="lg">{t("common.register")}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-navy-600">{t("register.have")} <Link href="/login" className="font-semibold text-brand-700 hover:underline">{t("common.signIn")}</Link></p>
        </Card>
        <Disclaimer className="mt-5 text-center" />
      </div>
    </div>
  );
}
