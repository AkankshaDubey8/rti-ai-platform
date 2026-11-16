// Built-in RTI knowledge base (shared with the Python service: ai-service/data/rti_knowledge.json). Retrieval = TF-IDF cosine.
import fs from 'node:fs';
import path from 'node:path';
import { tfidfCosine } from './localAi.js';

let KB;
export const kb = () => (KB ||= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ai-service', 'data', 'rti_knowledge.json'), 'utf8')));

// A few common Hindi question words mapped to English retrieval terms, so simple Hindi questions can still find KB entries.
const HI = { 'शुल्क': 'fee', 'फीस': 'fee', 'कितने दिन': 'time days', 'समय': 'time', 'अपील': 'appeal', 'आवेदन': 'file request', 'जानकारी': 'information', 'विभाग': 'department', 'अस्वीकार': 'refuse reject', 'खारिज': 'reject', 'दस्तावेज': 'documents upload', 'गोपनीय': 'privacy', 'कौन': 'who', 'क्या है': 'what is', 'कैसे': 'how', 'स्थिति': 'status track', 'अधिकारी': 'officer pio' };
export const hindiHints = (q) => Object.entries(HI).filter(([k]) => q.includes(k)).map(([, v]) => v).join(' ');

export function searchKb(query, { limit = 3, types } = {}) {
  const entries = kb().entries.filter((e) => !types || types.includes(e.type));
  const docs = entries.map((e) => `${e.title}. ${e.title}. ${e.keywords.join(' ')} ${e.text} ${(e.steps || []).join(' ')}`);
  const q = `${query} ${hindiHints(query)}`;
  const sims = tfidfCosine(q, docs);
  const low = ` ${query.toLowerCase()} `;
  // Curated keyword/phrase hits count extra (+0.08 each, capped at +0.3) on top of TF-IDF similarity.
  const boost = (e) => Math.min(0.3, 0.08 * e.keywords.filter((k) => low.includes(` ${k.toLowerCase()} `) || (k.includes(' ') && low.includes(k.toLowerCase()))).length);
  return entries.map((entry, i) => ({ entry, score: Number((sims[i] + (sims[i] > 0 || boost(entry) > 0.1 ? boost(entry) : 0)).toFixed(4)) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
export const CONFIDENT = 0.14; // below this the assistant says it does not know
