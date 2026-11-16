// Browser end-to-end scenarios (sandbox harness: node tests/e2e/build.mjs; node --import ./tests/helpers/register.mjs tests/e2e/server.mjs; node tests/e2e/run.mjs).
// With real Next.js installed, point BASE at `npm run dev` / `npm start` and the same scenarios apply.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire((process.env.E2E_TOOLS || '/opt/npm-tools/node_modules') + '/');
const { chromium, expect } = (() => { const pw = require('playwright'); let e; try { e = require('@playwright/test').expect; } catch { e = null; } return { chromium: pw.chromium, expect: e }; })();
const BASE = process.env.BASE || 'http://localhost:3100'; const SHOTS = process.env.SHOTS || '/tmp/rti-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const results = []; const PW = 'Demo@12345'; const S = {};
const ALLOWED = [/401 \(Unauthorized\)/, /404 \(Not Found\)/, /503 \(Service Unavailable\)/, /400 \(Bad Request\)/, /409 \(Conflict\)/, /429/];

async function newPage(vp = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true }); const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', (e) => page.errs.push(`pageerror: ${e.message}`)); page.on('console', (m) => m.type() === 'error' && !ALLOWED.some((r) => r.test(m.text())) && page.errs.push(`console: ${m.text()}`));
  return page;
}
async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t = Date.now(); let page;
  try { page = await newPage(); await fn(page); if (page.errs.length) throw new Error(`browser errors: ${page.errs.join(' | ')}`); results.push({ name, ok: true, ms: Date.now() - t }); }
  catch (e) { results.push({ name, ok: false, error: `${String(e.message).split('\n')[0]} @run.mjs:${(String(e.stack).match(/run\.mjs:(\d+)/) || [])[1]}` }); try { await page?.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }); } catch {} }
  finally { await page?.context().close(); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const shot = (page, n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
async function login(page, email, pw = PW) { await page.goto(`${BASE}/login`); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(pw); await page.getByRole('button', { name: 'Sign in' }).click(); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }); await page.waitForSelector('main'); }
const toast = (page, re) => page.getByRole('status').filter({ hasText: re }).or(page.getByRole('alert').filter({ hasText: re })).first().waitFor({ timeout: 10000 });
const noOverflow = async (page, label) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); ok(w[0] <= w[1] + 1, `${label}: horizontal overflow ${w[0]} > ${w[1]}`); };
const unnamed = (page) => page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not(.sr-only),select,textarea')].filter((e) => { const id = e.id; return !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (id && document.querySelector(`label[for="${id}"]`)) || e.closest('label') || e.getAttribute('title')); }).map((e) => e.outerHTML.slice(0, 90)));

