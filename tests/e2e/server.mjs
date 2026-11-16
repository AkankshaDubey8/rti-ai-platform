// Sandbox harness server: serves the built SPA and runs the REAL API route handlers (app/api/**) over HTTP on a temp demo database.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = process.cwd(); const OUT = process.env.E2E_OUT || '/tmp/rti-e2e'; const PORT = Number(process.env.PORT || 3100);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rti-e2e-data-'));
Object.assign(process.env, { DEMO_DB_FILE: path.join(tmp, 'db.json'), UPLOAD_DIR: path.join(tmp, 'uploads'), AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:9', AI_TIMEOUT_MS: '1500', DEMO_PASSWORD: 'Demo@12345' });
delete process.env.MONGODB_URI;
const apiRoot = path.join(ROOT, 'app/api');
function resolveRoute(segs) {
  let dir = apiRoot; const params = {};
  for (const s of segs) { if (fs.existsSync(path.join(dir, s)) && fs.statSync(path.join(dir, s)).isDirectory()) { dir = path.join(dir, s); continue; }
    const dyn = fs.readdirSync(dir).find((n) => n.startsWith('[') && fs.statSync(path.join(dir, n)).isDirectory()); if (!dyn) return null; params[dyn.slice(1, -1)] = decodeURIComponent(s); dir = path.join(dir, dyn); }
  const f = path.join(dir, 'route.js'); return fs.existsSync(f) ? { file: f, params } : null;
}
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = resolveRoute(url.pathname.slice(5).split('/').filter(Boolean)); if (!r) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"No such API route"}'); }
      const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const rq = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const jar = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)])); rq.cookies = { get: (n) => (jar[n] ? { name: n, value: jar[n] } : undefined) };
      const mod = await import(r.file); const handler = mod[req.method]; if (!handler) { res.writeHead(405); return res.end(); }
      const out = await handler(rq, { params: r.params }); const h = {}; out.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; }); const sc = out.headers.getSetCookie?.() || []; if (sc.length) h['set-cookie'] = sc;
      res.writeHead(out.status, h); return res.end(Buffer.from(await out.arrayBuffer()));
    }
    const file = path.join(OUT, url.pathname.slice(1)); const ext = path.extname(file);
    if (['.js', '.css'].includes(ext) && fs.existsSync(file)) { res.writeHead(200, { 'content-type': MIME[ext] }); return res.end(fs.readFileSync(file)); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync(path.join(OUT, 'index.html')));
  } catch (e) { console.error('[server]', e); res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message) })); }
}).listen(PORT, () => console.log(`e2e server on http://localhost:${PORT}`));
