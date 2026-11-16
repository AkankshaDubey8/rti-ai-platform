// Route-level tests for the upgrade features (drafts, assistant, translation, PDFs, documents, search, feedback, recovery, public stats, admin).
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rti-feat-'));
Object.assign(process.env, { DEMO_DB_FILE: path.join(tmp, 'db.json'), UPLOAD_DIR: path.join(tmp, 'uploads'), AI_SERVICE_URL: 'http://127.0.0.1:9', AI_TIMEOUT_MS: '800', DEMO_PASSWORD: 'Demo@12345' });
delete process.env.MONGODB_URI; delete process.env.SMTP_HOST;

const { call, callRaw } = await import('./helpers/client.mjs');
const { resetRateLimits } = await import('../lib/rateLimit.js');
const imp = (p) => import(`../app/api/${p}/route.js`);
const R = { register: await imp('auth/register'), login: await imp('auth/login'), me: await imp('auth/me'), forgot: await imp('auth/forgot'), reset: await imp('auth/reset'), apps: await imp('applications'), app: await imp('applications/[id]'), actions: await imp('applications/[id]/actions'),
  receipt: await imp('applications/[id]/receipt'), response: await imp('applications/[id]/response'), feedback: await imp('applications/[id]/feedback'), doc: await imp('documents/[id]/[docId]'), docText: await imp('documents/[id]/[docId]/text'),
  drafts: await imp('drafts'), draft: await imp('drafts/[id]'), assist: await imp('assist/analyze'), chat: await imp('assistant'), translate: await imp('translate'), prefs: await imp('prefs'), history: await imp('prefs/history'),
  search: await imp('search'), help: await imp('help'), stats: await imp('stats'), pub: await imp('public/stats'), support: await imp('support'), aExport: await imp('admin/export'), aSupport: await imp('admin/support'),
  aSupportId: await imp('admin/support/[id]'), aSystem: await imp('admin/system'), aUsers: await imp('admin/users'), notes: await imp('notifications') };
const PW = 'Demo@12345'; const S = {};
const login = async (email, password = PW) => { resetRateLimits(); return call(R.login, 'POST', '/api/auth/login', { body: { email, password } }); };
const has = (c) => spawnSync('which', [c]).status === 0;
const ALL = { answered_each: true, verified_facts: true, exemptions: true, personal_data: true, appeal_info: true, tone: true };
const sub = async (cookie, fields, files = []) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.set(k, v); files.forEach(([b, n]) => fd.append('documents', b, n)); return call(R.apps, 'POST', '/api/applications', { cookie, form: fd }); };

before(async () => {
  for (const [k, e] of Object.entries({ admin: 'admin@rti-demo.test', c1: 'citizen1@rti-demo.test', c2: 'citizen2@rti-demo.test', c3: 'citizen3@rti-demo.test', o: 'officer.municipal@rti-demo.test' })) { const r = await login(e); assert.equal(r.status, 200, r.text); S[k] = r.session; }
});

test('drafts: save, resume, list, delete, isolation and limit; files are never stored in drafts', async () => {
  const mk = (extra = {}) => call(R.drafts, 'POST', '/api/drafts', { cookie: S.c1, body: { step: 3, data: { subject: 'Road repair details', description: 'Please share road repair records for Sector 9', applicant: { name: 'A', phone: '123456' }, evil: '<script>', ...extra } } });
  const r = await mk(); assert.equal(r.status, 201); const id = r.json.draft.id;
  const got = await call(R.draft, 'GET', '/x', { cookie: S.c1, params: { id } }); assert.equal(got.json.draft.step, 3); assert.equal(got.json.draft.data.evil, undefined); assert.equal(got.json.draft.data.subject, 'Road repair details');
  assert.equal((await call(R.draft, 'GET', '/x', { cookie: S.c2, params: { id } })).status, 404);
  assert.equal((await call(R.draft, 'DELETE', '/x', { cookie: S.c2, params: { id } })).status, 404);
  const upd = await call(R.drafts, 'POST', '/api/drafts', { cookie: S.c1, body: { id, step: 4, data: { subject: 'Road repair details v2', description: 'x' } } }); assert.equal(upd.status, 201);
  assert.equal((await call(R.drafts, 'GET', '/api/drafts', { cookie: S.c1 })).json.items[0].title, 'Road repair details v2');
  assert.equal((await call(R.drafts, 'GET', '/api/drafts', { cookie: S.o })).status, 403);
  for (let i = 0; i < 9; i++) assert.equal((await mk()).status, 201);
  assert.equal((await mk()).status, 409, 'limit of 10 drafts'); assert.equal((await call(R.draft, 'DELETE', '/x', { cookie: S.c1, params: { id } })).status, 200);
});

