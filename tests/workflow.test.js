// Offline tests: run with `npm test` (node --test). They use the JSON demo store and the local AI fallback,
// so no MongoDB, network or LLM is needed. bcrypt hashing and the real MiniLM model are NOT exercised here.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rti-'));
process.env.DEMO_DB_FILE = path.join(tmp, 'db.json');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9'; // nothing listens here -> forces the labelled local fallback
delete process.env.MONGODB_URI;

const store = (await import('../lib/store/memory.js')).default;
const { seedDemo } = await import('../lib/seedData.js');
const apps = await import('../services/applications.js');
const admin = await import('../services/admin.js');
const { validateApplication, validateRegister, validateFile, validatePassword } = await import('../lib/validation.js');
const { canTransition } = await import('../lib/workflow.js');
const localAi = await import('../lib/localAi.js');
const { HttpError } = await import('../lib/errors.js');
const { CHECKLIST } = await import('../lib/checklist.js');
const ALL = Object.fromEntries(CHECKLIST.map((i) => [i.key, true]));

const fakeHash = async (pw) => `fake$${pw}`; // stands in for bcrypt in tests
let users;
const user = (email) => store.findOne('users', { email });
const rejects = (p, status) => assert.rejects(p, (e) => e instanceof HttpError && (!status || e.status === status));

before(async () => {
  await seedDemo(store, { hash: fakeHash, opts: { timeoutMs: 500 } });
  users = { admin: await user('admin@rti-demo.test'), c1: await user('citizen1@rti-demo.test'), c2: await user('citizen2@rti-demo.test'), c3: await user('citizen3@rti-demo.test') };
});

test('validation: registration, application, password, files', () => {
  assert.equal(validateRegister({ name: 'A', email: 'bad', password: 'x' }).ok, false);
  assert.equal(validateRegister({ name: 'Asha Rao', email: 'ASHA@Example.com', password: 'Passw0rdX' }).value.email, 'asha@example.com');
  assert.ok(validatePassword('short1'));
  assert.equal(validatePassword('longenough1'), null);
  assert.equal(validateApplication({ subject: 'abc', description: 'short' }).ok, false);
  assert.equal(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 10, bytes: Buffer.from('%PDF-1.4') }).ok, true);
  assert.equal(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 10, bytes: Buffer.from('MZ\x90\x00') }).ok, false); // wrong magic bytes
  assert.equal(validateFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10, bytes: Buffer.from('MZ') }).ok, false);
  assert.equal(validateFile({ name: 'big.pdf', type: 'application/pdf', size: 6 * 1024 * 1024, bytes: Buffer.from('%PDF') }).ok, false);
});

test('workflow: allowed and forbidden transitions', () => {
  assert.ok(canTransition('submitted', 'ai_completed'));
  assert.ok(canTransition('awaiting_approval', 'response_issued'));
  assert.ok(!canTransition('submitted', 'response_issued'));
  assert.ok(!canTransition('under_review', 'response_issued')); // must be approved first
  assert.ok(!canTransition('closed', 'assigned'));
});

test('local AI fallback: classification and TF-IDF search are real computations and labelled', () => {
  assert.equal(localAi.classify('x', 'Details of the scholarship given to students of the college').category, 'Education');
  assert.equal(localAi.classify('x', 'blue elephants dance quietly').category, 'Other');
  const recs = [{ id: '1', record_id: 'A', title: 'Street light repairs ward', application_summary: 'street lights repaired', response_summary: 'Lights repaired.' }, { id: '2', record_id: 'B', title: 'Scholarship', application_summary: 'students scholarship', response_summary: 'Paid.' }];
  const r = localAi.search('how many street lights were repaired', recs, 2);
  assert.equal(r[0].record_id, 'A'); assert.ok(r[0].similarity > r[1].similarity);
});

test('seed ran through the real workflow and produced varied, consistent states', async () => {
  const all = await store.find('applications');
  assert.equal(all.length, 6);
  const statuses = new Set(all.map((a) => a.status));
  for (const s of ['response_issued', 'rejected', 'under_review', 'awaiting_approval', 'assigned']) assert.ok(statuses.has(s), `missing ${s}`);
  assert.equal(new Set(all.map((a) => a.applicationId)).size, 6);
  assert.ok(all.every((a) => /^RTI-\d{4}-[A-Z0-9]{6}$/.test(a.applicationId) && a.isDemo));
  const drafts = await store.find('response_drafts');
  assert.equal(drafts.length, 6);
  assert.ok(drafts.every((d) => ['template-fallback'].includes(d.generationMode)), 'fallback drafts must be labelled template-fallback');
  const history = await store.find('status_history', { application: all.find((a) => a.status === 'response_issued').id }, { sort: { createdAt: 1 } });
  assert.deepEqual(history.map((h) => h.newStatus), ['submitted', 'ai_completed', 'draft_generated', 'assigned', 'under_review', 'awaiting_approval', 'response_issued']);
});