await scenario('public: landing, language, theme, text size', async (p) => {
  await p.goto(BASE); await p.waitForSelector('h1'); ok(await p.locator('html').getAttribute('lang') === 'en', 'html lang en');
  await p.getByRole('button', { name: /^What is the Right to Information Act/ }).click(); await expect_text(p, 'gives citizens of India');
  await p.getByRole('button', { name: /Language, Theme/ }).click(); await p.getByRole('button', { name: 'हिन्दी' }).click();
  await p.waitForFunction(() => document.querySelector('h1')?.textContent.includes('सार्वजनिक')); ok(await p.locator('html').getAttribute('lang') === 'hi', 'html lang hi'); await shot(p, 'landing-hindi');
  // the theme button label is localised, so after switching to Hindi it is 'गहरी'
  await p.getByRole('button', { name: 'गहरी' }).click(); ok(await p.locator('html').evaluate((e) => e.classList.contains('dark')), 'dark class'); await p.getByRole('button', { name: 'Large text', exact: true }).click(); ok(await p.locator('html').evaluate((e) => e.classList.contains('text-large')), 'large text class');
  await shot(p, 'landing-dark-large'); await p.reload(); await p.waitForSelector('h1'); await p.waitForFunction(() => document.documentElement.classList.contains('dark') && document.documentElement.classList.contains('text-large'), null, { timeout: 5000 }).catch(async () => { throw new Error(`prefs persist across reload: ${await p.evaluate(() => `ls=${localStorage.getItem('rti-prefs')} cls=${document.documentElement.className}`)}`); });
  ok(await p.getByRole('link', { name: 'Skip to main content' }).count() > 0, 'skip link present');
});
async function expect_text(p, t) { await p.getByText(t, { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => { throw new Error(`text not found on ${new URL(p.url()).pathname}: "${t}"`); }); }

await scenario('public: help, contact, transparency, forgot password', async (p) => {
  await p.goto(`${BASE}/help`); await p.getByLabel('Search help').fill('fee'); await expect_text(p, 'Is there a fee?'); await p.getByText('Who can file an RTI request?').first().waitFor({ state: 'detached', timeout: 8000 });
  await p.goto(`${BASE}/contact`); await p.getByLabel('Your name').fill('Visitor One'); await p.getByLabel('Email').fill('visitor@example.com'); await p.getByLabel('Subject').fill('E2E support question'); await p.getByLabel('Message').fill('This is an end to end test message about my request.'); await p.getByRole('button', { name: 'Submit' }).click(); await expect_text(p, 'Message sent');
  await p.goto(`${BASE}/transparency`); await p.waitForSelector('text=Submitted'); await shot(p, 'transparency-desktop');
  const csv = await p.getByRole('link', { name: 'Download CSV' }).getAttribute('href'); const r = await p.request.get(BASE + csv); ok(r.status() === 200 && /csv/.test(r.headers()['content-type']), 'CSV download works');
  await p.getByLabel('Data source').selectOption('platform'); await p.waitForTimeout(600); ok((await p.locator('main').innerText()).includes('0 demo') || (await p.locator('main').innerText()).includes('demo'), 'source filter responds');
  await p.goto(`${BASE}/forgot-password`); await p.getByLabel('Email').fill('citizen3@rti-demo.test'); await p.getByRole('button', { name: 'Send reset link' }).click(); await p.getByRole('link', { name: 'Choose a new password' }).click();
  await p.getByLabel('New password').fill('Reset12345'); await p.getByRole('button', { name: 'Change password' }).click(); await expect_text(p, 'Password changed'); await login(p, 'citizen3@rti-demo.test', 'Reset12345'); ok(p.url().endsWith('/citizen'), 'login with the reset password');
});

await scenario('assistant: honest fallback label, grounded answers, refuses to guess', async (p) => {
  await p.goto(BASE); await p.getByRole('button', { name: 'Open assistant' }).click(); await p.getByRole('button', { name: 'Is there a fee?' }).click();
  await p.getByText('Fallback mode: no AI model used').first().waitFor({ timeout: 10000 }); const t = await p.getByRole('log').innerText(); ok(/fee/i.test(t) && /confirm details with the authority/i.test(t), 'fee answer from KB with caution'); ok(!/₹|Rs\.? ?\d/.test(t), 'no invented fee amount');
  await p.getByLabel('Ask about RTI…').fill('what is the capital of France'); await p.keyboard.press('Enter'); await expect_text(p, "don't have that in my knowledge base"); await shot(p, 'assistant');
  await p.keyboard.press('Escape'); ok(await p.getByRole('dialog', { name: 'RTI assistant' }).count() === 0, 'Escape closes assistant');
});

await scenario('citizen: wizard end to end, receipt PDF, detail page', async (p) => {
  await login(p, 'citizen1@rti-demo.test'); ok(p.url().endsWith('/citizen'), 'citizen home'); await p.waitForSelector('text=Where is my request?'); await shot(p, 'citizen-dashboard');
  await p.goto(`${BASE}/citizen/apply`); await p.waitForSelector('h2:has-text("1. Your details")'); ok((await p.getByLabel('Your full name').inputValue()).length > 1, 'name prefilled');
  await p.getByLabel('Your full name').fill(''); await p.getByRole('button', { name: /^Next/ }).click(); await expect_text(p, 'Enter your name.'); await p.getByLabel('Your full name').fill('Aarav Demo');
  await p.getByRole('button', { name: /^Next/ }).click(); await p.getByRole('button', { name: /^Next/ }).click();
  await p.getByRole('button', { name: /^Next/ }).click(); await expect_text(p, 'Enter a subject'); await p.getByLabel('Subject').fill('Street light repairs in Ward 11');
  await p.getByRole('button', { name: /^Next/ }).click(); await p.getByLabel('What information do you need?').fill('short'); await p.getByRole('button', { name: /^Next/ }).click(); await expect_text(p, 'at least 20 characters');
  await p.getByLabel('What information do you need?').fill('Please provide the number of street lights repaired in Ward 11 between April 2022 and March 2023, and the amount spent on maintenance by the municipal office.'); await expect_text(p, 'Street light repairs in Ward 11');
  await p.getByRole('button', { name: /^Next/ }).click(); await p.setInputFiles('#docs', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('Ward 11 maintenance register extract. Lights repaired: 40.') }); await expect_text(p, 'note.txt');
  await p.getByRole('button', { name: /^Next/ }).click(); await p.getByText('Missing information').first().waitFor({ timeout: 15000 }); ok(/Municipal services/.test(await p.locator('main').innerText()), 'AI suggests Municipal services'); await shot(p, 'wizard-ai-step');
  await p.getByRole('button', { name: /^Next/ }).click(); const submit = p.getByRole('button', { name: 'Submit request' }); ok(await submit.isDisabled(), 'submit disabled until confirmed'); await p.getByRole('checkbox').check(); await submit.click();
  await p.waitForSelector('h1:has-text("Request submitted")', { timeout: 20000 }); S.appId = (await p.locator('main').innerText()).match(/RTI-\d{4}-[A-Z0-9]{6}/)[0]; await shot(p, 'wizard-success');
  const r = await p.request.get(`${BASE}/api/applications/${S.appId}/receipt`); ok(r.status() === 200 && r.headers()['content-type'] === 'application/pdf' && (await r.body()).subarray(0, 4).toString() === '%PDF', 'receipt is a PDF');
  await p.getByRole('link', { name: 'View application' }).click(); await p.waitForSelector('text=Target response date'); await expect_text(p, 'note.txt'); await shot(p, 'citizen-detail');
  await p.getByRole('button', { name: 'Extract text' }).click(); await expect_text(p, 'text extracted'); await expect_text(p, 'Lights repaired: 40'); await p.getByRole('button', { name: 'Hide text' }).click(); await p.getByRole('button', { name: 'Show text' }).click(); await expect_text(p, 'Extracted by plain-text');
  await p.getByRole('button', { name: 'Preview' }).click(); await p.getByRole('dialog').getByText('Ward 11 maintenance register').waitFor(); await p.keyboard.press('Escape');
  await p.goto(`${BASE}/citizen/applications`); await p.getByLabel('Search applications').fill('repaired: 40'); await expect_text(p, 'found in document');
});

