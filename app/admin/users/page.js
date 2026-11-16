"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import DataTable from "@/components/DataTable";
import { Badge, Button, DemoBadge, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";
import { useConfirm } from "@/components/Confirm";

export default function People() {
  const { toast } = useToast(); const confirm = useConfirm();
  const [role, setRole] = useState("officer");
  const { data, error, loading, reload } = useApi(`/api/admin/users?role=${role}`);
  const { data: depts } = useApi("/api/admin/departments");
  const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: "", email: "", password: "", department: "" }); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function toggle(u) {
    if (u.active && !(await confirm({ title: `Deactivate ${u.name}?`, text: u.role === "officer" ? "They will be signed out and cannot sign in. Applications already assigned to them stay assigned until you reassign them." : "They will be signed out and cannot sign in until you reactivate the account.", confirmLabel: "Deactivate", danger: true }))) return;
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }); toast(`${u.name} ${u.active ? "deactivated" : "activated"}.`); reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function create() {
    setBusy(true); setErrors({});
    try { await api("/api/admin/users", { method: "POST", body: form }); toast("Officer account created."); setOpen(false); setForm({ name: "", email: "", password: "", department: "" }); reload(); }
    catch (e) { setErrors(e.details || {}); toast(e.message, "error"); } finally { setBusy(false); }
  }
  const cols = [
    { header: "Name", text: (u) => `${u.name} ${u.email}`, render: (u) => <div><p className="font-semibold">{u.name} {u.isDemo && <DemoBadge />}</p><p className="text-xs text-navy-500">{u.email}</p></div> },
    ...(role === "officer" ? [{ header: "Department", text: (u) => u.departmentName, render: (u) => u.departmentName || "-" }] : []),
    { header: "Joined", render: (u) => fmtDate(u.createdAt) },
    { header: "Status", render: (u) => <Badge tone={u.active ? "green" : "slate"}>{u.active ? "Active" : "Deactivated"}</Badge> },
    { header: "", render: (u) => <Button size="sm" variant={u.active ? "dangerOutline" : "outline"} onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</Button> },
  ];
  return (
    <>
      <PageHeader title="People" subtitle="Manage officer accounts and see registered citizens." actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Create officer</Button>} />
      <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} searchPlaceholder="Search name or email"
        toolbar={<Select className="w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Account type"><option value="officer">Officers</option><option value="citizen">Citizens</option></Select>} />
      <Modal open={open} onClose={() => setOpen(false)} title="Create officer account" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={create}>Create account</Button></>}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="n" error={errors.name}><Input id="n" value={form.name} onChange={set("name")} error={errors.name} /></Field>
          <Field label="Email" htmlFor="e" error={errors.email}><Input id="e" type="email" value={form.email} onChange={set("email")} error={errors.email} /></Field>
          <Field label="Department" htmlFor="d" error={errors.department}><Select id="d" value={form.department} onChange={set("department")} error={errors.department}><option value="">Choose a department</option>{depts?.items.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Temporary password" htmlFor="p" error={errors.password} hint="Share it with the officer securely. They can change it in Profile & settings."><Input id="p" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} /></Field>
        </div>
      </Modal>
    </>
  );
}
