// Citizen-facing AI assistance: wizard analysis, the RTI assistant chatbot and Hindi->English translation.
import { HttpError } from '../lib/errors.js';
import * as ai from '../lib/ai.js';
import { aiPost } from '../lib/aiClient2.js';
import { CONFIDENT, searchKb } from '../lib/kb.js';
import { tfidfCosine } from '../lib/localAi.js';
import { checkRequest } from '../lib/requestRules.js';
import { detectLanguage } from '../lib/lang.js';

const toAiDept = (d) => ({ id: d.id, name: d.name, description: d.description || '', categories: d.categories || [], active: d.active !== false });

// ---- wizard step 6: category, department, missing information, similar requests of the same citizen ----
export async function analyzeDraftRequest(store, user, { subject = '', description = '', department = null }) {
  if (subject.trim().length < 3 || description.trim().length < 10) throw new HttpError(400, 'Write a subject and a short description first.');
  const depts = (await store.find('departments', { active: true })).map(toAiDept);
  const analysis = await ai.analyze({ application: { application_id: null, subject, description, reference_info: null, selected_department: department }, departments: depts, records: [] }, { timeoutMs: 20000 });
  const mine = await store.find('applications', { citizen: user.id });
  const drafts = await store.find('application_drafts', { user: user.id });
  const pool = [...mine.map((a) => ({ kind: 'application', id: a.applicationId, subject: a.subject, status: a.status, text: `${a.subject}. ${a.description}` })), ...drafts.map((d) => ({ kind: 'draft', id: d.id, subject: d.title, text: `${d.title}. ${d.data?.description || ''}` }))];
  const sims = pool.length ? tfidfCosine(`${subject}. ${description}`, pool.map((p) => p.text)) : [];
  const similar = pool.map((p, i) => ({ ...p, text: undefined, similarity: Number(sims[i].toFixed(2)) })).filter((p) => p.similarity >= 0.45).sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  const checks = checkRequest({ subject, description });
  return {
    category: analysis.classification.category, categoryKeywords: analysis.classification.keywords,
    recommendedDepartment: analysis.department_recommendation.recommended, departmentReason: analysis.department_recommendation.reason,
    missingInformation: checks.items, language: checks.language, similarOwn: similar,
    engine: analysis.engine === 'python-fastapi' ? 'Python AI service' : 'local fallback (keyword/TF-IDF)', classificationMethod: analysis.classification.method,
    notes: ['Category and department are AI suggestions; an officer confirms them.', 'Missing-information checks are rule-based, not AI.', 'Similar-request warnings only compare against your own earlier requests and drafts.'],
  };
}

// ---- translation ----
export async function translateText(text) {
  const t = String(text || '').trim();
  if (t.length < 3 || t.length > 5000) throw new HttpError(400, 'Enter 3 to 5000 characters to translate.');
  if (detectLanguage(t).code === 'en') throw new HttpError(400, 'This text is already in English.');
  try {
    const r = await aiPost('/translate', { text: t }, 60000);
    return { text: r.translation, engine: r.engine, machineTranslated: true };
  } catch (e) {
    throw new HttpError(503, `Translation is not available right now (${e.status === 503 || !e.status ? e.message : 'service error'}). It needs the Python AI service with the optional local model or an LLM configured. Your original text is unchanged.`);
  }
}

// ---- assistant ----
const SUGGESTED = ['How long does an RTI response take?', 'Is there a fee?', 'What can I do if my request is rejected?', 'How do I write a clear request?', 'What is a PIO?', 'Is my document kept private?'];
export const suggestedQuestions = () => SUGGESTED;
const FALLBACK_NOTICE = 'Fallback mode: this answer comes from the built-in knowledge base and rules. No AI language model was used.';
const NOT_FOUND = "I don't have that in my knowledge base, and I won't guess about legal details, fees, deadlines or contact information. Please ask the Public Information Officer of the authority concerned, or check that authority's official website.";

