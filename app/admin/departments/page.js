"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import DataTable from "@/components/DataTable";
import { Badge, Button, DemoBadge, Field, Input, Modal, PageHeader, Textarea } from "@/components/ui";
import { CATEGORIES } from "@/lib/workflow";
import { api } from "@/lib/client";

const BLANK = { name: "", description: "", categories: [], active: true, contact: { email: "", phone: "", address: "" } };

export default function Departments() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi("/api/admin/departments");
  const [editing, setEditing] = useState(null); const [form, setForm] = useState(BLANK); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null);
  const openForm = (d) => { setEditing(d || {}); setForm(d ? { ...BLANK, ...d, contact: { ...BLANK.contact, ...(d.contact || {}) } } : BLANK); setErrors({}); };
  const toggleCat = (c) => setForm({ ...form, categories: form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c] });

  async function save() {
    setBusy(true); setErrors({});
    try { await api(editing.id ? `/api/admin/departments/${editing.id}` : "/api/admin/departments", { method: editing.id ? "PUT" : "POST", body: form }); toast("Department saved."); setEditing(null); reload(); }
    catch (e) { setErrors(e.details || {}); toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function remove() {
    try { await api(`/api/admin/departments/${del.id}`, { method: "DELETE" }); toast("Department deleted."); setDel(null); reload(); } catch (e) { toast(e.message, "error"); setDel(null); }
  }
  const cols = [
    { header: "Department", text: (d) => `${d.name} ${d.description}`, render: (d) => <div><p className="font-semibold">{d.name} {d.isDemo && <DemoBadge />}</p><p className="text-xs text-navy-500">{d.description}</p></div> },
    { header: "Categories", text: (d) => d.categories.join(" "), render: (d) => <div className="flex flex-wrap gap-1">{d.categories.map((c) => <Badge key={c} tone="teal">{c}</Badge>)}</div> },
    { header: "Officers / applications / records", render: (d) => `${d.officerCount} / ${d.applicationCount} / ${d.recordCount}` },
    { header: "Status", render: (d) => <Badge tone={d.active ? "green" : "slate"}>{d.active ? "Active" : "Inactive"}</Badge> },
    { header: "", render: (d) => <div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => openForm(d)} aria-label={`Edit ${d.name}`}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="dangerOutline" onClick={() => setDel(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-4 w-4" /></Button></div> },
  ];
  return (
    <>
      <PageHeader title="Departments" subtitle="Departments receive routed applications. The AI uses the categories you assign here." actions={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" />Add department</Button>} />
      <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} searchPlaceholder="Search departments" />
      <Modal wide open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Edit department" : "Add department"} footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save department</Button></>}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="dn" error={errors.name}><Input id="dn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} /></Field>
          <Field label="Description" htmlFor="dd"><Textarea id="dd" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Categories handled" error={errors.categories}><div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} type="button" onClick={() => toggleCat(c)} aria-pressed={form.categories.includes(c)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${form.categories.includes(c) ? "border-brand-600 bg-brand-600 text-white" : "border-navy-200 text-navy-700 hover:bg-navy-50"}`}>{c}</button>)}</div></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Contact email" htmlFor="ce"><Input id="ce" value={form.contact.email} onChange={(e) => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })} /></Field><Field label="Contact phone" htmlFor="cp"><Input id="cp" value={form.contact.phone} onChange={(e) => setForm({ ...form, contact: { ...form.contact, phone: e.target.value } })} /></Field></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-brand-600" />Active (can receive applications)</label>
        </div>
      </Modal>
      <Modal open={Boolean(del)} onClose={() => setDel(null)} title="Delete department?" footer={<><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm text-navy-700">{del?.name} will be removed. Departments that still have officers, applications or records cannot be deleted. Deactivate them instead.</p>
      </Modal>
    </>
  );
}