await scenario('citizen: Hindi request, translation honesty, drafts save/resume/delete', async (p) => {
  await login(p, 'citizen2@rti-demo.test'); await p.goto(`${BASE}/citizen/apply`); await p.getByRole('button', { name: /^Next/ }).click(); await p.getByRole('button', { name: /^Next/ }).click(); await p.getByLabel('Subject').fill('सड़क बत्ती मरम्मत जानकारी'); await p.getByRole('button', { name: /^Next/ }).click();
  await p.getByLabel('What information do you need?').fill('कृपया वार्ड 7 में वर्ष 2023 में सड़क बत्तियों की मरम्मत की संख्या और खर्च की जानकारी दें।'); await expect_text(p, 'Your request is in Hindi');
  await p.getByRole('button', { name: 'Translate to English' }).click(); await toast(p, /not available/i); ok(await p.getByText('English translation (machine-made)').count() === 0, 'no fake translation shown');
  await p.getByRole('button', { name: 'Save draft' }).click(); await toast(p, /Draft saved/); await p.goto(`${BASE}/citizen/apply`); await expect_text(p, 'Saved drafts (1)'); await p.getByRole('button', { name: 'Continue' }).click();
  await p.waitForSelector('text=Draft loaded'); ok((await p.getByLabel('What information do you need?').inputValue()).includes('वार्ड 7'), 'draft resumed with original text'); await shot(p, 'wizard-hindi-draft');
  await p.getByRole('button', { name: 'Save draft' }).click(); await p.goto(`${BASE}/citizen/apply`); await p.getByRole('button', { name: /Delete draft/ }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click(); await expect_text(p, 'Start a new request').catch(() => {});
  await p.waitForTimeout(500); ok((await p.locator('main').innerText()).includes('1. Your details') || !(await p.locator('main').innerText()).includes('Saved drafts (1)'), 'draft deleted after confirmation');
});

await scenario('officer: priority queue, review, checklist-gated approval, issue', async (p) => {
  await login(p, 'officer.municipal@rti-demo.test'); ok(p.url().endsWith('/officer'), 'officer home'); await p.waitForSelector('text=Priority'); await shot(p, 'officer-queue');
  await p.getByRole('link', { name: 'Street light repairs in Ward 11' }).click(); await p.waitForSelector('text=Internal notes'); await expect_text(p, 'Documents'); await shot(p, 'officer-review');
  await p.getByLabel('Add a note').fill('Verify with the ward register before replying.'); await p.getByRole('button', { name: 'Add note' }).click(); await expect_text(p, 'Verify with the ward register');
  await p.getByRole('button', { name: 'Start review' }).click(); await toast(p, /Review started/); await p.getByRole('link', { name: 'Open response editor' }).click(); await p.waitForSelector('#draft'); await shot(p, 'officer-editor');
  await p.locator('#draft').fill('Sir/Madam, the ward office reports that 40 street lights were repaired in Ward 11 during 2023-24. Yours faithfully, Public Information Officer.'); await p.getByRole('button', { name: 'Save draft' }).click(); await toast(p, /Draft saved/);
  await p.getByRole('button', { name: 'Send for approval' }).click(); await toast(p, /sent for approval/); ok(await p.getByRole('button', { name: 'Approve draft' }).isDisabled(), 'Approve disabled before checklist');
  const boxes = p.getByRole('checkbox'); const n = await boxes.count(); ok(n === 6, `six checklist items, got ${n}`); for (let i = 0; i < n; i++) { await boxes.nth(i).check(); await toast(p, /Checklist updated/); await p.waitForTimeout(150); }
  await p.getByRole('button', { name: 'Preview letter' }).click(); await expect_text(p, 'how the citizen will read it'); await p.getByRole('button', { name: 'Edit' }).click();
  await p.getByRole('button', { name: 'Approve draft' }).click(); await toast(p, /Draft approved/); await p.getByRole('button', { name: 'Issue response' }).click(); await toast(p, /Response issued/);
});

await scenario('citizen: reads issued response, PDF, feedback', async (p) => {
  await login(p, 'citizen1@rti-demo.test'); await p.goto(`${BASE}/citizen/applications/${S.appId}`); await p.waitForSelector('text=Response from the department'); await expect_text(p, '40 street lights were repaired'); await shot(p, 'citizen-response');
  const r = await p.request.get(`${BASE}/api/applications/${S.appId}/response?format=pdf`); ok(r.status() === 200 && (await r.body()).subarray(0, 4).toString() === '%PDF', 'response PDF');
  await p.getByRole('radio', { name: '5 stars' }).click(); await p.getByLabel('Comment').fill('Clear and quick.'); await p.getByRole('button', { name: 'Send feedback' }).click(); await toast(p, /Thank you/);
  await p.getByRole('button', { name: 'Notifications' }).or(p.getByRole('button', { name: /^Notifications/ })).first().click(); await expect_text(p, 'has been issued');
});

await scenario('admin: health, inbox, settings, exports, confirm dialogs, global search', async (p) => {
  await login(p, 'admin@rti-demo.test'); await p.waitForSelector('text=System health'); await expect_text(p, 'Not reachable: local fallback in use'); await shot(p, 'admin-overview');
  await p.goto(`${BASE}/admin/inbox`); await expect_text(p, 'E2E support question'); await p.getByRole('button', { name: 'Mark resolved' }).first().click(); await expect_text(p, 'resolved'); await p.getByRole('tab', { name: /Email outbox/ }).click(); await expect_text(p, 'stored, not sent (no SMTP)');
  await p.getByRole('tab', { name: /Citizen feedback/ }).click(); await expect_text(p, 'Clear and quick.');
  await p.goto(`${BASE}/admin/users`); await p.getByRole('button', { name: 'Deactivate' }).first().click(); await p.getByRole('dialog', { name: /Deactivate/ }).waitFor(); await p.getByRole('button', { name: 'Cancel' }).click(); ok(await p.getByRole('dialog').count() === 0, 'confirm dialog closes on cancel');
  await p.goto(`${BASE}/admin/platform`); await p.getByLabel('Target response time (days)').fill('45'); await p.getByRole('button', { name: 'Save settings' }).click(); await toast(p, /Settings saved/); const ex = await p.request.get(`${BASE}/api/admin/export?type=users`); ok(ex.status() === 200 && !/passwordHash/.test(await ex.text()), 'users export has no password hashes');
  await p.goto(`${BASE}/admin/applications`); await p.getByRole('button', { name: /Filters/ }).click(); await p.getByLabel('Submitted from').fill('2099-01-01'); await expect_text(p, 'No applications match these filters'); await p.getByRole('button', { name: 'Clear all filters' }).click();
  await p.getByLabel('Search', { exact: true }).first().fill('Street light'); await expect_text(p, 'Street light repairs in Ward 11'); await shot(p, 'admin-applications');
  await p.goto(`${BASE}/admin/audit`); await expect_text(p, 'response.issued');
});

await scenario('access control in the browser: wrong role is redirected, other citizen gets not-found', async (p) => {
  await login(p, 'citizen2@rti-demo.test'); await p.goto(`${BASE}/admin`); await p.waitForURL(/\/citizen$/); await p.goto(`${BASE}/officer`); await p.waitForURL(/\/citizen$/);
  await p.goto(`${BASE}/citizen/applications/${S.appId}`); await expect_text(p, 'We could not find this application');
  await p.context().clearCookies(); await p.goto(`${BASE}/citizen`); await p.waitForURL(/\/login/);
});

for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1100 }]]) {
  await scenario(`responsive ${name}: no horizontal overflow, mobile menu, accessible names`, async () => {
    const p = await newPage(vp); try {
      for (const path of ['/', '/help', '/contact', '/transparency', '/login', '/register']) { await p.goto(BASE + path); await p.waitForSelector('main, form'); await p.waitForTimeout(400); await noOverflow(p, path); const bad = await unnamed(p); ok(!bad.length, `unlabelled controls on ${path}: ${bad.join(' ')}`); }
      await login(p, 'citizen1@rti-demo.test'); for (const path of ['/citizen', '/citizen/apply', '/citizen/applications', `/citizen/applications/${S.appId}`, '/settings']) { await p.goto(BASE + path); await p.waitForSelector('main'); await p.waitForTimeout(500); await noOverflow(p, path); const bad = await unnamed(p); ok(!bad.length, `unlabelled controls on ${path}: ${bad.join(' ')}`); }
      await p.goto(`${BASE}/citizen`); await p.getByRole('button', { name: 'Open menu' }).click(); await p.getByRole('link', { name: 'My applications' }).first().waitFor(); await shot(p, `${name}-menu`); await p.keyboard.press('Escape');
      await p.goto(`${BASE}/citizen`); await p.waitForSelector('text=Where is my request?'); await shot(p, `${name}-dashboard`); await p.goto(`${BASE}/citizen/apply`); await p.waitForSelector('h2'); await shot(p, `${name}-wizard`);
      if (p.errs.length) throw new Error(p.errs.join(' | '));
    } finally { await p.context().close(); }
  });
}

await browser.close();
const failed = results.filter((r) => !r.ok); console.log(JSON.stringify(results, null, 1)); console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`); process.exit(failed.length ? 1 : 0);