test('citizen submission end to end: unique id, analysis, draft, assignment, notifications', async () => {
  const pdf = { name: 'proof.pdf', type: 'application/pdf', size: 8, bytes: Buffer.from('%PDF-1.4') };
  const app = await apps.submitApplication(store, users.c1, { subject: 'Power outage in Sector 5', description: 'Please provide the total power outage hours recorded for the transformer in Sector 5 last year and the reasons for the outages.', referenceInfo: '', department: null }, [pdf], { timeoutMs: 500 });
  assert.equal(app.status, 'assigned');
  assert.equal(app.category, 'Electricity');
  assert.equal(app.documents.length, 1);
  assert.ok(fs.existsSync(path.join(process.env.UPLOAD_DIR, app.applicationId, app.documents[0].storedName)));
  assert.equal(app.aiAnalysis.engine, 'local-js-fallback');
  assert.ok(app.aiAnalysis.fallback_reason);
  const officer = await store.get('users', app.assignedOfficer);
  assert.equal(officer.department, app.department, 'routed to an officer of the recommended department');
  const notes = await store.find('notifications', { application: app.id });
  assert.ok(notes.some((n) => n.recipient === users.c1.id) && notes.some((n) => n.recipient === officer.id));
  await rejects(apps.submitApplication(store, users.c1, { subject: 'Valid subject', description: 'A valid description that is long enough to pass.', department: 'does-not-exist' }, []), 400);
  await rejects(apps.submitApplication(store, users.c1, { subject: 'Valid subject', description: 'A valid description that is long enough to pass.' }, [{ name: 'x.exe', type: 'application/x-msdownload', size: 5, bytes: Buffer.from('MZ') }]), 400);
});

test('access control: a citizen cannot open or act on another citizen\'s application', async () => {
  const mine = (await store.find('applications', { citizen: users.c1.id }))[0];
  const asC1 = { id: users.c1.id, role: 'citizen' }; const asC2 = { id: users.c2.id, role: 'citizen' };
  assert.equal((await apps.getApplication(store, asC1, mine.applicationId)).applicationId, mine.applicationId);
  await rejects(apps.getApplication(store, asC2, mine.applicationId), 404);
  await rejects(apps.performAction(store, asC2, mine.applicationId, 'approve'), 403);
  const list = await apps.listApplications(store, asC2, {});
  assert.ok(list.items.every((i) => i.applicationId !== mine.applicationId));
});

test('citizen view hides internal AI material (drafts, similar records, officer notes)', async () => {
  const issued = await store.findOne('applications', { status: 'response_issued' });
  const v = await apps.getApplication(store, { id: issued.citizen, role: 'citizen' }, issued.applicationId);
  assert.equal(v.draft, undefined); assert.equal(v.actionHistory, undefined); assert.equal(v.aiAnalysis.similar_records, undefined);
  assert.ok(v.finalResponse.includes('DEMO DATA'));
  const { text } = await apps.responseDocument(store, { id: issued.citizen, role: 'citizen' }, issued.applicationId);
  assert.ok(text.includes(issued.applicationId));
});

test('officer approval workflow: AI cannot issue; placeholders block approval; only assigned officer acts', async () => {
  const app = await store.findOne('applications', { status: 'assigned', subject: 'Bus route fare revision' });
  const officer = await store.get('users', app.assignedOfficer);
  const unrelated = (await store.find('users', { role: 'officer' })).find((o) => o.id !== officer.id && o.department !== app.department);
  const peer = await admin.createOfficer(store, users.admin, { name: 'Peer Officer', email: 'peer@rti-demo.test', password: 'Passw0rd99', department: app.department }, fakeHash);
  const id = app.applicationId;
  await rejects(apps.performAction(store, { ...peer }, id, 'start_review'), 403);      // same department, not assigned: can see, cannot act
  await rejects(apps.performAction(store, unrelated, id, 'start_review'), 404);        // other department: cannot even see it
  await rejects(apps.performAction(store, users.admin, id, 'issue'), 403);    // admins never issue
  await rejects(apps.performAction(store, officer, id, 'issue'), 409);        // nothing approved yet
  await rejects(apps.performAction(store, officer, id, 'save_draft', { text: 'x'.repeat(30) }), 409); // must start review first
  await apps.performAction(store, officer, id, 'start_review');
  await apps.performAction(store, officer, id, 'mark_ready');
  await apps.performAction(store, officer, id, 'save_checklist', { checklist: ALL });
  await rejects(apps.performAction(store, officer, id, 'approve'), 409); // template draft still has placeholders
  await rejects(apps.performAction(store, officer, id, 'reject_draft', { remarks: 'no' }), 400);
  await apps.performAction(store, officer, id, 'reject_draft', { remarks: 'Needs verified figures before approval' });
  assert.equal((await store.findOne('applications', { applicationId: id })).status, 'under_review');
  await apps.performAction(store, officer, id, 'save_draft', { text: 'Sir/Madam, the revised fares were notified by an order that the office will share separately. Yours faithfully, PIO.' });
  await apps.performAction(store, officer, id, 'mark_ready');
  await rejects(apps.performAction(store, officer, id, 'approve'), 409); // checklist was reset by the edit
  await apps.performAction(store, officer, id, 'save_checklist', { checklist: ALL });
  await apps.performAction(store, officer, id, 'approve');
  let v = await apps.getApplication(store, officer, id);
  assert.equal(v.draft.approvalStatus, 'approved'); assert.equal(v.status, 'awaiting_approval');
  await apps.performAction(store, officer, id, 'save_draft', { text: 'Edited after approval, so the approval must be reset by the system.' });
  v = await apps.getApplication(store, officer, id);
  assert.equal(v.draft.approvalStatus, 'pending'); assert.equal(v.status, 'under_review');
  await apps.performAction(store, officer, id, 'mark_ready'); await apps.performAction(store, officer, id, 'save_checklist', { checklist: ALL }); await apps.performAction(store, officer, id, 'approve');
  v = await apps.performAction(store, officer, id, 'issue');
  assert.equal(v.status, 'response_issued'); assert.ok(v.finalResponse.includes('Edited after approval'));
  assert.ok((await store.find('notifications', { recipient: users.c3.id })).some((n) => /has been issued/.test(n.message)));
  assert.ok(v.actionHistory.some((a) => a.action === 'response.issued'));
  await apps.performAction(store, officer, id, 'close');
  await rejects(apps.performAction(store, officer, id, 'start_review'), 409);
});

