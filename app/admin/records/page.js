"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/components/Toast";
import DataTable from "@/components/DataTable";
import { Badge, Button, DemoBadge, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { CATEGORIES } from "@/lib/workflow";
import { api } from "@/lib/client";

const BLANK = { title: "", category: "", department: "", applicationSummary: "", responseSummary: "" };

export default function Records() {
  const { toast } = useToast();
  const [cat, setCat] = useState("");
  const { data, error, loading, reload } = useApi(`/api/admin/records?category=${encodeURIComponent(cat)}`);
  const { data: depts } = useApi("/api/admin/departments");
  const [editing, setEditing] = useState(null); const [form, setForm] = useState(BLANK); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null);
  const openForm = (r) => { setEditing(r || {}); setForm(r ? { title: r.title, category: r.category, department: r.department || "", applicationSummary: r.applicationSummary, responseSummary: r.responseSummary } : BLANK); setErrors({}); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setErrors({});
    try { await api(editing.id ? `/api/admin/records/${editing.id}` : "/api/admin/records", { method: editing.id ? "PUT" : "POST", body: form }); toast("Record saved. Its embedding will be recomputed on the next search."); setEditing(null); reload(); }
    catch (e) { setErrors(e.details || {}); toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function remove() { try { await api(`/api/admin/records/${del.id}`, { method: "DELETE" }); toast("Record deleted."); setDel(null); reload(); } catch (e) { toast(e.message, "error"); setDel(null); } }
  const cols = [
    { header: "Record", text: (r) => `${r.recordId} ${r.title} ${r.applicationSummary}`, render: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-xs text-navy-500">{r.recordId} {r.isDemo && <DemoBadge />}</p></div> },
    { header: "Category", text: (r) => r.category, render: (r) => <Badge tone="teal">{r.category}</Badge> },
    { header: "Department", text: (r) => r.departmentName, render: (r) => <span className="text-navy-700">{r.departmentName || "-"}</span> },
    { header: "Response summary", render: (r) => <p className="max-w-xs text-xs text-navy-600">{r.responseSummary.slice(0, 120)}{r.responseSummary.length > 120 ? "..." : ""}</p> },
    { header: "Embedding", render: (r) => <Badge tone={r.hasEmbedding ? "green" : "slate"}>{r.hasEmbedding ? "Stored" : "Pending"}</Badge> },
    { header: "", render: (r) => <div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => openForm(r)} aria-label={`Edit ${r.title}`}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="dangerOutline" onClick={() => setDel(r)} aria-label={`Delete ${r.title}`}><Trash2 className="h-4 w-4" /></Button></div> },
  ];
  return (
    <>
      <PageHeader title="Historical records" subtitle="Synthetic records the AI searches when it looks for similar past requests. They are fictional demo data, not real government records." actions={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" />Add record</Button>} />
      <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} searchPlaceholder="Search records"
        toolbar={<Select className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>} />
      <Modal wide open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Edit record" : "Add synthetic record"} footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save record</Button></>}>
        <div className="space-y-4">
          <Field label="Title" htmlFor="rt" error={errors.title}><Input id="rt" value={form.title} onChange={set("title")} error={errors.title} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category" htmlFor="rc" error={errors.category}><Select id="rc" value={form.category} onChange={set("category")} error={errors.category}><option value="">Choose</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Department" htmlFor="rd" error={errors.department}><Select id="rd" value={form.department} onChange={set("department")}><option value="">None</option>{depts?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          </div>
          <Field label="What the application asked" htmlFor="ra" error={errors.applicationSummary}><Textarea id="ra" rows={3} value={form.applicationSummary} onChange={set("applicationSummary")} error={errors.applicationSummary} /></Field>
          <Field label="What the response said" htmlFor="rr" error={errors.responseSummary}><Textarea id="rr" rows={3} value={form.responseSummary} onChange={set("responseSummary")} error={errors.responseSummary} /></Field>
        </div>
      </Modal>
      <Modal open={Boolean(del)} onClose={() => setDel(null)} title="Delete record?" footer={<><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm text-navy-700">{del?.recordId}: {del?.title} will no longer be used for similarity search.</p>
      </Modal>
    </>
  );
}
