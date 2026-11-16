// Client for the Python FastAPI service, with an explicitly labelled local fallback when it cannot be reached.
import { aiServiceUrl, aiTimeoutMs } from './env.js';
import * as local from './localAi.js';

async function post(path, payload, timeoutMs) {
  const res = await fetch(`${aiServiceUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.AI_SERVICE_TOKEN ? { 'X-AI-Token': process.env.AI_SERVICE_TOKEN } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs || aiTimeoutMs()),
  });
  if (!res.ok) throw new Error(`AI service returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function analyze(payload, opts = {}) {
  try {
    return await post('/analyze', payload, opts.timeoutMs);
  } catch (e) {
    const out = local.analyze({ ...payload, topK: payload.top_k || 3 });
    out.fallback_reason = `Python AI service unavailable (${e.message}). Local keyword/TF-IDF fallback used.`;
    return out;
  }
}

export async function generateDraft(payload, opts = {}) {
  try {
    return await post('/generate-response', payload, opts.timeoutMs);
  } catch (e) {
    const out = local.generateDraft(payload);
    out.llm_error = `Python AI service unavailable (${e.message}). Local template used.`;
    return out;
  }
}

export async function aiHealth() {
  try {
    const res = await fetch(`${aiServiceUrl()}/health`, { signal: AbortSignal.timeout(2500) });
    return { reachable: res.ok, ...(await res.json()) };
  } catch (e) { return { reachable: false, error: e.message }; }
}
