import { HttpError } from '../lib/errors.js';
import { CATEGORIES, TERMINAL, statusLabel } from '../lib/workflow.js';
import { validateDepartment, validatePassword, validateRecord } from '../lib/validation.js';
import { DEFAULT_SETTINGS, audit, getSettings } from './common.js';
import { toCsv } from '../lib/csv.js';
import { aiHealth } from '../lib/ai.js';
import { appMode } from '../lib/env.js';
import { smtpConfigured } from '../lib/mailer.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicRow = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, department: u.department || null, isDemo: Boolean(u.isDemo), createdAt: u.createdAt });
const count = (rows, key) => Object.entries(rows.reduce((m, r) => ({ ...m, [key(r)]: (m[key(r)] || 0) + 1 }), {})).map(([name, value]) => ({ name, value }));

// ---------- analytics ----------
export async function adminStats(store) {
  const [apps, users, records, drafts, depts, feedback, tickets, outbox] = await Promise.all([store.find('applications'), store.find('users'), store.find('historical_records'), store.find('response_drafts'), store.find('departments'), store.find('feedback'), store.find('support_tickets', { status: 'open' }), store.find('email_outbox')]);
  const deptName = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const months = []; const d = new Date(); d.setDate(1);
  for (let i = 5; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`); }
  const issued = apps.filter((a) => a.respondedAt);

  const avgHours = issued.length ? issued.reduce((s, a) => s + (new Date(a.respondedAt) - new Date(a.createdAt)), 0) / issued.length / 36e5 : null;
  return {
    totals: { applications: apps.length, citizens: users.filter((u) => u.role === 'citizen').length, officers: users.filter((u) => u.role === 'officer').length, activeOfficers: users.filter((u) => u.role === 'officer' && u.active).length,
      departments: depts.length, historicalRecords: records.length, draftsAwaitingApproval: apps.filter((a) => a.status === 'awaiting_approval').length, completed: apps.filter((a) => TERMINAL.includes(a.status)).length, unassigned: apps.filter((a) => !a.assignedOfficer && !TERMINAL.includes(a.status)).length },
    byStatus: count(apps, (a) => statusLabel(a.status)), byCategory: count(apps, (a) => a.category), byDepartment: count(apps, (a) => deptName[a.department] || 'Unrouted'),
    byMonth: months.map((m) => ({ name: m, value: apps.filter((a) => String(a.createdAt).startsWith(m)).length })),
    generationModes: count(drafts, (x) => (x.generationMode?.startsWith('llm:') ? 'LLM' : 'Template fallback')),
    activity: Array.from({ length: 14 }, (_, i) => { const day = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { name: day.slice(5), value: apps.filter((a) => String(a.createdAt).startsWith(day)).length }; }),
    satisfaction: { average: feedback.length ? Number((feedback.reduce((n, f) => n + f.rating, 0) / feedback.length).toFixed(1)) : null, responses: feedback.length }, openTickets: tickets.length, emails: { total: outbox.length, sent: outbox.filter((e) => e.status === 'sent').length, notSent: outbox.filter((e) => e.status === 'not_sent_no_smtp').length, failed: outbox.filter((e) => e.status === 'failed').length },
    embeddedRecords: records.filter((r) => r.embedding?.length).length, avgHoursToResponse: avgHours === null ? null : Number(avgHours.toFixed(1)),
  };
}

// ---------- users ----------
export async function listUsers(store, { role, search = '' } = {}) {
  const [users, depts] = await Promise.all([store.find('users', role ? { role } : {}, { sort: { name: 1 } }), store.find('departments')]);
  const dn = Object.fromEntries(depts.map((x) => [x.id, x.name])); const q = search.trim().toLowerCase();
  return users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q)).map((u) => ({ ...publicRow(u), departmentName: dn[u.department] || null }));
}

export async function createOfficer(store, admin, b = {}, hash) {
  const errors = {}; const name = String(b.name || '').trim(); const email = String(b.email || '').trim().toLowerCase();
  if (name.length < 2) errors.name = 'Enter the officer’s name.';
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  const pw = validatePassword(b.password); if (pw) errors.password = pw;
  const dept = b.department ? await store.get('departments', b.department) : null;
  if (!dept) errors.department = 'Choose a department.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  try {
    const u = await store.insert('users', { name, email, passwordHash: await hash(b.password), role: 'officer', active: true, department: dept.id, phone: '', isDemo: false });
    await audit(store, admin, 'officer.created', 'user', u.id, { email });
    return publicRow(u);
  } catch (e) { if (e.code === 'DUPLICATE') throw new HttpError(409, 'That email is already registered.', { email: 'Already registered.' }); throw e; }
}

export async function setUserActive(store, admin, id, active) {
  if (id === admin.id) throw new HttpError(400, 'You cannot deactivate your own account.');
  const u = await store.get('users', id);
  if (!u) throw new HttpError(404, 'User not found.');
  const updated = await store.update('users', id, { active: Boolean(active) });
  await audit(store, admin, active ? 'user.activated' : 'user.deactivated', 'user', id, { email: u.email });
  return publicRow(updated);
}

// ---------- departments ----------
export async function listDepartments(store, { activeOnly = false, withCounts = false } = {}) {
  const depts = await store.find('departments', activeOnly ? { active: true } : {}, { sort: { name: 1 } });
  if (!withCounts) return depts;
  return Promise.all(depts.map(async (d) => ({ ...d, officerCount: await store.count('users', { role: 'officer', department: d.id }), applicationCount: await store.count('applications', { department: d.id }), recordCount: await store.count('historical_records', { department: d.id }) })));
}
export async function saveDepartment(store, admin, input, id = null) {
  const v = validateDepartment(input, CATEGORIES);
  if (!v.ok) throw new HttpError(400, 'Please fix the highlighted fields.', v.errors);
  const clash = await store.findOne('departments', { name: v.value.name });
  if (clash && clash.id !== id) throw new HttpError(409, 'A department with this name already exists.', { name: 'Already exists.' });
  let dept;
  if (id) { dept = await store.update('departments', id, v.value); if (!dept) throw new HttpError(404, 'Department not found.'); } else dept = await store.insert('departments', { ...v.value, isDemo: false });
  await audit(store, admin, id ? 'department.updated' : 'department.created', 'department', dept.id, { name: dept.name });
  return dept;
}
export async function deleteDepartment(store, admin, id) {
  const [apps, officers, recs] = await Promise.all([store.count('applications', { department: id }), store.count('users', { department: id }), store.count('historical_records', { department: id })]);
  if (apps || officers || recs) throw new HttpError(409, 'This department is in use. Deactivate it instead of deleting it.');
  if (!(await store.remove('departments', id))) throw new HttpError(404, 'Department not found.');
  await audit(store, admin, 'department.deleted', 'department', id);
}

// ---------- historical records ----------
export async function listRecords(store, { search = '', category = '' } = {}) {
  const [recs, depts] = await Promise.all([store.find('historical_records', category ? { category } : {}, { sort: { recordId: 1 } }), store.find('departments')]);
  const dn = Object.fromEntries(depts.map((d) => [d.id, d.name])); const q = search.trim().toLowerCase();
  return recs.filter((r) => !q || [r.title, r.recordId, r.applicationSummary].some((t) => String(t).toLowerCase().includes(q)))
    .map(({ embedding, ...r }) => ({ ...r, departmentName: dn[r.department] || null, hasEmbedding: Boolean(embedding?.length) }));
}
async function nextRecordId(store) {
  const all = await store.find('historical_records');
  const max = all.reduce((m, r) => Math.max(m, Number(String(r.recordId).replace(/\D/g, '')) || 0), 0);
  return `DEMO-HIST-${String(max + 1).padStart(3, '0')}`;
}
export async function saveRecord(store, admin, input, id = null) {
  const v = validateRecord(input, CATEGORIES);
  if (!v.ok) throw new HttpError(400, 'Please fix the highlighted fields.', v.errors);
  if (v.value.department && !(await store.get('departments', v.value.department))) throw new HttpError(400, 'Choose a valid department.', { department: 'Not found.' });
  // text changed -> stored embedding is stale; it is recomputed on the next semantic search
  const doc = { ...v.value, embedding: [], embeddingModel: '' };
  const rec = id ? await store.update('historical_records', id, doc) : await store.insert('historical_records', { ...doc, recordId: await nextRecordId(store), metadata: { synthetic: true }, isDemo: true });
  if (!rec) throw new HttpError(404, 'Record not found.');
  await audit(store, admin, id ? 'record.updated' : 'record.created', 'historical_record', rec.id, { recordId: rec.recordId });
  const { embedding, ...rest } = rec; return rest;
}
export async function deleteRecord(store, admin, id) {
  if (!(await store.remove('historical_records', id))) throw new HttpError(404, 'Record not found.');
  await audit(store, admin, 'record.deleted', 'historical_record', id);
}

// ---------- audit log & settings ----------
export async function listAudit(store, { page = 1, pageSize = 20, action = '', q = '' } = {}) {
  const rows = await store.find('audit_logs', {}, { sort: { createdAt: -1 } });
  const s = q.trim().toLowerCase();
  const filtered = rows.filter((r) => (!action || r.action.startsWith(action)) && (!s || [r.userName, r.action, r.entityId].some((v) => String(v).toLowerCase().includes(s))));
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100); const p = Math.max(Number(page) || 1, 1);
  return { items: filtered.slice((p - 1) * size, p * size), total: filtered.length, page: p, pageSize: size, totalPages: Math.max(1, Math.ceil(filtered.length / size)) };
}
export async function updateSettings(store, admin, b = {}) {
  const next = {};
  if (b.platformName !== undefined) next.platformName = String(b.platformName).trim().slice(0, 60) || DEFAULT_SETTINGS.platformName;
  if (b.announcement !== undefined) next.announcement = String(b.announcement).trim().slice(0, 200);
  if (b.autoAssign !== undefined) next.autoAssign = Boolean(b.autoAssign);
  if (b.allowRegistrations !== undefined) next.allowRegistrations = Boolean(b.allowRegistrations);
  if (b.similarRecordsCount !== undefined) { const n = Number(b.similarRecordsCount); if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, 'Similar records must be a whole number from 1 to 5.'); next.similarRecordsCount = n; }
  if (b.responseDeadlineDays !== undefined) { const n = Number(b.responseDeadlineDays); if (!Number.isInteger(n) || n < 1 || n > 90) throw new HttpError(400, 'The target response time must be a whole number of days from 1 to 90.'); next.responseDeadlineDays = n; }
  for (const [key, value] of Object.entries(next)) {
    const row = await store.findOne('settings', { key });
    if (row) await store.update('settings', row.id, { value }); else await store.insert('settings', { key, value });
  }
  await audit(store, admin, 'settings.updated', 'settings', 'platform', next);
  return getSettings(store);
}

// ---------- health monitoring ----------
export async function systemHealth(store) {
  const t0 = Date.now(); const db = { kind: store.kind, ok: true };
  try { db.counts = Object.fromEntries(await Promise.all(['users', 'applications', 'departments', 'historical_records', 'response_drafts', 'audit_logs'].map(async (c) => [c, await store.count(c)]))); db.latencyMs = Date.now() - t0; } catch (e) { db.ok = false; db.error = e.message; }
  const t1 = Date.now(); const ai = await aiHealth(); ai.latencyMs = Date.now() - t1;
  return { mode: appMode(), db, ai, smtp: { configured: smtpConfigured() }, checkedAt: new Date().toISOString() };
}

// ---------- CSV exports (no passwords, no request text) ----------
export async function exportCsv(store, admin, type) {
  const [users, depts] = await Promise.all([store.find('users'), store.find('departments')]);
  const un = Object.fromEntries(users.map((u) => [u.id, u.name])); const dn = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const T = {
    applications: async () => ({ cols: ['applicationId', 'subject', 'category', 'status', ['department', (r) => dn[r.department] || ''], ['officer', (r) => un[r.assignedOfficer] || ''], 'language', 'createdAt', 'respondedAt', 'isDemo'], rows: await store.find('applications') }),
    audit: async () => ({ cols: ['createdAt', 'userName', 'role', 'action', 'entityType', 'entityId', 'metadata'], rows: await store.find('audit_logs') }),
    users: async () => ({ cols: ['name', 'email', 'role', 'active', ['department', (r) => dn[r.department] || ''], 'createdAt', 'isDemo'], rows: users }),
    feedback: async () => ({ cols: ['createdAt', 'rating', 'comment'], rows: await store.find('feedback') }),
    support: async () => ({ cols: ['createdAt', 'name', 'email', 'subject', 'status', 'message'], rows: await store.find('support_tickets') }),
    outbox: async () => ({ cols: ['createdAt', 'to', 'subject', 'status', 'error'], rows: await store.find('email_outbox') }),
  };
  if (!T[type]) throw new HttpError(400, `Unknown export. Choose one of: ${Object.keys(T).join(', ')}.`);
  const { cols, rows } = await T[type]();
  await audit(store, admin, 'export.csv', 'export', type, { rows: rows.length });
  return toCsv(cols.map((c) => (Array.isArray(c) ? { header: c[0], value: c[1] } : { header: c, value: c })), rows);
}
export const listOutbox = async (store) => (await store.find('email_outbox', {}, { limit: 100 })).map(({ text, ...r }) => r);
export const listFeedback = async (store) => {
  const [rows, apps] = await Promise.all([store.find('feedback', {}, { limit: 100 }), store.find('applications')]); const a = Object.fromEntries(apps.map((x) => [x.id, x.applicationId]));
  return rows.map((f) => ({ id: f.id, applicationId: a[f.application], rating: f.rating, comment: f.comment, createdAt: f.createdAt }));
};
