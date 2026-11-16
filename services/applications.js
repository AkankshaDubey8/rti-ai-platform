import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import * as ai from '../lib/ai.js';
import { OPEN_FOR_OFFICER, STATUS_ORDER, TERMINAL, statusLabel } from '../lib/workflow.js';
import { deadlineInfo, priorityFor } from '../lib/deadlines.js';
import { CHECKLIST, checklistComplete, missingChecklist } from '../lib/checklist.js';
import { detectLanguage } from '../lib/lang.js';
import { validateFile, safeFileName } from '../lib/validation.js';
import { saveFile } from '../lib/files.js';
import { audit, getSettings, nameMaps, notify, transition } from './common.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLACEHOLDERS = /\[TO BE VERIFIED BY OFFICER|\[OFFICER TO INSERT|NO LLM USED|GENERATED FROM A FIXED TEMPLATE/;

// ---------- access control ----------
export function canView(user, app) {
  if (user.role === 'admin') return true;
  if (user.role === 'citizen') return app.citizen === user.id;
  if (user.role === 'officer') return app.assignedOfficer === user.id || Boolean(app.department && app.department === user.department);
  return false;
}
export async function loadApplication(store, user, applicationId) {
  const app = await store.findOne('applications', { applicationId: String(applicationId) });
  if (!app || !canView(user, app)) throw new HttpError(404, 'Application not found.'); // same answer for "missing" and "not yours"
  return app;
}
const assertAssigned = (user, app) => {
  if (user.role === 'officer' && app.assignedOfficer !== user.id) throw new HttpError(403, 'Only the officer assigned to this application can do this.');
};

// ---------- AI payload mapping ----------
const toAiApp = (a) => ({ application_id: a.applicationId, subject: a.subject, description: a.translation?.text ? `${a.description}\n\n[English translation of the request above] ${a.translation.text}` : a.description, reference_info: a.referenceInfo || null, selected_department: a.selectedDepartment || null });
const toAiDept = (d) => ({ id: d.id, name: d.name, description: d.description || '', categories: d.categories || [], active: d.active !== false });
const toAiRecord = (r, deptName) => ({ id: r.id, record_id: r.recordId, title: r.title, department: deptName[r.department] || null, category: r.category, application_summary: r.applicationSummary, response_summary: r.responseSummary, embedding: r.embedding?.length ? r.embedding : null, embedding_model: r.embeddingModel || null });

async function persistEmbeddings(store, map = {}, model) {
  for (const [id, vec] of Object.entries(map || {})) await store.update('historical_records', id, { embedding: vec, embeddingModel: model || '' });
}

// ---------- pipeline: analyse -> draft -> assign ----------
async function runAnalysis(store, app, opts) {
  const [settings, maps, records] = await Promise.all([getSettings(store), nameMaps(store), store.find('historical_records', {}, { sort: { recordId: 1 } })]);
  const analysis = await ai.analyze({ application: toAiApp(app), departments: maps.depts.map(toAiDept), records: records.map((r) => toAiRecord(r, maps.dept)), top_k: settings.similarRecordsCount }, opts);
  await persistEmbeddings(store, analysis.new_embeddings, analysis.search?.embedding_model);
  const { new_embeddings, ...rest } = analysis;
  const override = app.aiAnalysis?.override;
  const aiAnalysis = { ...rest, analyzedAt: new Date().toISOString(), ...(override ? { override } : {}) };
  const recommended = analysis.department_recommendation?.recommended;
  return store.update('applications', app.id, { category: analysis.classification.category, department: override ? app.department : recommended?.id || app.selectedDepartment || null, aiAnalysis });
}