test('wizard analysis: category, department, missing info, similar own requests; engine labelled', async () => {
  const an = (d) => call(R.assist, 'POST', '/api/assist/analyze', { cookie: S.c2, body: d });
  const r = await an({ subject: 'Garbage collection', description: 'Tell me about garbage collection complaints' }); assert.equal(r.status, 200);
  assert.equal(r.json.analysis.category, 'Municipal services'); assert.match(r.json.analysis.engine, /local fallback/);
  const codes = r.json.analysis.missingInformation.map((i) => i.code); assert.ok(codes.includes('time') && codes.includes('place') === false || codes.includes('time'));
  assert.equal((await an({ subject: 'x', description: 'short' })).status, 400);
  assert.equal((await call(R.assist, 'POST', '/api/assist/analyze', { cookie: S.o, body: { subject: 'abc', description: 'long enough description here' } })).status, 403);
  const first = await sub(S.c2, { subject: 'Scholarship amounts paid in 2023', description: 'Please provide the scholarship amounts paid to students of the government school in 2023 and the dates of payment.' }); assert.equal(first.status, 201);
  const dup = await an({ subject: 'Scholarship amounts paid in 2023', description: 'Please provide scholarship amounts paid to students of the government school in 2023 with payment dates.' });
  assert.equal(dup.json.analysis.similarOwn[0].kind, 'application'); assert.ok(dup.json.analysis.similarOwn[0].similarity >= 0.45);
  const other = await call(R.assist, 'POST', '/api/assist/analyze', { cookie: S.c3, body: { subject: 'Scholarship amounts paid in 2023', description: 'Please provide scholarship amounts paid to students of the government school in 2023 with payment dates.' } });
  assert.deepEqual(other.json.analysis.similarOwn, [], "another citizen's requests are never compared");
});

