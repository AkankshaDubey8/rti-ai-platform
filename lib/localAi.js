// Local JavaScript fallback used ONLY when the Python AI service is unreachable.
// It performs real (but simpler) computations: keyword classification, TF-IDF cosine search and a template draft.
// Every result is labelled engine "local-js-fallback" so it is never mistaken for the MiniLM/LLM pipeline.
import fs from 'node:fs';
import path from 'node:path';

const STOP = new Set('a an and are as at be been by for from has have how i in is it its of on or please provide shall that the their there this to under was were what when where which who why will with you your me my our us any all copy details detail information kindly regarding respect sir madam can could do does did get got'.split(' '));
let CATS;
export function categories() {
  CATS ||= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ai-service', 'data', 'categories.json'), 'utf8')).categories;
  return CATS;
}
const stem = (t) => (t.length > 4 && t.endsWith('ies') ? `${t.slice(0, -3)}y` : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
export const tokenize = (text) => (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t)).map(stem);
const sentences = (text) => String(text || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);

export function tfidfCosine(query, docs) {
  const dt = docs.map(tokenize); const qt = tokenize(query); const n = docs.length;
  const df = new Map(); dt.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const idf = (w) => Math.log((1 + n) / (1 + (df.get(w) || 0))) + 1;
  const vec = (tokens) => {
    const tf = new Map(); tokens.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    const v = new Map(); let norm = 0;
    tf.forEach((c, w) => { const x = (1 + Math.log(c)) * idf(w); v.set(w, x); norm += x * x; });
    norm = Math.sqrt(norm) || 1; v.forEach((x, w) => v.set(w, x / norm));
    return v;
  };
  const q = vec(qt);
  return dt.map((t) => { const v = vec(t); let s = 0; q.forEach((x, w) => { s += x * (v.get(w) || 0); }); return s; });
}

