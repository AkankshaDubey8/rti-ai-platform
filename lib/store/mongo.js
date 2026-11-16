// MongoDB Atlas store (Mongoose). Same interface as memory.js; documents are returned as plain objects with string ids.
import mongoose from 'mongoose';
import { AsyncLocalStorage } from 'node:async_hooks';
import { COLLECTIONS } from '../../models/index.js';

const als = new AsyncLocalStorage();
const session = () => als.getStore()?.session;
const G = globalThis;

function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && v._bsontype === 'ObjectId') return String(v);
  if (v instanceof Date || v === null || typeof v !== 'object') return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === '__v') continue;
    out[k === '_id' ? 'id' : k] = clean(val);
  }
  return out;
}
const M = (name) => { const m = COLLECTIONS[name]; if (!m) throw new Error(`Unknown collection ${name}`); return m; };
const withSession = (q) => (session() ? q.session(session()) : q);
const safe = async (fn) => { try { return await fn(); } catch (e) { if (e?.name === 'CastError') return null; throw e; } };

const store = {
  kind: 'mongodb',
  async connect() {
    if (mongoose.connection.readyState === 1) return;
    G.__rtiMongoConn ||= mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try { await G.__rtiMongoConn; } catch (e) { G.__rtiMongoConn = null; throw new Error(`Could not connect to MongoDB: ${e.message}`); }
  },
  async find(name, query = {}, { sort = { createdAt: -1 }, limit, skip = 0 } = {}) {
    let q = withSession(M(name).find(query).sort(sort).skip(skip));
    if (limit) q = q.limit(limit);
    return clean(await safe(() => q.lean()) ?? []);
  },
  async findOne(name, query) { return clean(await safe(() => withSession(M(name).findOne(query)).lean())); },
  async get(name, id) { return id ? clean(await safe(() => withSession(M(name).findById(id)).lean())) : null; },
  async count(name, query = {}) { return withSession(M(name).countDocuments(query)); },
  async insert(name, doc) {
    try {
      const [created] = await M(name).create([doc], session() ? { session: session() } : undefined);
      return clean(created.toObject());
    } catch (e) {
      if (e?.code === 11000) throw Object.assign(new Error('Duplicate value'), { code: 'DUPLICATE' });
      throw e;
    }
  },
  async update(name, id, patch) {
    return clean(await safe(() => M(name).findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true, session: session() }).lean()));
  },
  async remove(name, id) { const r = await safe(() => M(name).deleteOne({ _id: id }, { session: session() })); return Boolean(r?.deletedCount); },
  async clearAll() { for (const m of Object.values(COLLECTIONS)) await m.deleteMany({}); },
  // Real multi-document transaction (requires a replica set; Atlas provides one). Falls back to plain execution on standalone servers.
  async transaction(fn) {
    if (session()) return fn();
    const s = await mongoose.startSession();
    try {
      let result;
      await s.withTransaction(async () => { result = await als.run({ session: s }, fn); });
      return result;
    } catch (e) {
      if (e?.code === 20 || /Transaction numbers are only allowed/.test(e?.message || '')) return fn();
      throw e;
    } finally { await s.endSession(); }
  },
};
export default store;