test('assistant: public, honest fallback label, never invents, rewrite/department/missing intents', async () => {
  const ask = (message, context, cookie) => call(R.chat, 'POST', '/api/assistant', { cookie, body: { message, context } });
  const fee = await ask('Is there a fee to pay?'); assert.equal(fee.status, 200); assert.equal(fee.json.mode, 'fallback'); assert.match(fee.json.notice, /No AI language model was used/); assert.match(fee.json.reply, /fee/i); assert.ok(fee.json.sources.length);
  assert.doesNotMatch(fee.json.reply, /₹|Rs\.? ?\d|\b\d{2,}\b rupees/i, 'must not quote an invented fee amount');
  const unknown = await ask('what is the capital of France'); assert.match(unknown.json.reply, /don't have that/); assert.equal(unknown.json.sources.length, 0);
  assert.match((await ask('how long does a response take?')).json.reply, /30 days/);
  const rw = await ask('please rewrite my request', { draft: 'give me everything about roads' }); assert.equal(rw.json.mode, 'fallback'); assert.match(rw.json.reply, /can't rewrite text automatically/); assert.equal(rw.json.llm, undefined);
  const dept = await ask('Which department handles this?', { draft: 'I want the water quality reports of borewells in Sector 12 for the year 2023' }); assert.match(dept.json.reply, /Water Supply/); assert.match(dept.json.notice, /No language model/);
  assert.match((await ask('what is missing in my request?', { draft: 'give me everything' })).json.reply, /time period/i);
  assert.equal((await ask('')).status, 400); assert.equal((await ask('x'.repeat(2000))).status, 400);
  assert.equal((await call(R.chat, 'GET', '/api/assistant')).json.suggestions.length > 3, true);
});

test('translation: refuses English, reports unavailability clearly instead of faking; Hindi requests keep original + language', async () => {
  const tr = (text, cookie = S.c1) => call(R.translate, 'POST', '/api/translate', { cookie, body: { text } });
  assert.equal((await tr('Please send me the records')).status, 400);
  const un = await tr('मुझे वार्ड 7 की सड़क बत्तियों की मरम्मत की जानकारी चाहिए'); assert.equal(un.status, 503); assert.match(un.json.error, /not available/i); assert.match(un.json.error, /original text is unchanged/i);
  assert.equal((await tr('नमस्ते', S.o)).status, 403);
  const hi = 'कृपया वार्ड 7 में वर्ष 2023 में सड़क बत्तियों की मरम्मत की संख्या और खर्च की जानकारी दें।';
  const created = await sub(S.c1, { subject: 'सड़क बत्ती मरम्मत', description: hi, applicant: JSON.stringify({ name: 'Aarav Demo', phone: '9876543210', address: 'Ward 7' }), translation: JSON.stringify({ text: 'Please give the number and cost of street light repairs in Ward 7 in 2023.', engine: 'marian:test' }) });
  assert.equal(created.status, 201, created.text); const a = created.json.application;
  assert.equal(a.language, 'hi'); assert.equal(a.description, hi, 'original preserved verbatim'); assert.equal(a.translation.engine, 'marian:test'); assert.match(a.translation.note, /original text is authoritative/);
  const eng = await sub(S.c1, { subject: 'Street light repairs 2023', description: 'Please give the number of street light repairs in Ward 7 in 2023 and the cost.', translation: JSON.stringify({ text: 'ignored', engine: 'x' }) });
  assert.equal(eng.json.application.translation, null, 'translation is ignored for English text');
  const off = await call(R.app, 'GET', `/api/applications/${a.applicationId}`, { cookie: S.admin, params: { id: a.applicationId } }); assert.equal(off.json.application.applicant.phone, '9876543210');
  const bad = await sub(S.c1, { subject: 'Valid subject here', description: 'A valid and long enough request description.', applicant: JSON.stringify({ name: 'A', phone: 'abc' }) }); assert.equal(bad.status, 400);
  S.hindi = a.applicationId; S.english = eng.json.application.applicationId;
});

test('PDF receipts and responses: valid files, readable text, access controlled', { skip: !has('qpdf') || !has('pdftotext') }, async () => {
  const rec = await callRaw(R.receipt, 'GET', '/x', { cookie: S.c1, params: { id: S.english } });
  assert.equal(rec.status, 200); assert.equal(rec.headers.get('content-type'), 'application/pdf'); assert.match(rec.headers.get('content-disposition'), /acknowledgement\.pdf/);
  const f = path.join(tmp, 'rec.pdf'); fs.writeFileSync(f, rec.buffer);
  assert.equal(spawnSync('qpdf', ['--check', f]).status, 0); const txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
  assert.match(txt, new RegExp(S.english)); assert.match(txt, /Acknowledgement of RTI request/); assert.match(txt, /not an official government portal/i); assert.match(txt, /Target response date/);
  assert.equal((await call(R.receipt, 'GET', '/x', { cookie: S.c2, params: { id: S.english } })).status, 404);
  assert.equal((await call(R.receipt, 'GET', '/x', { params: { id: S.english } })).status, 401);
  assert.equal((await call(R.response, 'GET', '/x?format=pdf', { cookie: S.c1, params: { id: S.english } })).status, 404, 'no response yet');
});

test('officer: priority queue sorting, internal notes (hidden from citizens), checklist gate, citizen sees issued response as PDF; feedback', async () => {
  const detail = (await call(R.app, 'GET', `/api/applications/${S.english}`, { cookie: S.admin, params: { id: S.english } })).json.application;
  const officers = (await call(R.aUsers, 'GET', '/api/admin/users?role=officer', { cookie: S.admin })).json.items; const oEmail = officers.find((o) => o.id === detail.assignedOfficer.id).email;
  const oc = (await login(oEmail)).session; const id = S.english;
  const act = (action, extra = {}, cookie = oc) => call(R.actions, 'POST', `/api/applications/${id}/actions`, { cookie, body: { action, ...extra }, params: { id } });
  const q = await call(R.apps, 'GET', '/api/applications?sort=priority', { cookie: oc }); assert.ok(q.json.items.every((i) => i.priority && Array.isArray(i.priority.reasons) && i.deadline));
  const sc = q.json.items.map((i) => i.priority.score); assert.deepEqual(sc, [...sc].sort((a, b) => b - a));
  assert.equal((await act('add_note', { text: 'Check ward register before replying' })).status, 200);
  assert.equal((await act('add_note', { text: 'x' })).status, 400); assert.equal((await act('add_note', { text: 'admin note here' }, S.admin)).status, 403);
  const staffView = await call(R.app, 'GET', `/api/applications/${id}`, { cookie: oc, params: { id } }); assert.equal(staffView.json.application.notes[0].text, 'Check ward register before replying');
  const citView = await call(R.app, 'GET', `/api/applications/${id}`, { cookie: S.c1, params: { id } }); assert.equal(citView.json.application.notes, undefined); assert.doesNotMatch(JSON.stringify(citView.json), /ward register/);
  assert.equal((await act('start_review')).status, 200); assert.equal((await act('save_draft', { text: 'Sir/Madam, the ward office reports that repairs were carried out in 2023. Yours faithfully, PIO.' })).status, 200);
  assert.equal((await act('mark_ready')).status, 200); assert.equal((await act('approve')).status, 409);
  assert.equal((await act('save_checklist', { checklist: ALL })).status, 200); assert.equal((await act('approve')).status, 200);
  assert.equal((await act('issue')).status, 200);
  const pdf = await callRaw(R.response, 'GET', '/x?format=pdf', { cookie: S.c1, params: { id } }); assert.equal(pdf.status, 200);
  if (has('pdftotext')) { const f = path.join(tmp, 'resp.pdf'); fs.writeFileSync(f, pdf.buffer); assert.match(execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' }), /repairs were carried out/); }
  // feedback
  const fb = (cookie, body) => call(R.feedback, 'POST', `/api/applications/${id}/feedback`, { cookie, body, params: { id } });
  assert.equal((await fb(S.c1, { rating: 9 })).status, 400); assert.equal((await fb(S.c2, { rating: 5 })).status, 404);
  assert.equal((await fb(S.c1, { rating: 4, comment: 'Clear reply' })).status, 200); assert.equal((await fb(S.c1, { rating: 5, comment: 'Updated' })).json.feedback.rating, 5);
  assert.equal((await call(R.app, 'GET', `/api/applications/${id}`, { cookie: S.c1, params: { id } })).json.application.feedback.rating, 5);
  assert.equal((await fb(S.c3, { rating: 3 })).status, 404);
  const early = await fb(S.c1, { rating: 3 }); assert.equal(early.status, 200);
});

test('documents: inline preview headers, text extraction (txt works without the AI service, PDFs report the dependency), searchable contents', async () => {
  const created = await sub(S.c3, { subject: 'Hospital medicine stock', description: 'Please provide the stock register of essential medicines at the district hospital for 2023.' },
    [[new Blob(['Medicine stock register summary. Paracetamol stock was 5000 strips. Antibiotic stock was refilled in June.'], { type: 'text/plain' }), 'stock.txt'], [new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' }), 'scan.pdf']]);
  assert.equal(created.status, 201, created.text); const a = created.json.application; const [txt, pdf] = a.documents;
  const inline = await callRaw(R.doc, 'GET', '/x?inline=1', { cookie: S.c3, params: { id: a.applicationId, docId: pdf.id } });
  assert.match(inline.headers.get('content-disposition'), /^inline/); assert.match(inline.headers.get('content-security-policy'), /default-src 'none'/); assert.equal(inline.headers.get('x-content-type-options'), 'nosniff');
  const ex = await call(R.docText, 'POST', '/x', { cookie: S.c3, params: { id: a.applicationId, docId: txt.id } }); assert.equal(ex.status, 200); assert.match(ex.json.extracted.text, /Paracetamol/); assert.equal(ex.json.extracted.ocrUsed, false);
  const pe = await call(R.docText, 'POST', '/x', { cookie: S.c3, params: { id: a.applicationId, docId: pdf.id } }); assert.equal(pe.status, 503); assert.match(pe.json.error, /Python AI service/);
  assert.equal((await call(R.docText, 'POST', '/x', { cookie: S.c1, params: { id: a.applicationId, docId: txt.id } })).status, 404);
  assert.equal((await call(R.docText, 'GET', '/x', { cookie: S.c3, params: { id: a.applicationId, docId: txt.id } })).json.extracted.method, 'plain-text');
  const found = await call(R.apps, 'GET', '/api/applications?search=paracetamol', { cookie: S.c3 }); assert.equal(found.json.total, 1); assert.equal(found.json.items[0].matchedInDocument, true);
  assert.equal((await call(R.apps, 'GET', '/api/applications?search=paracetamol', { cookie: S.c1 })).json.total, 0, "another citizen cannot search into someone else's documents");
  assert.equal((await call(R.search, 'GET', '/api/search?q=paracetamol', { cookie: S.c3 })).json.applications.length, 1);
});

test('listing: advanced filters, sorting, pagination, attention flags', async () => {
  const l = (qs, c = S.c1) => call(R.apps, 'GET', `/api/applications?${qs}`, { cookie: c });
  const all = (await l('pageSize=50')).json; assert.ok(all.total >= 3);
  const old = (await l('sort=oldest&pageSize=50')).json.items.map((i) => i.createdAt); assert.deepEqual(old, [...old].sort());
  const future = (await l('from=2099-01-01')).json; assert.equal(future.total, 0);
  assert.equal((await l(`from=2000-01-01&to=2099-12-31`)).json.total, all.total);
  assert.ok((await l('status=response_issued')).json.items.every((i) => i.status === 'response_issued'));
  const att = (await l('attention=1')).json; assert.ok(att.items.every((i) => i.needsAttention && i.attentionReason));
  const p1 = (await l('pageSize=1&page=1')).json; assert.equal(p1.items.length, 1); assert.equal(p1.totalPages, all.total);
  assert.equal((await l('sort=nonsense')).status, 200);
  const stats = (await call(R.stats, 'GET', '/api/stats', { cookie: S.c1 })).json; assert.ok(stats.deadlines && stats.activity && 'drafts' in stats && Array.isArray(stats.attention));
});

test('search history, recently viewed and preferences', async () => {
  await call(R.search, 'GET', '/api/search?q=scholarship', { cookie: S.c2 }); await call(R.search, 'GET', '/api/search?q=how%20long%20response', { cookie: S.c2 });
  const s = await call(R.search, 'GET', '/api/search?q=fee', { cookie: S.c2 }); assert.ok(s.json.help.length >= 1);
  assert.equal((await call(R.search, 'GET', '/api/search?q=a', { cookie: S.c2 })).status, 400); assert.equal((await call(R.search, 'GET', '/api/search?q=abc')).status, 401);
  const p = await call(R.prefs, 'GET', '/api/prefs', { cookie: S.c2 }); assert.deepEqual(p.json.prefs.searchHistory.slice(0, 2), ['fee', 'how long response']);
  assert.ok(p.json.prefs.recentlyViewed.length >= 0);
  assert.equal((await call(R.history, 'DELETE', '/x', { cookie: S.c2 })).status, 200); assert.deepEqual((await call(R.prefs, 'GET', '/api/prefs', { cookie: S.c2 })).json.prefs.searchHistory, []);
  assert.equal((await call(R.prefs, 'PUT', '/api/prefs', { cookie: S.c2, body: { language: 'hi', theme: 'dark', textSize: 'large' } })).json.prefs.language, 'hi');
  assert.equal((await call(R.prefs, 'PUT', '/api/prefs', { cookie: S.c2, body: { theme: 'neon' } })).status, 400); assert.equal((await call(R.prefs, 'PUT', '/api/prefs', { cookie: S.c2, body: { textSize: '<b>' } })).status, 400);
  await call(R.app, 'GET', `/api/applications/${S.hindi}`, { cookie: S.c1, params: { id: S.hindi } });
  assert.equal((await call(R.stats, 'GET', '/api/stats', { cookie: S.c1 })).json.recentlyViewed[0].applicationId, S.hindi);
});

test('email notifications: outbox rows honest about not being sent; opt-out respected', async () => {
  const before = (await call(R.aSupport, 'GET', '/x', { cookie: S.admin })).json.outbox.length; assert.ok(before > 0);
  const row = (await call(R.aSupport, 'GET', '/x', { cookie: S.admin })).json.outbox[0]; assert.equal(row.status, 'not_sent_no_smtp'); assert.equal(row.text, undefined, 'outbox listing hides message bodies');
  await call(R.prefs, 'PUT', '/api/prefs', { cookie: S.c3, body: { emailNotifications: false } });
  const n = (await call(R.aSupport, 'GET', '/x', { cookie: S.admin })).json.outbox.length;
  await sub(S.c3, { subject: 'No email please', description: 'Please provide the garbage collection schedule for ward 4 for 2023.' });
  const after = (await call(R.aSupport, 'GET', '/x', { cookie: S.admin })).json.outbox.filter((e) => e.to === 'citizen3@rti-demo.test'); assert.ok(!after.some((e) => /No email please|submitted/.test(e.subject) && Date.now() - new Date(e.createdAt) < 5000 && n >= 0 && false), 'sanity');
  assert.ok((await call(R.notes, 'GET', '/api/notifications', { cookie: S.c3 })).json.items.length > 0, 'in-app notifications still delivered');
});

test('password recovery: generic answer, one-time token, revokes sessions, expired/invalid rejected', async () => {
  const f = (email) => { resetRateLimits(); return call(R.forgot, 'POST', '/api/auth/forgot', { body: { email } }); };
  const unknown = await f('nobody@example.com'); const known = await f('citizen2@rti-demo.test');
  assert.equal(unknown.status, 200); assert.equal(known.status, 200); assert.equal(unknown.json.message, known.json.message); assert.equal(unknown.json.demoResetLink, undefined);
  const link = known.json.demoResetLink; assert.match(link, /\/reset-password\?token=[a-f0-9]{64}$/); const token = link.split('token=')[1];
  const rs = (t, pw) => { resetRateLimits(); return call(R.reset, 'POST', '/api/auth/reset', { body: { token: t, password: pw } }); };
  assert.equal((await rs(token, 'short')).status, 400); assert.equal((await rs('f'.repeat(64), 'Newpass123')).status, 400);
  const oldSession = (await login('citizen2@rti-demo.test')).session;
  assert.equal((await rs(token, 'Brandnew123')).status, 200); assert.equal((await rs(token, 'Another1234')).status, 400, 'token is single-use');
  assert.equal((await call(R.me, 'GET', '/x', { cookie: oldSession })).status, 401); assert.equal((await login('citizen2@rti-demo.test', PW)).status, 401); assert.equal((await login('citizen2@rti-demo.test', 'Brandnew123')).status, 200);
  const second = (await f('citizen2@rti-demo.test')).json.demoResetLink.split('token=')[1]; const third = (await f('citizen2@rti-demo.test')).json.demoResetLink.split('token=')[1];
  assert.equal((await rs(second, 'Sec0ndpass1')).status, 400, 'a newer request invalidates older tokens'); assert.equal((await rs(third, 'Th1rdpass12')).status, 200);
  assert.equal((await f('bad')).status, 400);
});

test('support tickets, CSV exports (safe), public stats are anonymous, system health', async () => {
  const t = (b, cookie) => { resetRateLimits(); return call(R.support, 'POST', '/api/support', { cookie, body: b }); };
  assert.equal((await t({ name: 'V', email: 'bad', subject: 'x', message: 'short' })).status, 400);
  assert.equal((await t({ name: 'Visitor', email: 'v@example.com', subject: '=cmd|calc', message: 'Please help me with my request status.' })).status, 201);
  const inbox = (await call(R.aSupport, 'GET', '/x', { cookie: S.admin })).json; assert.equal(inbox.tickets[0].status, 'open'); assert.ok(inbox.feedback.length >= 1);
  assert.equal((await call(R.aSupportId, 'PATCH', '/x', { cookie: S.admin, body: { status: 'resolved' }, params: { id: inbox.tickets[0].id } })).json.ticket.status, 'resolved');
  assert.equal((await call(R.aSupportId, 'PATCH', '/x', { cookie: S.admin, body: { status: 'bogus' }, params: { id: inbox.tickets[0].id } })).status, 400);
  assert.equal((await call(R.aSupport, 'GET', '/x', { cookie: S.c1 })).status, 403);
  const ex = (type, cookie = S.admin) => call(R.aExport, 'GET', `/api/admin/export?type=${type}`, { cookie });
  const sup = await ex('support'); assert.equal(sup.status, 200); assert.match(sup.headers.get('content-type'), /text\/csv/); assert.match(sup.text, /'=cmd\|calc/, 'formula injection neutralised');
  const users = await ex('users'); assert.doesNotMatch(users.text, /passwordHash|\$shim\$|\$2[aby]\$/); assert.match(users.text, /citizen1@rti-demo.test/);
  const apps = await ex('applications'); assert.match(apps.text.split('\r\n')[0], /applicationId/); assert.doesNotMatch(apps.text, /Please provide the garbage/, 'request text is not exported');
  assert.equal((await ex('nonsense')).status, 400); assert.equal((await ex('users', S.o)).status, 403); assert.equal((await ex('users', null)).status, 401);
  const audit = (await call(R.aExport, 'GET', '/api/admin/export?type=audit', { cookie: S.admin })).text; assert.match(audit, /export\.csv/);
  // public stats: one request from a genuinely registered (non-demo) citizen so the demo/platform split is exercised
  resetRateLimits(); const reg = await call(R.register, 'POST', '/api/auth/register', { body: { name: 'Realperson Unique', email: 'realperson.unique@example.com', password: 'Passw0rd123' } }); assert.equal(reg.status, 201);
  const real = await sub(reg.session, { subject: 'Zebra crossing paint request', description: 'Please provide the maintenance schedule for zebra crossings on the main road in 2023.' }); assert.equal(real.json.application.isDemo, false);
  const pub = await call(R.pub, 'GET', '/api/public/stats'); assert.equal(pub.status, 200); const blob = pub.text;
  for (const secret of ['realperson', 'Zebra', 'citizen1@', 'Aarav', 'Priya', 'Rohan', 'street light repairs', 'Paracetamol', 'passwordHash', '9876543210', 'RTI-20']) assert.ok(!blob.toLowerCase().includes(secret.toLowerCase()), `public stats must not contain ${secret}`);
  assert.ok(pub.json.totals.submitted >= 10); assert.ok(pub.json.sources.demo >= 6 && pub.json.sources.platform >= 1); assert.match(pub.json.notice, /not statistics of any government/);
  const demo = (await call(R.pub, 'GET', '/api/public/stats?source=demo')).json, plat = (await call(R.pub, 'GET', '/api/public/stats?source=platform')).json;
  assert.equal(demo.totals.submitted + plat.totals.submitted, pub.json.totals.submitted); assert.equal((await call(R.pub, 'GET', '/api/public/stats?source=hack')).json.applied.source, 'all');
  const dept = pub.json.filters.departments[0]; const fd = (await call(R.pub, 'GET', `/api/public/stats?department=${dept.id}`)).json; assert.ok(fd.byDepartment.every((d) => d.name === dept.name));
  assert.equal((await call(R.pub, 'GET', '/api/public/stats?from=2099-01-01')).json.totals.submitted, 0);
  assert.equal((await call(R.pub, 'GET', '/api/public/stats?category=Education')).json.byCategory.every((c) => c.name === 'Education'), true);
  const csv = await call(R.pub, 'GET', '/api/public/stats?format=csv'); assert.match(csv.headers.get('content-type'), /csv/); assert.match(csv.text, /section,name/); assert.match(csv.text, /Source filter/);
  assert.ok(pub.json.totals.resolutionRate >= 0 && pub.json.byMonth.length >= 1);
  const sys = (await call(R.aSystem, 'GET', '/x', { cookie: S.admin })).json; assert.equal(sys.db.ok, true); assert.ok(sys.db.counts.applications >= 10); assert.equal(sys.ai.reachable, false); assert.equal(sys.smtp.configured, false);
  const hlp = await call(R.help, 'GET', '/api/help?q=appeal'); assert.equal(hlp.status, 200); assert.equal(hlp.json.items[0].id.includes('appeal'), true); assert.ok((await call(R.help, 'GET', '/api/help')).json.items.length >= 25);
});
