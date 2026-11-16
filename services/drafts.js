import { HttpError } from '../lib/errors.js';
import { detectLanguage } from '../lib/lang.js';

const MAX_DRAFTS = 10;
const s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Only whitelisted, size-capped fields are stored. Files are never stored in drafts: the citizen re-attaches them before submitting.
export function sanitizeDraftData(d = {}) {
  const out = {
    applicant: { name: s(d.applicant?.name, 80), phone: s(d.applicant?.phone, 20), address: s(d.applicant?.address, 300) },
    department: s(d.department, 40) || null, subject: s(d.subject, 200), description: s(d.description, 5000), referenceInfo: s(d.referenceInfo, 500),
  };
  if (d.translation?.text) out.translation = { text: s(d.translation.text, 5000), engine: s(d.translation.engine, 100) };
  return out;
}

export async function saveDraft(store, user, { id, data, step }) {
  const clean = sanitizeDraftData(data); const st = Math.min(Math.max(Number(step) || 0, 0), 6);
  const doc = { user: user.id, title: clean.subject || 'Untitled draft', step: st, data: clean };
  if (id) {
    const existing = await store.get('application_drafts', id);
    if (!existing || existing.user !== user.id) throw new HttpError(404, 'Draft not found.');
    return store.update('application_drafts', id, doc);
  }
  if ((await store.count('application_drafts', { user: user.id })) >= MAX_DRAFTS) throw new HttpError(409, `You can keep up to ${MAX_DRAFTS} saved drafts. Delete one first.`);
  return store.insert('application_drafts', doc);
}
export const listDrafts = async (store, user) => (await store.find('application_drafts', { user: user.id }, { sort: { updatedAt: -1 } })).map((d) => ({ id: d.id, title: d.title, step: d.step, updatedAt: d.updatedAt, language: detectLanguage(d.data?.description).code }));
export async function getDraft(store, user, id) {
  const d = await store.get('application_drafts', id);
  if (!d || d.user !== user.id) throw new HttpError(404, 'Draft not found.');
  return { id: d.id, step: d.step, data: d.data, updatedAt: d.updatedAt };
}
export async function deleteDraft(store, user, id) {
  const d = await store.get('application_drafts', id);
  if (!d || d.user !== user.id) throw new HttpError(404, 'Draft not found.');
  await store.remove('application_drafts', id);
}
