// Demo-mode store: collections persisted to data/demo-db.json. Same interface as the MongoDB store.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const FILE = process.env.DEMO_DB_FILE || path.join(process.cwd(), 'data', 'demo-db.json');
const G = globalThis;
const newId = () => randomBytes(12).toString('hex');
const clone = (v) => (v === undefined ? v : structuredClone(v));

function db() {
  if (!G.__rtiDemoDb) {
    try { G.__rtiDemoDb = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { G.__rtiDemoDb = {}; }
  }
  return G.__rtiDemoDb;
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db()));
  fs.renameSync(`${FILE}.tmp`, FILE);
}
const col = (name) => (db()[name] ||= []);

export function matches(doc, query = {}) {
  return Object.entries(query).every(([k, v]) => {
    const a = doc[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v) return v.$in.map(String).includes(String(a));
      if ('$ne' in v) return String(a ?? '') !== String(v.$ne ?? '');
    }
    if (v === null || v === undefined) return a === null || a === undefined;
    return String(a) === String(v);
  });
}
const sorter = (sort) => (x, y) => {
  for (const [f, dir] of Object.entries(sort)) {
    const a = x[f], b = y[f];
    if (a === b) continue;
    return (a > b ? 1 : -1) * (dir < 0 ? -1 : 1);
  }
  return 0;
};

const store = {
  kind: 'demo',
  async connect() {},
  async find(name, query = {}, { sort = { createdAt: -1 }, limit, skip = 0 } = {}) {
    let rows = col(name).filter((d) => matches(d, query)).sort(sorter(sort)).slice(skip);
    if (limit) rows = rows.slice(0, limit);
    return rows.map(clone);
  },
  async findOne(name, query) { return clone(col(name).find((d) => matches(d, query))) ?? null; },
  async get(name, id) { return id ? clone(col(name).find((d) => d.id === String(id))) ?? null : null; },
  async count(name, query = {}) { return col(name).filter((d) => matches(d, query)).length; },
  async insert(name, doc) {
    const now = new Date().toISOString();
    const row = { ...clone(doc), id: newId(), createdAt: now, updatedAt: now };
    if (name === 'users' && col(name).some((u) => u.email === row.email)) throw Object.assign(new Error('Email already registered'), { code: 'DUPLICATE' });
    if (name === 'applications' && col(name).some((a) => a.applicationId === row.applicationId)) throw Object.assign(new Error('Duplicate application id'), { code: 'DUPLICATE' });
    col(name).push(row); persist();
    return clone(row);
  },
  async update(name, id, patch) {
    const row = col(name).find((d) => d.id === String(id));
    if (!row) return null;
    Object.assign(row, clone(patch), { updatedAt: new Date().toISOString() });
    persist();
    return clone(row);
  },
  async remove(name, id) {
    const rows = col(name); const i = rows.findIndex((d) => d.id === String(id));
    if (i >= 0) { rows.splice(i, 1); persist(); }
    return i >= 0;
  },
  async clearAll() { G.__rtiDemoDb = {}; persist(); },
  // Snapshot/rollback transaction (single process, demo only).
  async transaction(fn) {
    const snapshot = structuredClone(db());
    try { return await fn(); } catch (err) { G.__rtiDemoDb = snapshot; persist(); throw err; }
  },
};
export default store;
