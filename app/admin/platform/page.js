"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import { Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";

export default function Platform() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi("/api/admin/settings");
  const [s, setS] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  if (loading || !s) return <Skeleton className="h-80 w-full" />;
  async function save() {
    setBusy(true);
    try { const r = await api("/api/admin/settings", { method: "PUT", body: s }); setS(r.settings); toast("Settings saved."); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  const Toggle = ({ k, label, hint }) => (
    <label className="flex items-start gap-3 rounded-xl border border-navy-100 p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-navy-500">{hint}</span></span></label>
  );
  return (
    <>
      <PageHeader title="Platform settings" subtitle="These settings take effect immediately for new activity." />
      <Card className="max-w-2xl"><CardHeader title="General" /><div className="space-y-5 p-5">
        <Field label="Platform name" htmlFor="pn"><Input id="pn" maxLength={60} value={s.platformName} onChange={(e) => setS({ ...s, platformName: e.target.value })} /></Field>
        <Field label="Announcement banner" htmlFor="an" hint="Shown at the top of every signed-in page. Leave empty to hide."><Input id="an" maxLength={200} value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} /></Field>
        <Field label="Similar records retrieved per application" htmlFor="sr" hint="How many historical records the AI shows officers (1 to 5)."><Select id="sr" value={s.similarRecordsCount} onChange={(e) => setS({ ...s, similarRecordsCount: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select></Field>
        <Field label="Target response time (days)" htmlFor="rd" hint="Used for deadline reminders, priority and receipts (1 to 90). The RTI Act generally sets 30 days; confirm the rule that applies to you."><Input id="rd" type="number" min={1} max={90} value={s.responseDeadlineDays} onChange={(e) => setS({ ...s, responseDeadlineDays: Number(e.target.value) })} /></Field>
        <Toggle k="autoAssign" label="Assign new applications to officers automatically" hint="Picks the least-busy active officer in the recommended department. When off, an administrator assigns each application." />
        <Toggle k="allowRegistrations" label="Allow new citizen registrations" hint="Turn off to close sign-ups." />
        <Button loading={busy} onClick={save}>Save settings</Button>
      </div></Card>
      <Card className="mt-6 max-w-2xl"><CardHeader title="Data exports (CSV)" subtitle="Every export is recorded in the audit log. Passwords and request text are never included." /><div className="flex flex-wrap gap-2 p-5">
        {["applications", "users", "audit", "feedback", "support", "outbox"].map((t) => <a key={t} href={`/api/admin/export?type=${t}`} className="rounded-xl border border-navy-200 px-3.5 py-2 text-sm font-semibold capitalize hover:bg-navy-50">{t}</a>)}</div></Card>
    </>
  );
}
