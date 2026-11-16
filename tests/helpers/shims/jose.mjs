// Offline HS256 JWT stand-in implementing the subset of `jose` that the app uses.
import { createHmac, timingSafeEqual } from 'node:crypto';
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data, key) => createHmac('sha256', key).update(data).digest('base64url');
export class SignJWT {
  constructor(payload) { this.payload = { ...payload }; this.header = {}; }
  setProtectedHeader(h) { this.header = h; return this; }
  setSubject(s) { this.payload.sub = s; return this; }
  setIssuedAt() { this.payload.iat = Math.floor(Date.now() / 1000); return this; }
  setExpirationTime(t) { this.payload.exp = Math.floor(Date.now() / 1000) + parseInt(t, 10); return this; }
  async sign(key) { const d = `${b64(JSON.stringify(this.header))}.${b64(JSON.stringify(this.payload))}`; return `${d}.${sign(d, key)}`; }
}
export async function jwtVerify(token, key) {
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) throw new Error('malformed');
  const expected = sign(`${h}.${p}`, key);
  if (s.length !== expected.length || !timingSafeEqual(Buffer.from(s), Buffer.from(expected))) throw new Error('bad signature');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) throw new Error('expired');
  return { payload };
}
