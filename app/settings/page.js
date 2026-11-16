"use client";
import { useState } from "react";
import { useSession } from "@/components/Session";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/hooks/useApi";

export default function Settings() {
  const { user, setUser } = useSession(); const { toast } = useToast();
  const [p, setP] = useState({ name: user.name, phone: user.phone || "" }); const [pe, setPe] = useState({}); const [pb, setPb] = useState(false);
  const { data: pf, reload: reloadPrefs } = useApi("/api/prefs");
  async function setEmailPref(v) { try { await api("/api/prefs", { method: "PUT", body: { emailNotifications: v } }); reloadPrefs(); toast(v ? "Email notifications on." : "Email notifications off."); } catch (e) { toast(e.message, "error"); } }
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" }); const [we, setWe] = useState({}); const [wb, setWb] = useState(false);

  async function saveProfile(e) {
    e.preventDefault(); setPb(true); setPe({});
    try { const r = await api("/api/auth/me", { method: "PATCH", body: p }); setUser({ ...user, ...r.user }); toast("Profile updated."); } catch (err) { setPe(err.details || {}); toast(err.message, "error"); } finally { setPb(false); }
  }
  async function savePassword(e) {
    e.preventDefault(); setWb(true); setWe({});
    try { await api("/api/auth/me", { method: "PATCH", body: pw }); setPw({ currentPassword: "", newPassword: "" }); toast("Password changed."); } catch (err) { setWe(err.details || {}); toast(err.message, "error"); } finally { setWb(false); }
  }
  return (
    <>
      <PageHeader title="Profile & settings" subtitle="Manage your details and password." />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card><CardHeader title="Profile" action={<Badge tone="navy">{user.role}</Badge>} />
          <form onSubmit={saveProfile} className="space-y-4 p-5" noValidate>
            <Field label="Email" htmlFor="em" hint="Your email is your sign-in name and cannot be changed here."><Input id="em" value={user.email} disabled /></Field>
            <Field label="Full name" htmlFor="nm" error={pe.name}><Input id="nm" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} error={pe.name} /></Field>
            <Field label="Phone (optional)" htmlFor="ph" error={pe.phone}><Input id="ph" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} error={pe.phone} /></Field>
            <Button type="submit" loading={pb}>Save profile</Button>
          </form></Card>
        <Card><CardHeader title="Notifications" /><div className="space-y-3 p-5 text-sm"><label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#2754D1]" checked={pf?.prefs.emailNotifications !== false} onChange={(e) => setEmailPref(e.target.checked)} /><span><strong>Email me about important updates</strong><span className="block text-xs text-navy-500">In-app notifications are always on. Emails are sent only if the platform has an email server configured.</span></span></label></div></Card>
        <Card><CardHeader title="Change password" />
          <form onSubmit={savePassword} className="space-y-4 p-5" noValidate>
            <Field label="Current password" htmlFor="cp" error={we.currentPassword}><Input id="cp" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={we.currentPassword} /></Field>
            <Field label="New password" htmlFor="np" error={we.newPassword} hint="At least 8 characters, with a letter and a number."><Input id="np" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={we.newPassword} /></Field>
            <Button type="submit" loading={wb}>Change password</Button>
          </form></Card>
      </div>
    </>
  );
}