async function createDraft(store, app, opts) {
  const maps = await nameMaps(store);
  const retrieved = app.aiAnalysis?.similar_records || [];
  const res = await ai.generateDraft({ application: toAiApp(app), category: app.category, department_name: maps.dept[app.department] || null, records: retrieved, similarity_method: app.aiAnalysis?.search?.method || 'embedding' }, opts);
  const existing = await store.findOne('response_drafts', { application: app.id });
  const doc = {
    application: app.id, generated: res.draft, currentText: res.draft.draft_text, generationMode: res.generation_mode, llmError: res.llm_error || '',
    retrievedRecords: retrieved.map((r) => ({ record: r.id, recordId: r.record_id, title: r.title, similarity: r.similarity })),
    approvalStatus: 'pending', reviewRemarks: '', approvedBy: null, approvedAt: null, issuedAt: null, version: (existing?.version || 0) + 1,
    officerEdits: existing?.officerEdits || [],
  };
  const draft = existing ? await store.update('response_drafts', existing.id, doc) : await store.insert('response_drafts', doc);
  const fresh = app.status === 'ai_completed' ? await transition(store, app, 'draft_generated', null, `Draft generated (${res.generation_mode})`) : app;
  return { app: fresh, draft };
}

async function autoAssign(store, app) {
  const officers = await store.find('users', { role: 'officer', active: true });
  if (!officers.length) return app;
  const sameDept = officers.filter((o) => o.department && o.department === app.department);
  const pool = sameDept.length ? sameDept : officers;
  const loads = await Promise.all(pool.map(async (o) => ({ o, n: await store.count('applications', { assignedOfficer: o.id, status: { $in: OPEN_FOR_OFFICER } }) })));
  loads.sort((a, b) => a.n - b.n);
  const officer = loads[0].o;
  const updated = await transition(store, app, 'assigned', null, `Automatically assigned to ${officer.name}${sameDept.length ? '' : ' (no officer in the recommended department)'}`, { assignedOfficer: officer.id });
  await notify(store, officer.id, `New RTI application ${app.applicationId} assigned to you.`, 'assignment', app.id);
  await notify(store, app.citizen, `Your application ${app.applicationId} has been assigned to an officer.`, 'status', app.id);
  return updated;
}

export async function runPipeline(store, appId, opts = {}) {
  let app = await store.get('applications', appId);
  app = await runAnalysis(store, app, opts);
  if (app.status === 'submitted') app = await transition(store, app, 'ai_completed', null, 'Automated AI analysis completed');
  if (app.status === 'ai_completed') ({ app } = await createDraft(store, app, opts));
  const settings = await getSettings(store);
  if (settings.autoAssign && app.status === 'draft_generated') app = await autoAssign(store, app);
  return app;
}

