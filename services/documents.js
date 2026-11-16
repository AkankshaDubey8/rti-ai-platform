// Documents: authorised reads, text extraction (Python service: PDF text layer + OCR) and PDF receipts / responses.
import { HttpError } from '../lib/errors.js';
import { readStoredFile } from '../lib/files.js';
import { aiPost } from '../lib/aiClient2.js';
import { buildPdf } from '../lib/pdf.js';
import { deadlineInfo } from '../lib/deadlines.js';
import { loadApplication } from './applications.js';
import { getSettings, nameMaps } from './common.js';

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export async function openDocument(store, user, applicationId, docId) {
  const app = await loadApplication(store, user, applicationId);
  const doc = (app.documents || []).find((d) => d.id === docId);
  if (!doc) throw new HttpError(404, 'Document not found.');
  let bytes; try { bytes = await readStoredFile(app.applicationId, doc.storedName); } catch { throw new HttpError(404, 'The stored file is missing.'); }
  return { app, doc, bytes };
}

export async function extractDocument(store, user, applicationId, docId, { force = false } = {}) {
  const { app, doc, bytes } = await openDocument(store, user, applicationId, docId);
  if (doc.extracted && !force) return doc.extracted;
  let result;
  try {
    result = await aiPost('/extract', { filename: doc.originalName, mime: doc.mimeType, data_b64: bytes.toString('base64'), ocr: true }, 120000);
  } catch (e) {
    if (doc.mimeType === 'text/plain') { // plain text needs no AI service
      const text = bytes.toString('utf8').slice(0, 60000);
      result = { text, summary: text.split(/(?<=[.!?])\s+/).slice(0, 3).join(' '), summary_method: 'first sentences (AI service unavailable)', method: 'plain-text', pages: null, ocr_used: false, warnings: [], chars: text.length };
    } else throw new HttpError(503, `Text extraction needs the Python AI service (with pypdf and, for scans, Tesseract OCR). It is not reachable: ${e.message}`);
  }
  const extracted = { text: result.text, summary: result.summary, summaryMethod: result.summary_method, method: result.method, pages: result.pages, ocrUsed: result.ocr_used, warnings: result.warnings, chars: result.chars, at: new Date().toISOString() };
  await store.update('applications', app.id, { documents: app.documents.map((d) => (d.id === docId ? { ...d, extracted } : d)) });
  return extracted;
}

export async function receiptPdf(store, user, applicationId) {
  const app = await loadApplication(store, user, applicationId);
  const [maps, settings] = await Promise.all([nameMaps(store), getSettings(store)]);
  const d = deadlineInfo(app, settings.responseDeadlineDays);
  const citizen = maps.user[app.citizen] || '';
  const blocks = [{ t: 'h1', text: 'Acknowledgement of RTI request' }, { t: 'kv', key: 'Application ID', value: app.applicationId }, { t: 'kv', key: 'Submitted on', value: fmt(app.createdAt) },
    { t: 'kv', key: 'Applicant', value: app.applicant?.name || citizen }, { t: 'kv', key: 'Subject', value: app.subject }, { t: 'kv', key: 'Department', value: maps.dept[app.department] || 'To be confirmed by an officer' },
    { t: 'kv', key: 'Documents attached', value: String((app.documents || []).length) }, { t: 'kv', key: 'Target response date', value: `${fmt(d.dueAt)} (platform setting: ${settings.responseDeadlineDays} days from submission)` },
    { t: 'rule' }, { t: 'h2', text: 'Your request' }, { t: 'p', text: app.description }];
  if (app.referenceInfo) blocks.push({ t: 'kv', key: 'Reference', value: app.referenceInfo });
  if (app.isDemo) blocks.push({ t: 'note', text: 'DEMO DATA: this record belongs to a fictional demonstration account.' });
  blocks.push({ t: 'rule' }, { t: 'note', text: 'This receipt only confirms that the request was recorded on RTI Assist. RTI Assist is an independent academic project and is not an official government portal. Keep this ID to track your request.' });
  return { filename: `${app.applicationId}-acknowledgement.pdf`, buffer: buildPdf({ title: 'RTI Assist: Acknowledgement', subtitle: app.applicationId, footer: 'Independent academic project. Not an official government document.', blocks }) };
}

export async function responsePdf(store, user, applicationId) {
  const app = await loadApplication(store, user, applicationId);
  if (!['response_issued', 'closed'].includes(app.status) || !app.finalResponse) throw new HttpError(404, 'No issued response is available for this application.');
  const maps = await nameMaps(store);
  const blocks = [{ t: 'kv', key: 'Application ID', value: app.applicationId }, { t: 'kv', key: 'Subject', value: app.subject }, { t: 'kv', key: 'Department', value: maps.dept[app.department] || '' },
    { t: 'kv', key: 'Issued on', value: fmt(app.respondedAt) }, { t: 'rule' }, { t: 'pre', text: app.finalResponse }, { t: 'rule' }];
  if (app.isDemo) blocks.push({ t: 'note', text: 'DEMO DATA: a demonstration response. It is not an official reply.' });
  blocks.push({ t: 'note', text: 'Reviewed, approved and issued by an authorised officer on RTI Assist. RTI Assist is an independent academic project.' });
  return { filename: `${app.applicationId}-response.pdf`, buffer: buildPdf({ title: 'Response to your RTI request', subtitle: app.applicationId, footer: 'Issued via RTI Assist (independent academic project)', blocks }) };
}