export function classify(subject, description) {
  const text = ` ${`${subject}. ${description}`.toLowerCase().replace(/[^a-z0-9\- ]+/g, ' ')} `;
  const scored = categories().filter((c) => c.name !== 'Other').map((c) => {
    const hits = c.keywords.filter((k) => new RegExp(`(?<![a-z0-9])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![a-z0-9])`).test(text));
    return { name: c.name, hits, score: Math.min(1, 0.25 * hits.length) };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const category = best.hits.length ? best.name : 'Other';
  return {
    category, score: best.score, score_type: 'uncalibrated keyword score (not a probability)', method: 'keyword-fallback',
    keywords: category === 'Other' ? [] : best.hits,
    explanation: category === 'Other' ? "No category keywords were found, so the request was labelled 'Other'. (Python AI service unavailable: keyword matching used.)"
      : `The request mentions ${best.hits.join(', ')}, which matches '${category}'. (Python AI service unavailable: keyword matching used.)`,
    top_categories: scored.slice(0, 3).map((s) => ({ category: s.name, score: s.score })),
  };
}

const recText = (r) => [r.title, r.application_summary, r.response_summary].filter(Boolean).join(' . ');
export function search(query, records, topK = 3) {
  const sims = tfidfCosine(query, records.map(recText));
  const q = new Set(tokenize(query));
  return records.map((r, i) => ({ r, s: sims[i] })).sort((a, b) => b.s - a.s).slice(0, topK).map(({ r, s }) => {
    const best = [...sentences(r.response_summary), ...sentences(r.application_summary)].map((x, i) => ({ x, i, k: tokenize(x).filter((t) => q.has(t)).length })).sort((a, b) => b.k - a.k || a.i - b.i);
    return { id: r.id, record_id: r.record_id, title: r.title, department: r.department, category: r.category, similarity: Number(s.toFixed(4)),
      extracted_information: best.filter((b) => b.k > 0).slice(0, 2).map((b) => b.x).join(' ') || best[0]?.x || '', response_summary: r.response_summary };
  });
}

export function recommendDepartment(category, text, departments, retrieved, selected) {
  const depts = departments.filter((d) => d.active !== false);
  if (!depts.length) return { recommended: null, reason: 'No active departments are configured.', category, alternatives: [], citizen_selected: selected };
  const sims = tfidfCosine(text, depts.map((d) => `${d.name}. ${d.description}. ${(d.categories || []).join(' ')}`));
  const scored = depts.map((d, i) => {
    const cat = (d.categories || []).includes(category) ? 1 : 0;
    const vote = retrieved.length ? retrieved.filter((r) => r.department === d.name).length / retrieved.length : 0;
    return { d, cat, vote, score: 0.6 * cat + 0.25 * sims[i] + 0.15 * vote };
  }).sort((a, b) => b.score - a.score);
  const b = scored[0];
  const bits = [];
  if (b.cat) bits.push(`it handles the '${category}' category`);
  if (b.vote) bits.push(`${Math.round(b.vote * 100)}% of similar historical records belong to it`);
  if (!bits.length) bits.push('no stronger match was found');
  return { recommended: { id: b.d.id, name: b.d.name }, reason: `${b.d.name} is suggested because ${bits.join('; ')}.`, category, score: Number(b.score.toFixed(4)),
    score_type: 'uncalibrated heuristic score', alternatives: scored.slice(1, 3).filter((s) => s.score > 0).map((s) => ({ id: s.d.id, name: s.d.name, score: Number(s.score.toFixed(4)) })), citizen_selected: selected };
}

export function analyze({ application, departments, records, topK = 3 }) {
  const query = `${application.subject}. ${application.description}`;
  const classification = classify(application.subject, application.description);
  const results = search(query, records, topK);
  return {
    classification,
    department_recommendation: recommendDepartment(classification.category, query, departments, results, application.selected_department),
    similar_records: results,
    search: { method: 'TF-IDF cosine fallback (Python AI service unavailable)', embedding_model: null, note: 'Similarity scores measure textual closeness only; they do not prove authenticity, factual or legal correctness.' },
    new_embeddings: {}, engine: 'local-js-fallback',
    disclaimer: 'AI-generated suggestion. Not verified. Must be reviewed, edited and approved by an authorised officer before any response is issued.',
  };
}

const CUE = /\b(provide|furnish|details?|copy|copies|list|number of|how many|when|why|whether|status|please|supply|disclose|inspect|record|report|expenditure|amount)\b/i;
export function generateDraft({ application, category, department_name, records }) {
  const items = (sentences(application.description).filter((s) => CUE.test(s)).slice(0, 6));
  const identified = []; const missing = [];
  for (const item of items.length ? items : sentences(application.description).slice(0, 3)) {
    const terms = new Set(tokenize(item)); let best = null; let ratio = 0;
    for (const r of records) {
      const rt = new Set(tokenize(`${r.extracted_information} ${r.response_summary}`));
      const x = terms.size ? [...terms].filter((t) => rt.has(t)).length / terms.size : 0;
      if (x > ratio) { ratio = x; best = r; }
    }
    if (best && ratio >= 0.5) identified.push({ requested_item: item, source_record: best.record_id, source_title: best.title, statement: best.extracted_information, term_overlap: Number(ratio.toFixed(2)) });
    else missing.push(item);
  }
  const weak = !records.length || Math.max(...records.map((r) => r.similarity || 0)) < 0.2;
  if (weak) missing.push('No sufficiently similar historical record exists, so all requested facts need verification from current files.');
  const ref = application.application_id || '[application id]';
  const text = [
    '*** DRAFT - GENERATED FROM A FIXED TEMPLATE (NO LLM USED) - NOT AN OFFICIAL RESPONSE ***', '',
    `Subject: Response to RTI application ${ref} - ${application.subject}`, '', 'Sir/Madam,', '',
    `This is with reference to your application ${ref} received by ${department_name || '[Department]'} under the Right to Information Act, 2005.`, '',
    '1. Information that may be available (each point must be verified against current department records before issue):',
    ...(identified.length ? identified.map((i, n) => `   ${n + 1}. Regarding "${i.requested_item}": ${i.statement}  [Reference: DEMO historical record ${i.source_record} - verify]`) : ['   [TO BE VERIFIED BY OFFICER: no supporting information was found in the retrieved historical records.]']),
    '', '2. Information that could not be supported from the retrieved records:',
    ...(missing.length ? missing.map((m) => `   - [TO BE VERIFIED BY OFFICER: ${m}]`) : ['   - None identified by the automated gap check (officer must still confirm).']),
    '', '3. Appeal details: [OFFICER TO INSERT first appellate authority and time limit as per department rules].', '',
    'Yours faithfully,', `Public Information Officer, ${department_name || '[Department]'}`,
  ].join('\n');
  return {
    generation_mode: 'template-fallback', llm_error: null,
    disclaimer: 'AI-generated suggestion. Not verified. Must be reviewed, edited and approved by an authorised officer before any response is issued.',
    draft: {
      application_reference: application.application_id, subject: application.subject, request_summary: sentences(application.description).slice(0, 2).join(' '),
      identified_information: identified, missing_information: missing,
      suggested_structure: ['Acknowledge the application reference and date', 'Answer each numbered request using only verified information', 'State clearly any information that is unavailable or withheld, with the lawful reason', 'Give appeal details and officer sign-off'],
      verification_notes: [...(weak ? ['Retrieved records are only weakly similar to this request: treat the draft as a skeleton and gather the information from original files.'] : []), 'Check every statement against current, official department records. Historical records are reference material only.', 'Confirm whether any exemption or third-party consideration applies; the AI does not make that decision.', 'Confirm fees, dates and appeal details before issuing.'],
      draft_text: text,
    },
  };
}
