// Calls real Next.js route handlers in-process. Mimics the parts of NextRequest the app uses.
export function makeReq(method, url, { body, form, cookie, headers = {} } = {}) {
  const h = new Headers({ host: 'localhost:3000', origin: 'http://localhost:3000', ...headers });
  if (cookie) h.set('cookie', cookie);
  let init = { method, headers: h };
  if (form) init.body = form;
  else if (body !== undefined) { h.set('content-type', 'application/json'); init.body = JSON.stringify(body); }
  const req = new Request(`http://localhost:3000${url}`, init);
  const jar = Object.fromEntries((cookie || '').split(/;\s*/).filter(Boolean).map((c) => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)]));
  req.cookies = { get: (n) => (jar[n] ? { name: n, value: jar[n] } : undefined) };
  return req;
}
export async function call(mod, method, url, opts = {}) {
  const handler = mod[method];
  if (!handler) throw new Error(`No ${method} export`);
  const res = await handler(makeReq(method, url, opts), { params: opts.params || {} });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.match(/rti_session=([^;]*)/)?.[1];
  return { status: res.status, json, text, headers: res.headers, buffer: Buffer.from(text, 'latin1'), session: cookie ? `rti_session=${cookie}` : null };
}
export async function callRaw(mod, method, url, opts = {}) { // for binary bodies (PDF)
  const res = await mod[method](makeReq(method, url, opts), { params: opts.params || {} });
  return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
}