// ---------- citizen submission ----------
async function newApplicationId(store) {
  for (let i = 0; i < 8; i++) {
    const id = `RTI-${new Date().getFullYear()}-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;
    if (!(await store.findOne('applications', { applicationId: id }))) return id;
  }
  throw new HttpError(500, 'Could not generate a unique application ID. Please try again.');
}

export async function submitApplication(store, citizen, input, files = [], opts = {}) {
  if (files.length > 5) throw new HttpError(400, 'Attach at most 5 files.');
  const checked = files.map((f) => ({ f, v: validateFile(f) }));
  const bad = checked.find((c) => !c.v.ok);
  if (bad) throw new HttpError(400, bad.v.error, { documents: bad.v.error });
  let selectedDepartment = null;
  if (input.department) {
    const d = await store.get('departments', input.department);
    if (!d || d.active === false) throw new HttpError(400, 'The selected department is not available.', { department: 'Choose a department from the list.' });
    selectedDepartment = d.id;
  }
  const applicationId = await newApplicationId(store);
  const documents = [];
  for (const { f, v } of checked) {
    const saved = await saveFile(applicationId, f.bytes, v.ext);
    documents.push({ id: saved.id, originalName: safeFileName(f.name), storedName: saved.storedName, mimeType: f.type, size: f.size, storage: 'local' });
  }
  const app = await store.insert('applications', {
    applicationId, citizen: citizen.id, subject: input.subject, description: input.description, referenceInfo: input.referenceInfo || '',
    applicant: input.applicant || { name: citizen.name, phone: '', address: '' }, language: detectLanguage(input.description).code,
    translation: input.translation && detectLanguage(input.description).code !== 'en' ? { text: input.translation.text, engine: input.translation.engine, at: new Date().toISOString(), note: 'Machine translation. The original text is authoritative.' } : null,
    selectedDepartment, category: 'Other', department: selectedDepartment, aiAnalysis: null, status: 'submitted', assignedOfficer: null, documents,
    rejectionReason: '', finalResponse: '', respondedAt: null, isDemo: Boolean(citizen.isDemo),
  });
  await store.insert('status_history', { application: app.id, previousStatus: null, newStatus: 'submitted', updatedBy: citizen.id, updatedByName: citizen.name, remarks: 'Application submitted' });
  await notify(store, citizen.id, `Application ${applicationId} was submitted. AI analysis is starting.`, 'status', app.id);
  try { await runPipeline(store, app.id, opts); } catch (e) { console.error('[pipeline]', e); }
  return store.get('applications', app.id);
}

// ---------- reading ----------
const DAY = 864e5;
const attention = (a, d) => (['response_issued', 'rejected'].includes(a.status) && Date.now() - new Date(a.updatedAt) < 14 * DAY ? (a.status === 'rejected' ? 'Your request was rejected: read the reason' : 'A response is ready to read')
  : d.state === 'overdue' ? 'The target response date has passed' : '');

export async function listApplications(store, user, { search = '', status = '', category = '', department = '', from = '', to = '', sort = 'newest', attention: onlyAttention = '', page = 1, pageSize = 10 } = {}) {
  const base = user.role === 'citizen' ? { citizen: user.id } : user.role === 'officer' ? { assignedOfficer: user.id } : {};
  const [apps, maps, settings] = await Promise.all([store.find('applications', base, { sort: { createdAt: -1 } }), nameMaps(store), getSettings(store)]);
  const days = settings.responseDeadlineDays; const staff = user.role !== 'citizen'; const q = search.trim().toLowerCase();
  const fromT = from && !Number.isNaN(Date.parse(from)) ? Date.parse(from) : null; const toT = to && !Number.isNaN(Date.parse(to)) ? Date.parse(to) + DAY - 1 : null;
  let rows = apps.map((a) => { const deadline = deadlineInfo(a, days); return { a, deadline, priority: staff ? priorityFor(a, days) : null, attn: user.role === 'citizen' ? attention(a, deadline) : '',
    docMatch: Boolean(q && (a.documents || []).some((d) => d.extracted?.text?.toLowerCase().includes(q))) }; });
  rows = rows.filter(({ a, attn, docMatch }) => (!status || a.status === status) && (!category || a.category === category) && (!department || a.department === department)
    && (fromT === null || new Date(a.createdAt) >= fromT) && (toT === null || new Date(a.createdAt) <= toT) && (!onlyAttention || attn)
    && (!q || docMatch || [a.applicationId, a.subject, a.category, maps.user[a.citizen]].some((v) => String(v || '').toLowerCase().includes(q))));
  const byStatus = (r) => STATUS_ORDER.indexOf(r.a.status);
  const sorters = { newest: (x, y) => new Date(y.a.createdAt) - new Date(x.a.createdAt), oldest: (x, y) => new Date(x.a.createdAt) - new Date(y.a.createdAt), status: (x, y) => byStatus(x) - byStatus(y),
    due: (x, y) => (x.deadline.state === 'done') - (y.deadline.state === 'done') || new Date(x.deadline.dueAt) - new Date(y.deadline.dueAt), priority: (x, y) => (y.priority?.score || 0) - (x.priority?.score || 0) || new Date(x.a.createdAt) - new Date(y.a.createdAt) };
  rows.sort(sorters[sort] || sorters.newest);
  const items = rows.map(({ a, deadline, priority, attn, docMatch }) => ({
    id: a.id, applicationId: a.applicationId, subject: a.subject, category: a.category, status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt, isDemo: a.isDemo, language: a.language,
    departmentName: maps.dept[a.department] || null, officerName: maps.user[a.assignedOfficer] || null, deadline: { state: deadline.state, daysLeft: deadline.daysLeft, dueAt: deadline.dueAt },
    ...(staff ? { citizenName: maps.user[a.citizen] || null, priority } : { needsAttention: Boolean(attn), attentionReason: attn }), ...(docMatch ? { matchedInDocument: true } : {}),
  }));
  const size = Math.min(Math.max(Number(pageSize) || 10, 1), 50); const p = Math.max(Number(page) || 1, 1);
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, pageSize: size, totalPages: Math.max(1, Math.ceil(items.length / size)) };
}

const citizenAnalysis = (a) => a && ({ category: a.classification?.category, keywords: a.classification?.keywords || [], explanation: a.classification?.explanation, method: a.classification?.method,
  recommendedDepartment: a.department_recommendation?.recommended?.name || null, departmentReason: a.department_recommendation?.reason, engine: a.engine, analyzedAt: a.analyzedAt, disclaimer: a.disclaimer });

export async function viewApplication(store, user, app) {
  const [maps, history, draft, settings, feedback] = await Promise.all([nameMaps(store), store.find('status_history', { application: app.id }, { sort: { createdAt: 1 } }), store.findOne('response_drafts', { application: app.id }), getSettings(store), store.findOne('feedback', { application: app.id })]);
  const staff = user.role !== 'citizen';
  const view = {
    id: app.id, applicationId: app.applicationId, subject: app.subject, description: app.description, referenceInfo: app.referenceInfo, category: app.category, status: app.status,
    createdAt: app.createdAt, updatedAt: app.updatedAt, isDemo: app.isDemo, rejectionReason: app.rejectionReason || '', language: app.language || 'en', translation: app.translation || null, applicant: app.applicant || null,
    finalResponse: app.status === 'response_issued' || app.status === 'closed' ? app.finalResponse : '', respondedAt: app.respondedAt, deadline: deadlineInfo(app, settings.responseDeadlineDays), deadlineDays: settings.responseDeadlineDays,
    department: app.department ? { id: app.department, name: maps.dept[app.department] } : null,
    assignedOfficer: app.assignedOfficer ? { id: app.assignedOfficer, name: maps.user[app.assignedOfficer] } : null,
    documents: (app.documents || []).map((d) => ({ id: d.id, originalName: d.originalName, mimeType: d.mimeType, size: d.size, hasText: Boolean(d.extracted), ...(d.extracted ? { summary: d.extracted.summary, summaryMethod: d.extracted.summaryMethod, extractionMethod: d.extracted.method, ocrUsed: d.extracted.ocrUsed } : {}) })),
    timeline: history.map((h) => ({ id: h.id, previousStatus: h.previousStatus, newStatus: h.newStatus, by: h.updatedByName, remarks: h.remarks, at: h.createdAt })),
    feedback: feedback ? { rating: feedback.rating, comment: feedback.comment } : null,
    viewer: { role: user.role, isAssignedOfficer: user.role === 'officer' && app.assignedOfficer === user.id },
  };
  if (!staff) return { ...view, aiAnalysis: citizenAnalysis(app.aiAnalysis) };
  const [citizen, actions, notes] = await Promise.all([store.get('users', app.citizen), store.find('audit_logs', { entityId: app.applicationId }, { sort: { createdAt: 1 } }), store.find('internal_notes', { application: app.id }, { sort: { createdAt: 1 } })]);
  return {
    ...view, aiAnalysis: app.aiAnalysis, citizen: citizen && { id: citizen.id, name: citizen.name, email: citizen.email }, priority: priorityFor(app, settings.responseDeadlineDays),
    notes: notes.map((n) => ({ id: n.id, authorName: n.authorName, text: n.text, createdAt: n.createdAt })),
    draft: draft && { id: draft.id, generated: draft.generated, currentText: draft.currentText, generationMode: draft.generationMode, llmError: draft.llmError, approvalStatus: draft.approvalStatus, checklist: draft.checklist || {},
      reviewRemarks: draft.reviewRemarks, retrievedRecords: draft.retrievedRecords, officerEdits: draft.officerEdits, version: draft.version, issuedAt: draft.issuedAt },
    actionHistory: actions.map((a) => ({ id: a.id, action: a.action, by: a.userName, role: a.role, at: a.createdAt, metadata: a.metadata })),
  };
}

export async function getApplication(store, user, applicationId) {
  return viewApplication(store, user, await loadApplication(store, user, applicationId));
}

export async function responseDocument(store, user, applicationId) {
  const app = await loadApplication(store, user, applicationId);
  if (!['response_issued', 'closed'].includes(app.status) || !app.finalResponse) throw new HttpError(404, 'No issued response is available for this application.');
  const maps = await nameMaps(store);
  const lines = [`RTI application: ${app.applicationId}`, `Subject: ${app.subject}`, `Department: ${maps.dept[app.department] || 'Not recorded'}`, `Issued on: ${new Date(app.respondedAt).toDateString()}`];
  if (app.isDemo) lines.push('NOTE: DEMO DATA - this is a demonstration record, not an official response.');
  lines.push('', '------------------------------------------------------------', '', app.finalResponse);
  const text = lines.join('\n');
  return { filename: `${app.applicationId}-response.txt`, text };
}

// ---------- officer / admin actions ----------
const need = (cond, msg, status = 409) => { if (!cond) throw new HttpError(status, msg); };
const text = (v, min, max, label) => { const t = typeof v === 'string' ? v.trim() : ''; need(t.length >= min && t.length <= max, `${label} must be ${min}-${max} characters.`, 400); return t; };

const ACTIONS = {
  async start_review({ store, user, app }) {
    need(app.status === 'assigned', 'Review can only start on an assigned application.');
    await transition(store, app, 'under_review', user, 'Officer started review');
    await notify(store, app.citizen, `Application ${app.applicationId} is now under review.`, 'status', app.id);
  },
  async save_draft({ store, user, app, draft, payload }) {
    need(draft, 'No draft exists yet.'); need(['under_review', 'awaiting_approval'].includes(app.status), 'Start the review before editing the draft.');
    const body = text(payload.text, 20, 20000, 'The draft');
    if (app.status === 'awaiting_approval') await transition(store, app, 'under_review', user, 'Draft edited after being sent for approval');
    await store.update('response_drafts', draft.id, { currentText: body, approvalStatus: 'pending', approvedBy: null, approvedAt: null, checklist: {},
      officerEdits: [...(draft.officerEdits || []), { editedBy: user.id, editedByName: user.name, editedAt: new Date().toISOString(), note: String(payload.note || '').slice(0, 200) }] });
    await audit(store, user, 'draft.saved', 'application', app.applicationId, { chars: body.length });
  },
  async mark_ready({ store, user, app, draft }) {
    need(draft?.currentText?.trim().length >= 20, 'Write the draft response first.');
    await transition(store, app, 'awaiting_approval', user, 'Draft sent for approval');
    await audit(store, user, 'draft.ready_for_approval', 'application', app.applicationId);
  },
  async approve({ store, user, app, draft }) {
    need(draft, 'No draft exists yet.');
    need(app.status === 'awaiting_approval', 'Send the draft for approval first.');
    const left = draft.currentText.match(new RegExp(PLACEHOLDERS.source, 'g'));
    need(!left, 'The draft still contains placeholders or the template banner. Resolve and remove them before approving.');
    need(checklistComplete(draft.checklist), `Complete the quality checklist before approving: ${missingChecklist(draft.checklist).join('; ')}.`);
    await store.update('response_drafts', draft.id, { approvalStatus: 'approved', approvedBy: user.id, approvedAt: new Date().toISOString(), reviewRemarks: '' });
    await audit(store, user, 'draft.approved', 'application', app.applicationId, { version: draft.version });
  },
  async reject_draft({ store, user, app, draft, payload }) {
    need(draft, 'No draft exists yet.');
    need(app.status === 'awaiting_approval', 'Only drafts awaiting approval can be rejected.');
    const remarks = text(payload.remarks, 5, 500, 'Remarks');
    await transition(store, app, 'under_review', user, 'Draft returned for rework');
    await store.update('response_drafts', draft.id, { approvalStatus: 'rejected', reviewRemarks: remarks, approvedBy: null, approvedAt: null });
    await audit(store, user, 'draft.rejected', 'application', app.applicationId, { remarks });
  },
  async issue({ store, user, app, draft }) {
    need(app.status === 'awaiting_approval' && draft?.approvalStatus === 'approved', 'Approve the draft before issuing the response.');
    await store.transaction(async () => {
      const issuedAt = new Date().toISOString();
      await store.update('response_drafts', draft.id, { approvalStatus: 'issued', issuedAt });
      await transition(store, app, 'response_issued', user, 'Response issued by authorised officer', { finalResponse: draft.currentText, respondedAt: issuedAt });
      await notify(store, app.citizen, `A response to application ${app.applicationId} has been issued. You can read it now.`, 'response', app.id);
      await audit(store, user, 'response.issued', 'application', app.applicationId, { draftVersion: draft.version });
    });
  },
  async reject_application({ store, user, app, draft, payload }) {
    need(OPEN_FOR_OFFICER.includes(app.status), 'This application cannot be rejected in its current state.');
    const reason = text(payload.reason, 10, 1000, 'The reason');
    await store.transaction(async () => {
      await transition(store, app, 'rejected', user, 'Application rejected by officer', { rejectionReason: reason });
      if (draft) await store.update('response_drafts', draft.id, { approvalStatus: 'rejected', reviewRemarks: 'Application rejected' });
      await notify(store, app.citizen, `Application ${app.applicationId} was rejected. Open it to read the reason.`, 'response', app.id);
      await audit(store, user, 'application.rejected', 'application', app.applicationId, { reason });
    });
  },
  async add_note({ store, user, app, payload }) {
    const body = text(payload.text, 3, 2000, 'The note');
    await store.insert('internal_notes', { application: app.id, author: user.id, authorName: user.name, text: body });
    await audit(store, user, 'note.added', 'application', app.applicationId, { chars: body.length });
  },
  async save_checklist({ store, user, app, draft, payload }) {
    need(draft, 'No draft exists yet.'); need(['under_review', 'awaiting_approval'].includes(app.status), 'Start the review before using the checklist.');
    const checklist = Object.fromEntries(CHECKLIST.map((i) => [i.key, payload.checklist?.[i.key] === true]));
    const keepApproval = checklistComplete(checklist) || draft.approvalStatus !== 'approved';
    await store.update('response_drafts', draft.id, { checklist, ...(keepApproval ? {} : { approvalStatus: 'pending', approvedBy: null, approvedAt: null }) });
    await audit(store, user, 'checklist.saved', 'application', app.applicationId, { complete: checklistComplete(checklist) });
  },
  async close({ store, user, app }) {
    await transition(store, app, 'closed', user, 'Application closed');
    await notify(store, app.citizen, `Application ${app.applicationId} has been closed.`, 'status', app.id);
    await audit(store, user, 'application.closed', 'application', app.applicationId);
  },
  async override_department({ store, user, app, payload }) {
    need(!TERMINAL.includes(app.status), 'Finished applications cannot be re-routed.');
    const dept = await store.get('departments', payload.departmentId);
    need(dept && dept.active !== false, 'Choose an active department.', 400);
    const override = { by: user.name, from: app.department, to: dept.id, toName: dept.name, at: new Date().toISOString(), note: String(payload.note || '').slice(0, 300) };
    await store.update('applications', app.id, { department: dept.id, aiAnalysis: { ...(app.aiAnalysis || {}), override } });
    await audit(store, user, 'department.overridden', 'application', app.applicationId, { to: dept.name });
  },
  async reanalyze({ store, user, app, opts }) {
    need(!TERMINAL.includes(app.status) && app.status !== 'submitted', 'Re-analysis is not available in this state.');
    await runAnalysis(store, app, opts);
    await audit(store, user, 'analysis.rerun', 'application', app.applicationId);
  },
  async regenerate_draft({ store, user, app, opts }) {
    need(['assigned', 'under_review'].includes(app.status), 'The draft can only be regenerated before it is sent for approval.');
    await createDraft(store, app, opts);
    await audit(store, user, 'draft.regenerated', 'application', app.applicationId);
  },
  async reassign({ store, user, app, payload }) {
    need(!TERMINAL.includes(app.status) && app.status !== 'submitted', 'This application cannot be reassigned now.');
    const officer = await store.get('users', payload.officerId);
    need(officer && officer.role === 'officer' && officer.active, 'Choose an active officer.', 400);
    await store.transaction(async () => {
      if (app.status === 'assigned') await store.update('applications', app.id, { assignedOfficer: officer.id });
      else await transition(store, app, 'assigned', user, `Reassigned to ${officer.name}`, { assignedOfficer: officer.id });
      await notify(store, officer.id, `Application ${app.applicationId} was assigned to you by an administrator.`, 'assignment', app.id);
      await audit(store, user, 'application.reassigned', 'application', app.applicationId, { to: officer.name });
    });
  },
  async run_pipeline({ store, user, app, opts }) {
    need(['submitted', 'ai_completed', 'draft_generated'].includes(app.status), 'The automated pipeline has already finished for this application.');
    await runPipeline(store, app.id, opts);
    await audit(store, user, 'pipeline.rerun', 'application', app.applicationId);
  },
};
const ROLES = { override_department: ['officer', 'admin'], reanalyze: ['officer', 'admin'], reassign: ['admin'], run_pipeline: ['admin'] };

export async function performAction(store, user, applicationId, action, payload = {}, opts = {}) {
  const run = ACTIONS[action];
  if (!run) throw new HttpError(400, 'Unknown action.');
  if (!(ROLES[action] || ['officer']).includes(user.role)) throw new HttpError(403, 'You do not have permission to do this.');
  const app = await loadApplication(store, user, applicationId);
  assertAssigned(user, app);
  const draft = await store.findOne('response_drafts', { application: app.id });
  await run({ store, user, app, draft, payload, opts });
  return getApplication(store, user, applicationId);
}

// ---------- dashboards ----------
export async function officerStats(store, user) {
  const [apps, settings] = await Promise.all([store.find('applications', { assignedOfficer: user.id }), getSettings(store)]);
  const by = (f) => apps.filter((a) => f(a.status)).length; const days = settings.responseDeadlineDays;
  const byCategory = {}; apps.forEach((a) => { byCategory[a.category] = (byCategory[a.category] || 0) + 1; });
  const pr = apps.map((a) => priorityFor(a, days));
  return { total: apps.length, pending: by((s) => ['submitted', 'ai_completed', 'draft_generated', 'assigned'].includes(s)), underReview: by((s) => s === 'under_review'),
    awaitingApproval: by((s) => s === 'awaiting_approval'), completed: by((s) => TERMINAL.includes(s)), overdue: apps.filter((a) => deadlineInfo(a, days).state === 'overdue').length,
    highPriority: pr.filter((p) => p.level === 'high').length, byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })) };
}

export async function citizenStats(store, user) {
  const [apps, settings, drafts, prefs] = await Promise.all([store.find('applications', { citizen: user.id }), getSettings(store), store.count('application_drafts', { user: user.id }), store.findOne('user_prefs', { user: user.id })]);
  const days = settings.responseDeadlineDays; const by = (f) => apps.filter((a) => f(a.status)).length;
  const withD = apps.map((a) => ({ a, d: deadlineInfo(a, days) }));
  const ids = apps.map((a) => a.id); const subj = Object.fromEntries(apps.map((a) => [a.id, a]));
  const history = ids.length ? await store.find('status_history', { application: { $in: ids } }, { sort: { createdAt: -1 }, limit: 8 }) : [];
  return {
    total: apps.length, inProgress: by((s) => !TERMINAL.includes(s)), pending: by((s) => !TERMINAL.includes(s)), responded: by((s) => s === 'response_issued' || s === 'closed'), rejected: by((s) => s === 'rejected'), completed: by((s) => TERMINAL.includes(s)), drafts,
    attention: withD.map(({ a, d }) => ({ a, why: attention(a, d) })).filter((x) => x.why).slice(0, 5).map(({ a, why }) => ({ applicationId: a.applicationId, subject: a.subject, reason: why })),
    deadlines: withD.filter(({ d }) => d.state !== 'done').sort((x, y) => new Date(x.d.dueAt) - new Date(y.d.dueAt)).slice(0, 5).map(({ a, d }) => ({ applicationId: a.applicationId, subject: a.subject, dueAt: d.dueAt, daysLeft: d.daysLeft, state: d.state })),
    activity: history.map((h) => ({ id: h.id, applicationId: subj[h.application]?.applicationId, subject: subj[h.application]?.subject, newStatus: h.newStatus, remarks: h.remarks, at: h.createdAt })),
    recentlyViewed: (prefs?.recentlyViewed || []).slice(0, 5).map((r) => { const a = apps.find((x) => x.applicationId === r.applicationId); return a && { applicationId: a.applicationId, subject: a.subject, status: a.status, at: r.at }; }).filter(Boolean),
    recent: apps.slice(0, 4).map((a) => ({ applicationId: a.applicationId, subject: a.subject, status: a.status, createdAt: a.createdAt })),
  };
}

export const statusSummary = (s) => statusLabel(s);
