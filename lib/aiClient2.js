// Extra calls to the Python AI service (assistant LLM gateway, translation, document extraction).
import { aiServiceUrl, aiTimeoutMs } from './env.js';

export async function aiPost(path, payload, timeoutMs) {
  const res = await fetch(`${aiServiceUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.AI_SERVICE_TOKEN ? { 'X-AI-Token': process.env.AI_SERVICE_TOKEN } : {}) },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs || aiTimeoutMs()),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.detail || `AI service returned ${res.status}`); e.status = res.status; throw e; }
  return data;
}
