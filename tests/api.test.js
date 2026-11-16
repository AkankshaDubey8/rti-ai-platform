// Route-level tests: executes the real API route handlers (auth, RBAC, uploads, workflow) in-process on the demo store.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rti-api-'));
process.env.DEMO_DB_FILE = path.join(tmp, 'db.json');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
process.env.AI_TIMEOUT_MS = '800';
process.env.DEMO_PASSWORD = 'Demo@12345';
delete process.env.MONGODB_URI;

const { call, callRaw } = await import('./helpers/client.mjs');
const R = {
  login: await import('../app/api/auth/login/route.js'), register: await import('../app/api/auth/register/route.js'), logout: await import('../app/api/auth/logout/route.js'),
  me: await import('../app/api/auth/me/route.js'), apps: await import('../app/api/applications/route.js'), app: await import('../app/api/applications/[id]/route.js'),
  actions: await import('../app/api/applications/[id]/actions/route.js'), response: await import('../app/api/applications/[id]/response/route.js'),
  doc: await import('../app/api/documents/[id]/[docId]/route.js'), notes: await import('../app/api/notifications/route.js'), stats: await import('../app/api/stats/route.js'),
  pub: await import('../app/api/public/route.js'), depts: await import('../app/api/departments/route.js'),
  aUsers: await import('../app/api/admin/users/route.js'), aUser: await import('../app/api/admin/users/[id]/route.js'), aDepts: await import('../app/api/admin/departments/route.js'),
  aRecords: await import('../app/api/admin/records/route.js'), aAudit: await import('../app/api/admin/audit/route.js'), aSettings: await import('../app/api/admin/settings/route.js'), aSystem: await import('../app/api/admin/system/route.js'),
};
const { resetRateLimits } = await import('../lib/rateLimit.js');
const PW = 'Demo@12345';
const S = {};
const login = async (email, password = PW) => (resetRateLimitsMaybe(), await loginRaw(email, password));
const loginRaw = async (email, password = PW) => (await call(R.login, 'POST', '/api/auth/login', { body: { email, password } }));
let keepLock = false;
function resetRateLimitsMaybe() { if (!keepLock) resetRateLimits(); }
before(async () => {
  for (const [k, e] of Object.entries({ admin: 'admin@rti-demo.test', c1: 'citizen1@rti-demo.test', c2: 'citizen2@rti-demo.test', o: 'officer.municipal@rti-demo.test' })) {
    const r = await login(e); assert.equal(r.status, 200, `login ${e}: ${r.text}`); S[k] = r.session;
  }
});
const pdfBytes = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], { type: 'application/pdf' });

test('auth: login failures, session cookie, logout, /me', async () => {
  assert.equal((await login('citizen1@rti-demo.test', 'wrong-password1')).status, 401);
  assert.equal((await login('nobody@rti-demo.test')).status, 401);
  assert.equal((await call(R.login, 'POST', '/api/auth/login', { body: { email: 'bad', password: '' } })).status, 400);
  const me = await call(R.me, 'GET', '/api/auth/me', { cookie: S.c1 });
  assert.equal(me.json.user.role, 'citizen'); assert.equal(me.json.user.passwordHash, undefined);
  assert.equal((await call(R.me, 'GET', '/api/auth/me')).status, 401);
  assert.equal((await call(R.me, 'GET', '/api/auth/me', { cookie: 'rti_session=garbage' })).status, 401);
  const out = await call(R.logout, 'POST', '/api/auth/logout'); assert.equal(out.status, 200);
});

test('registration creates a citizen (never a privileged role) and rejects duplicates', async () => {
  const r = await call(R.register, 'POST', '/api/auth/register', { body: { name: 'New Person', email: 'new.person@example.com', password: 'Passw0rd1', role: 'admin' } });
  assert.equal(r.status, 201); assert.equal(r.json.user.role, 'citizen'); assert.ok(r.session);
  assert.equal((await call(R.register, 'POST', '/api/auth/register', { body: { name: 'Again', email: 'new.person@example.com', password: 'Passw0rd1' } })).status, 409);
});

test('role-based access: citizens cannot reach officer/admin APIs; officers cannot reach admin APIs', async () => {
  for (const [mod, method, url] of [[R.aUsers, 'GET', '/api/admin/users'], [R.aDepts, 'GET', '/api/admin/departments'], [R.aRecords, 'GET', '/api/admin/records'], [R.aAudit, 'GET', '/api/admin/audit'], [R.aSettings, 'GET', '/api/admin/settings'], [R.aSystem, 'GET', '/api/admin/system']]) {
    assert.equal((await call(mod, method, url)).status, 401, `anon ${url}`);
    assert.equal((await call(mod, method, url, { cookie: S.c1 })).status, 403, `citizen ${url}`);
    assert.equal((await call(mod, method, url, { cookie: S.o })).status, 403, `officer ${url}`);
    assert.equal((await call(mod, method, url, { cookie: S.admin })).status, 200, `admin ${url}`);
  }
  const mine = (await call(R.apps, 'GET', '/api/applications', { cookie: S.c1 })).json.items[0];
  assert.equal((await call(R.actions, 'POST', `/api/applications/${mine.applicationId}/actions`, { cookie: S.c1, body: { action: 'approve' }, params: { id: mine.applicationId } })).status, 403);
  assert.equal((await call(R.apps, 'POST', '/api/applications', { cookie: S.o, form: new FormData() })).status, 403); // officers cannot file
});

