import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildPdf, pdfSafe, textWidth } from '../lib/pdf.js';
import { deadlineInfo, priorityFor } from '../lib/deadlines.js';
import { CHECKLIST, checklistComplete, missingChecklist } from '../lib/checklist.js';
import { toCsv } from '../lib/csv.js';
import { detectLanguage } from '../lib/lang.js';
import { checkRequest } from '../lib/requestRules.js';

const has = (cmd) => spawnSync('which', [cmd]).status === 0;

test('pdf: valid structure, text extractable, multi-page, special characters safe', { skip: !has('qpdf') || !has('pdftotext') }, () => {
  const long = Array.from({ length: 120 }, (_, i) => `Line ${i + 1}: The (quick) brown fox \\ jumps over the lazy dog. `).join('\n');
  const pdf = buildPdf({ title: 'Acknowledgement receipt', subtitle: 'RTI-2026-ABC123', footer: 'Independent academic project', blocks: [{ t: 'h1', text: 'Request' }, { t: 'kv', key: 'Subject', value: 'Street lights \u2013 Ward 7 \u20B9500 \u0939\u093F\u0928\u094D\u0926\u0940' }, { t: 'rule' }, { t: 'p', text: long }, { t: 'note', text: 'Note text' }] });
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-')), 't.pdf'); fs.writeFileSync(f, pdf);
  assert.ok(pdf.subarray(0, 8).toString().startsWith('%PDF-1.4'));
  const check = spawnSync('qpdf', ['--check', f], { encoding: 'utf8' }); assert.equal(check.status, 0, check.stdout + check.stderr);
  const txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
  assert.match(txt, /Acknowledgement receipt/); assert.match(txt, /Street lights - Ward 7 Rs\.500/); assert.match(txt, /Line 120/); assert.match(txt, /Page 1 of [2-9]/);
  assert.match(execFileSync('qpdf', ['--show-npages', f], { encoding: 'utf8' }), /^[2-9]/);
});
test('pdf: text helpers', () => { assert.equal(pdfSafe('\u201Cq\u201D \u0939'), '"q" ?'); assert.ok(textWidth('iii', 10) < textWidth('WWW', 10)); });

test('deadlines and explainable priority', () => {
  const now = new Date('2026-06-30T00:00:00Z'); const mk = (daysAgo, extra = {}) => ({ createdAt: new Date(now - daysAgo * 864e5).toISOString(), status: 'under_review', subject: 'x', description: 'y', ...extra });
  assert.equal(deadlineInfo(mk(5), 30, now).state, 'on_track'); assert.equal(deadlineInfo(mk(27), 30, now).state, 'due_soon'); assert.equal(deadlineInfo(mk(35), 30, now).state, 'overdue');
  assert.equal(deadlineInfo(mk(35, { status: 'response_issued', respondedAt: new Date(now - 10 * 864e5).toISOString() }), 30, now).metOnTime, true);
  const p = priorityFor(mk(35, { status: 'awaiting_approval', description: 'He is in custody, a matter of liberty' }), 30, now);
  assert.equal(p.level, 'high'); assert.ok(p.reasons.length >= 3 && p.reasons[0].startsWith('Overdue'));
  assert.equal(priorityFor(mk(2), 30, now).level, 'normal'); assert.equal(priorityFor(mk(2, { status: 'closed' }), 30, now).level, 'none');
});
test('checklist requires every item', () => { assert.equal(checklistComplete({}), false); assert.equal(checklistComplete(Object.fromEntries(CHECKLIST.map((i) => [i.key, true]))), true); assert.equal(missingChecklist({ tone: true }).length, CHECKLIST.length - 1); });
test('csv escapes quotes, commas, newlines and blocks formula injection', () => {
  const out = toCsv([{ header: 'a', value: 'a' }, { header: 'b', value: (r) => r.b }], [{ a: 'x,y', b: '=HYPERLINK("evil")' }, { a: 'line\nbreak', b: '"q"' }]);
  assert.match(out, /"x,y","'=HYPERLINK\(""evil""\)"/); assert.match(out, /"line\nbreak","""q"""/);
});
test('language detection and request rules', () => {
  assert.equal(detectLanguage('मुझे सड़क की मरम्मत की जानकारी चाहिए').code, 'hi'); assert.equal(detectLanguage('Please share the records').code, 'en'); assert.equal(detectLanguage('12345').code, 'unknown');
  const codes = (d) => checkRequest({ subject: 'Info', description: d }).items.map((i) => i.code);
  assert.deepEqual(codes('Give me everything about the road, why was it built? Is it right? Do you think so?'), ['time', 'place', 'numbering', 'opinion', 'vague'].filter((c) => codes('Give me everything about the road, why was it built? Is it right? Do you think so?').includes(c)));
  assert.ok(codes('Give me everything.').includes('short') && codes('Give me everything.').includes('vague'));
  const good = 'Please provide the number of street lights repaired in Ward 7 between April 2022 and March 2023, and the amount spent on each repair.';
  assert.deepEqual(codes(good), []);
  assert.ok(codes('Please provide the bank account and Aadhaar details of the contractor for the road work in 2022 in the district office files.').includes('personal'));
  assert.equal(checkRequest({ subject: 's', description: 'मुझे सड़क की मरम्मत की जानकारी चाहिए, कृपया विवरण दें और खर्च बताएं पूरा विवरण चाहिए' }).language, 'hi');
});