function renderEntry(e) {
  if (e.steps?.length) return `${e.title}\n${e.text}\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  if (e.type === 'glossary') return `${e.title}: ${e.text}`;
  return e.text;
}
const src = (hits) => hits.map((h) => ({ id: h.entry.id, title: h.entry.title, type: h.entry.type }));

async function llmReply(task, message, history, entries, draft) {
  try {
    const r = await aiPost('/assistant', { task, message, history, entries, draft }, 45000);
    return r.mode?.startsWith('llm:') && r.reply ? { reply: r.reply, label: r.mode } : { reason: r.note || 'No LLM configured' };
  } catch (e) { return { reason: `AI service unreachable (${e.message})` }; }
}

export async function chat(store, user, { message, history = [], context = {} }) {
  const msg = String(message || '').trim();
  if (msg.length < 2 || msg.length > 1500) throw new HttpError(400, 'Type a question of up to 1500 characters.');
  const hist = (Array.isArray(history) ? history : []).slice(-6).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1500) }));
  const draft = String(context.draft || '').slice(0, 5000);
  const lower = msg.toLowerCase();
  const hasDraft = draft.trim().length >= 15;
  const base = (extra) => ({ suggestions: SUGGESTED.slice(0, 3), ...extra });

  if (/\b(rewrite|reword|rephrase|improve|better wording|fix my)\b/.test(lower) && hasDraft) {
    const llm = await llmReply('rewrite', msg, hist, searchKb('how to write a clear request', { limit: 1 }).map((h) => h.entry), draft);
    if (llm.reply) return base({ mode: 'llm', modeLabel: llm.label, reply: llm.reply, sources: [], rewrite: true, notice: 'AI-written suggestion. Check that it still says what you mean before using it. Nothing is submitted automatically.' });
    const c = checkRequest({ subject: '', description: draft });
    const tips = c.items.map((i) => `- ${i.message} ${i.suggestion}`).join('\n') || '- Your request already covers the basics we can check automatically.';
    return base({ mode: 'fallback', reply: `I can't rewrite text automatically right now (${llm.reason}). Here is what to improve, using simple rules:\n${tips}\n\nA clear structure to follow:\n1. [Which record, document or figure you want]\n2. [For which office, place or institution]\n3. [For which time period]`, sources: src(searchKb('how to write a clear request', { limit: 1 })), notice: FALLBACK_NOTICE });
  }
  if (/\b(which department|what department|who handles|where (do|should) i (send|file))\b/.test(lower) || /किस विभाग/.test(msg)) {
    const text = hasDraft ? draft : msg;
    if (text.length < 25) return base({ mode: 'fallback', reply: 'Describe what information you need (a sentence or two) and I will suggest a department.', sources: [], notice: FALLBACK_NOTICE });
    const depts = (await store.find('departments', { active: true })).map(toAiDept);
    const a = await ai.analyze({ application: { subject: text.slice(0, 80), description: text, selected_department: null }, departments: depts, records: [] }, { timeoutMs: 15000 });
    const rec = a.department_recommendation;
    const reply = rec.recommended ? `Suggested department: ${rec.recommended.name}. ${rec.reason}${rec.alternatives?.length ? ` Other possibilities: ${rec.alternatives.map((x) => x.name).join(', ')}.` : ''} This is only a suggestion; an officer confirms the routing.` : 'I could not match a department. Choose one yourself in the form.';
    return base({ mode: 'fallback', reply, sources: [], notice: `${a.engine === 'python-fastapi' ? 'Suggestion from the AI service (category + department scoring).' : 'Suggestion from the local keyword fallback.'} No language model was used.` });
  }
  if (/\b(missing|what else|incomplete|is my (request|draft) (ok|good|clear))\b/.test(lower) && hasDraft) {
    const c = checkRequest({ subject: '', description: draft });
    return base({ mode: 'fallback', reply: c.items.length ? `Things to add or fix:\n${c.items.map((i) => `- ${i.message} ${i.suggestion}`).join('\n')}` : 'I found nothing obviously missing using my rule checks. A human officer may still ask for clarification.', sources: [], notice: 'Rule-based check, not AI. No language model was used.' });
  }

  const hits = searchKb(msg, { limit: 3 }); const confident = hits.length && hits[0].score >= CONFIDENT;
  const llm = confident || /\b(explain|simple|meaning|mean)\b/.test(lower) ? await llmReply(/\b(explain|simple|meaning)\b/.test(lower) ? 'explain' : 'answer', msg, hist, hits.map((h) => h.entry), null) : { reason: 'not attempted' };
  if (llm.reply) return base({ mode: 'llm', modeLabel: llm.label, reply: llm.reply, sources: src(hits), notice: 'Generated by a language model from the built-in knowledge base. It can make mistakes: confirm important details with the public authority.' });
  if (!confident) return base({ mode: 'fallback', reply: NOT_FOUND, sources: [], notice: FALLBACK_NOTICE });
  const related = hits.slice(1).filter((h) => h.score >= CONFIDENT).map((h) => h.entry.title);
  const isHindi = detectLanguage(msg).code !== 'en';
  return base({ mode: 'fallback', reply: `${renderEntry(hits[0].entry)}${related.length ? `\n\nRelated: ${related.join('; ')}` : ''}`, sources: src(hits.slice(0, 2)), notice: `${FALLBACK_NOTICE}${isHindi ? ' The knowledge base is in English; replies in Hindi need an LLM to be configured.' : ''}` });
}