test('CSRF: cross-origin mutating requests are refused', async () => {
  const r = await call(R.login, 'POST', '/api/auth/login', { body: { email: 'citizen1@rti-demo.test', password: PW }, headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('submission end to end through the route: multipart, upload, analysis, tracking, download rules', async () => {
  const fd = new FormData();
  fd.set('subject', 'Street light outage in Ward 3'); fd.set('description', 'Please provide the number of street lights repaired in Ward 3 in 2023 and the amount spent on their maintenance.'); fd.set('referenceInfo', 'Ref 42');
  fd.append('documents', pdfBytes(), 'evidence.pdf');
  const created = await call(R.apps, 'POST', '/api/applications', { cookie: S.c1, form: fd });
  assert.equal(created.status, 201, created.text);
  const a = created.json.application; S.appId = a.applicationId;
  assert.match(a.applicationId, /^RTI-\d{4}-[A-Z0-9]{6}$/); assert.equal(a.documents.length, 1); assert.equal(a.status, 'assigned');
  assert.equal(a.category, 'Municipal services'); assert.equal(a.aiAnalysis.similar_records, undefined, 'citizen response hides internal records');
  // invalid submissions
  const bad = new FormData(); bad.set('subject', 'abc'); bad.set('description', 'short');
  const r1 = await call(R.apps, 'POST', '/api/applications', { cookie: S.c1, form: bad }); assert.equal(r1.status, 400); assert.ok(r1.json.details.subject && r1.json.details.description);
  const exe = new FormData(); exe.set('subject', 'Valid subject here'); exe.set('description', 'A sufficiently long description of the request.'); exe.append('documents', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'a.exe');
  assert.equal((await call(R.apps, 'POST', '/api/applications', { cookie: S.c1, form: exe })).status, 400);
  // tracking + isolation
  const list = await call(R.apps, 'GET', '/api/applications?search=ward%203', { cookie: S.c1 }); assert.equal(list.json.total, 1);
  assert.equal((await call(R.app, 'GET', `/api/applications/${S.appId}`, { cookie: S.c2, params: { id: S.appId } })).status, 404);
  assert.equal((await call(R.app, 'GET', `/api/applications/${S.appId}`, { cookie: S.c1, params: { id: S.appId } })).status, 200);
  // documents: owner ok, other citizen 404, anonymous 401
  const docId = a.documents[0].id;
  const dl = await callRaw(R.doc, 'GET', '/x', { cookie: S.c1, params: { id: S.appId, docId } });
  assert.equal(dl.status, 200); assert.match(dl.headers.get('content-disposition'), /attachment/); assert.ok(dl.buffer.toString().startsWith('%PDF'));
  assert.equal((await call(R.doc, 'GET', '/x', { cookie: S.c2, params: { id: S.appId, docId } })).status, 404);
  assert.equal((await call(R.doc, 'GET', '/x', { params: { id: S.appId, docId } })).status, 401);
  assert.equal((await call(R.doc, 'GET', '/x', { cookie: S.c1, params: { id: S.appId, docId: '../../etc/passwd' } })).status, 404);
});

test('officer workflow through the routes, then citizen reads the issued response', async () => {
  const detail = await call(R.app, 'GET', `/api/applications/${S.appId}`, { cookie: S.admin, params: { id: S.appId } });
  const officerEmail = (await call(R.aUsers, 'GET', '/api/admin/users?role=officer', { cookie: S.admin })).json.items.find((o) => o.id === detail.json.application.assignedOfficer.id).email;
  const oc = (await login(officerEmail)).session;
  const act = (action, extra = {}, cookie = oc) => call(R.actions, 'POST', `/api/applications/${S.appId}/actions`, { cookie, body: { action, ...extra }, params: { id: S.appId } });
  assert.equal((await act('issue')).status, 409);
  assert.equal((await act('approve', {}, S.admin)).status, 403);
  assert.equal((await act('start_review')).status, 200);
  assert.equal((await act('save_draft', { text: 'Sir/Madam, 40 street lights were repaired in Ward 3 during 2023. Yours faithfully, PIO.' })).status, 200);
  assert.equal((await act('mark_ready')).status, 200);
  assert.equal((await act('approve')).status, 409, 'checklist not completed');
  assert.equal((await act('save_checklist', { checklist: { answered_each: true } })).status, 200);
  assert.equal((await act('approve')).status, 409, 'checklist incomplete');
  const all = { answered_each: true, verified_facts: true, exemptions: true, personal_data: true, appeal_info: true, tone: true };
  assert.equal((await act('save_checklist', { checklist: all })).status, 200);
  assert.equal((await act('approve')).status, 200);
  const done = await act('issue'); assert.equal(done.status, 200); assert.equal(done.json.application.status, 'response_issued');
  const cit = await call(R.app, 'GET', `/api/applications/${S.appId}`, { cookie: S.c1, params: { id: S.appId } });
  assert.match(cit.json.application.finalResponse, /40 street lights/); assert.equal(cit.json.application.draft, undefined);
  const dl = await call(R.response, 'GET', '/x', { cookie: S.c1, params: { id: S.appId } });
  assert.equal(dl.status, 200); assert.match(dl.text, /40 street lights/);
  const notes = await call(R.notes, 'GET', '/api/notifications', { cookie: S.c1 });
  assert.ok(notes.json.items.some((n) => /has been issued/.test(n.message)));
  assert.ok(notes.json.unread > 0);
});

test('stats are role-specific and computed from data', async () => {
  const c = (await call(R.stats, 'GET', '/api/stats', { cookie: S.c1 })).json; assert.ok(c.total >= 1 && 'inProgress' in c);
  const o = (await call(R.stats, 'GET', '/api/stats', { cookie: S.o })).json; assert.equal(o.pending + o.underReview + o.awaitingApproval + o.completed, o.total);
  const a = (await call(R.stats, 'GET', '/api/stats', { cookie: S.admin })).json; assert.ok(a.totals.applications >= 7);
});

test('admin APIs: create officer, deactivate (blocks login), settings validation, audit trail', async () => {
  const dept = (await call(R.aDepts, 'GET', '/api/admin/departments', { cookie: S.admin })).json.items[0];
  const mk = await call(R.aUsers, 'POST', '/api/admin/users', { cookie: S.admin, body: { name: 'Route Officer', email: 'route.officer@rti-demo.test', password: 'Passw0rd99', department: dept.id } });
  assert.equal(mk.status, 201); assert.equal(mk.json.user.passwordHash, undefined);
  assert.equal((await login('route.officer@rti-demo.test', 'Passw0rd99')).status, 200);
  assert.equal((await call(R.aUser, 'PATCH', `/api/admin/users/${mk.json.user.id}`, { cookie: S.admin, body: { active: false }, params: { id: mk.json.user.id } })).status, 200);
  assert.equal((await login('route.officer@rti-demo.test', 'Passw0rd99')).status, 403);
  assert.equal((await call(R.aSettings, 'PUT', '/api/admin/settings', { cookie: S.admin, body: { similarRecordsCount: 99 } })).status, 400);
  const audit = await call(R.aAudit, 'GET', '/api/admin/audit?action=officer.', { cookie: S.admin }); assert.ok(audit.json.total >= 1);
});

test('profile and password change', async () => {
  const bad = await call(R.me, 'PATCH', '/api/auth/me', { cookie: S.c2, body: { currentPassword: 'nope', newPassword: 'Newpass123' } }); assert.equal(bad.status, 400);
  assert.equal((await call(R.me, 'PATCH', '/api/auth/me', { cookie: S.c2, body: { name: 'Priya S', phone: '9999999999' } })).json.user.name, 'Priya S');
});

test('regression: password change revokes other sessions; failed logins lock the account; too many files rejected', async () => {
  const a = (await login('citizen3@rti-demo.test')).session; const b = (await login('citizen3@rti-demo.test')).session;
  const ch = await call(R.me, 'PATCH', '/api/auth/me', { cookie: a, body: { currentPassword: PW, newPassword: 'Changed123' } });
  assert.equal(ch.status, 200); assert.ok(ch.session, 'current browser gets a fresh session');
  assert.equal((await call(R.me, 'GET', '/api/auth/me', { cookie: b })).status, 401, 'old session revoked');
  assert.equal((await call(R.me, 'GET', '/api/auth/me', { cookie: ch.session })).status, 200);
  keepLock = true; resetRateLimits();
  for (let i = 0; i < 8; i++) await login('citizen3@rti-demo.test', 'wrong-Pass1');
  const locked = await login('citizen3@rti-demo.test', 'Changed123'); assert.equal(locked.status, 429, 'account locked after repeated failures');
  assert.equal((await login('citizen1@rti-demo.test')).status, 200, 'other accounts unaffected');
  keepLock = false;
  const fd = new FormData(); fd.set('subject', 'Many files here'); fd.set('description', 'A sufficiently long description of the request.');
  for (let i = 0; i < 6; i++) fd.append('documents', pdfBytes(), `f${i}.pdf`);
  const r = await call(R.apps, 'POST', '/api/applications', { cookie: S.c1, form: fd }); assert.equal(r.status, 400); assert.ok(r.json.details.documents);
});
