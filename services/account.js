// Preferences, recently viewed, search, feedback, support tickets and password recovery.
import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import { validatePassword } from '../lib/validation.js';
import { sendEmail, baseUrl, smtpConfigured } from '../lib/mailer.js';
import { searchKb } from '../lib/kb.js';
import { appMode } from '../lib/env.js';
import { audit } from './common.js';
import { listApplications, loadApplication } from './applications.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULTS = { language: 'en', theme: 'system', textSize: 'normal', emailNotifications: true };
const OPTIONS = { language: ['en', 'hi'], theme: ['system', 'light', 'dark'], textSize: ['normal', 'large', 'xlarge'] };

export async function getPrefs(store, user) {
  const row = await store.findOne('user_prefs', { user: user.id });
  return { ...DEFAULTS, ...(row ? { language: row.language, theme: row.theme, textSize: row.textSize, emailNotifications: row.emailNotifications !== false } : {}),
    recentlyViewed: row?.recentlyViewed || [], searchHistory: row?.searchHistory || [] };
}
async function upsert(store, user, patch) {
  const row = await store.findOne('user_prefs', { user: user.id });
  return row ? store.update('user_prefs', row.id, patch) : store.insert('user_prefs', { user: user.id, ...DEFAULTS, recentlyViewed: [], searchHistory: [], ...patch });
}
export async function savePrefs(store, user, b = {}) {
  const patch = {};
  for (const [k, allowed] of Object.entries(OPTIONS)) if (b[k] !== undefined) { if (!allowed.includes(b[k])) throw new HttpError(400, `Invalid ${k}.`, { [k]: `Choose one of: ${allowed.join(', ')}` }); patch[k] = b[k]; }
  if (b.emailNotifications !== undefined) patch.emailNotifications = Boolean(b.emailNotifications);
  await upsert(store, user, patch);
  return getPrefs(store, user);
}
export async function touchRecent(store, user, applicationId) {
  const p = await getPrefs(store, user);
  await upsert(store, user, { recentlyViewed: [{ applicationId, at: new Date().toISOString() }, ...p.recentlyViewed.filter((r) => r.applicationId !== applicationId)].slice(0, 8) });
}
export const clearSearchHistory = (store, user) => upsert(store, user, { searchHistory: [] });

export async function globalSearch(store, user, q) {
  const query = String(q || '').trim();
  if (query.length < 2 || query.length > 100) throw new HttpError(400, 'Type 2 to 100 characters to search.');
  const [apps, help] = [(await listApplications(store, user, { search: query, pageSize: 5 })).items, searchKb(query, { limit: 4, types: ['faq', 'guide'] }).filter((h) => h.score >= 0.14)];
  if (query.length >= 3) { const p = await getPrefs(store, user); await upsert(store, user, { searchHistory: [query, ...p.searchHistory.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 8) }); }
  return { applications: apps.map((a) => ({ applicationId: a.applicationId, subject: a.subject, status: a.status, category: a.category, matchedInDocument: Boolean(a.matchedInDocument) })), help: help.map((h) => ({ id: h.entry.id, title: h.entry.title, type: h.entry.type })) };
}
export const searchHelp = (q) => searchKb(String(q || '').slice(0, 200), { limit: 8, types: ['faq', 'guide', 'glossary'] }).map((h) => ({ ...h.entry, score: h.score }));

// ---- feedback ----
export async function submitFeedback(store, user, applicationId, { rating, comment = '' }) {
  const app = await loadApplication(store, user, applicationId);
  if (app.citizen !== user.id) throw new HttpError(403, 'Only the applicant can leave feedback.');
  if (!['response_issued', 'rejected', 'closed'].includes(app.status)) throw new HttpError(409, 'You can leave feedback once your request has a response.');
  const r = Number(rating); if (!Number.isInteger(r) || r < 1 || r > 5) throw new HttpError(400, 'Choose a rating from 1 to 5.', { rating: 'Choose 1 to 5 stars.' });
  const doc = { application: app.id, citizen: user.id, rating: r, comment: String(comment).trim().slice(0, 1000) };
  const existing = await store.findOne('feedback', { application: app.id });
  return existing ? store.update('feedback', existing.id, doc) : store.insert('feedback', doc);
}

// ---- support ----
export async function createTicket(store, user, b = {}) {
  const errors = {}; const name = String(b.name || user?.name || '').trim(); const email = String(b.email || user?.email || '').trim().toLowerCase();
  const subject = String(b.subject || '').trim(); const message = String(b.message || '').trim();
  if (name.length < 2) errors.name = 'Enter your name.'; if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 4 || subject.length > 150) errors.subject = 'Subject must be 4-150 characters.'; if (message.length < 10 || message.length > 3000) errors.message = 'Message must be 10-3000 characters.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  return store.insert('support_tickets', { name, email, subject, message, user: user?.id ?? null, status: 'open' });
}
export const listTickets = (store) => store.find('support_tickets', {}, { sort: { createdAt: -1 } });
export async function setTicketStatus(store, admin, id, status) {
  if (!['open', 'resolved'].includes(status)) throw new HttpError(400, 'Invalid status.');
  const t = await store.update('support_tickets', id, { status }); if (!t) throw new HttpError(404, 'Ticket not found.');
  await audit(store, admin, 'support.updated', 'support_ticket', id, { status }); return t;
}

// ---- password recovery ----
const sha = (t) => createHash('sha256').update(t).digest('hex');
export async function requestPasswordReset(store, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(e)) throw new HttpError(400, 'Enter a valid email address.', { email: 'Enter a valid email address.' });
  const user = await store.findOne('users', { email: e });
  const out = { message: 'If an account exists for that email, a reset link has been sent. The link works for 60 minutes.' };
  if (!user || !user.active) return out; // same answer either way: no account enumeration
  for (const old of await store.find('password_resets', { user: user.id, used: false })) await store.update('password_resets', old.id, { used: true });
  const token = randomBytes(32).toString('hex');
  await store.insert('password_resets', { user: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600_000).toISOString(), used: false });
  const link = `${baseUrl()}/reset-password?token=${token}`;
  await sendEmail(store, { to: user.email, subject: 'RTI Assist: reset your password', text: `Use this link within 60 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email.`, user: user.id });
  // Demo convenience only: with no SMTP, outside production, show the link so the flow can be demonstrated. Never returned when SMTP is set or in production.
  if (appMode() === 'demo' && !smtpConfigured() && process.env.NODE_ENV !== 'production') out.demoResetLink = link;
  return out;
}
export async function resetPassword(store, token, password, hash) {
  const err = validatePassword(password); if (err) throw new HttpError(400, 'Please fix the highlighted fields.', { password: err });
  const row = token ? await store.findOne('password_resets', { tokenHash: sha(String(token)) }) : null;
  if (!row || row.used || new Date(row.expiresAt) < new Date()) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  const user = await store.get('users', row.user);
  await store.transaction(async () => {
    await store.update('users', user.id, { passwordHash: await hash(password), tokenVersion: (user.tokenVersion || 0) + 1 });
    await store.update('password_resets', row.id, { used: true });
    await audit(store, { id: user.id, name: user.name, role: user.role }, 'password.reset', 'user', user.id);
  });
}
