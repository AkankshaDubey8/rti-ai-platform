// Offline stand-in for bcryptjs (scrypt) so tests can exercise login. NOT bcrypt: used by tests only.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
const hash = async (pw) => { const salt = randomBytes(8).toString('hex'); return `$shim$${salt}$${scryptSync(pw, salt, 16, { N: 1024 }).toString('hex')}`; };
const compare = async (pw, h) => { const [, , salt, digest] = String(h).split('$'); if (!salt) return false; const d = scryptSync(pw, salt, 16, { N: 1024 }).toString('hex'); return d.length === digest.length && timingSafeEqual(Buffer.from(d), Buffer.from(digest)); };
export default { hash, compare };