test('officer and admin dashboards are computed from stored data', async () => {
  for (const o of await store.find('users', { role: 'officer' })) {
    const s = await apps.officerStats(store, { id: o.id });
    const mine = await store.find('applications', { assignedOfficer: o.id });
    assert.equal(s.total, mine.length);
    assert.equal(s.pending + s.underReview + s.awaitingApproval + s.completed, s.total);
  }
  const a = await admin.adminStats(store);
  assert.equal(a.totals.applications, (await store.find('applications')).length);
  assert.equal(a.byStatus.reduce((n, x) => n + x.value, 0), a.totals.applications);
  assert.equal(a.byMonth.length, 6);
});

test('admin: officers, departments, records, settings, audit log', async () => {
  const dept = (await store.find('departments'))[0];
  const off = await admin.createOfficer(store, users.admin, { name: 'New Officer', email: 'new.officer@rti-demo.test', password: 'Passw0rd99', department: dept.id }, fakeHash);
  assert.equal(off.role, 'officer'); assert.equal(off.passwordHash, undefined);
  await rejects(admin.createOfficer(store, users.admin, { name: 'Dup', email: 'new.officer@rti-demo.test', password: 'Passw0rd99', department: dept.id }, fakeHash), 409);
  await rejects(admin.setUserActive(store, users.admin, users.admin.id, false), 400);
  assert.equal((await admin.setUserActive(store, users.admin, off.id, false)).active, false);
  const rec = await admin.saveRecord(store, users.admin, { title: 'Test record title', category: 'Education', department: dept.id, applicationSummary: 'A synthetic application summary text.', responseSummary: 'A synthetic response summary text.' });
  assert.match(rec.recordId, /^DEMO-HIST-\d{3}$/);
  await admin.saveRecord(store, users.admin, { title: 'Edited record title', category: 'Education', applicationSummary: 'Edited application summary text.', responseSummary: 'Edited response summary text.' }, rec.id);
  await admin.deleteRecord(store, users.admin, rec.id);
  await rejects(admin.deleteDepartment(store, users.admin, dept.id), 409); // in use
  const newDept = await admin.saveDepartment(store, users.admin, { name: 'Test Department', categories: ['Other'], description: 'x' });
  await admin.saveDepartment(store, users.admin, { name: 'Test Department 2', categories: ['Other'] }, newDept.id);
  await admin.deleteDepartment(store, users.admin, newDept.id);
  await admin.updateSettings(store, users.admin, { announcement: 'Maintenance on Sunday', similarRecordsCount: 2 });
  await rejects(admin.updateSettings(store, users.admin, { similarRecordsCount: 9 }), 400);
  const log = await admin.listAudit(store, { action: 'record.' });
  assert.equal(log.total, 3);
});

test('settings are honoured: auto-assign off leaves the draft unassigned for an admin to route', async () => {
  await admin.updateSettings(store, users.admin, { autoAssign: false, similarRecordsCount: 3 });
  const app = await apps.submitApplication(store, users.c2, { subject: 'Tender details for road work', description: 'Please provide the tender notice and contractor name for the highway repair work near the town.' }, [], { timeoutMs: 500 });
  assert.equal(app.status, 'draft_generated'); assert.equal(app.assignedOfficer, null);
  const officer = await store.findOne('users', { role: 'officer', active: true });
  const v = await apps.performAction(store, users.admin, app.applicationId, 'reassign', { officerId: officer.id });
  assert.equal(v.status, 'assigned'); assert.equal(v.assignedOfficer.id, officer.id);
  await admin.updateSettings(store, users.admin, { autoAssign: true });
});

test('demo-store transaction rolls back on failure', async () => {
  const before = await store.count('notifications');
  await assert.rejects(store.transaction(async () => { await store.insert('notifications', { recipient: users.c1.id, message: 'x' }); throw new Error('boom'); }));
  assert.equal(await store.count('notifications'), before);
});
