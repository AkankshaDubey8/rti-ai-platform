import { SignJWT, jwtVerify } from 'jose';
import { jwtSecret } from './env.js';
import { getStore } from './store/index.js';
import { HttpError } from './errors.js';

export const COOKIE = 'rti_session';
const MAX_AGE = 60 * 60 * 24 * 7;
const key = () => new TextEncoder().encode(jwtSecret());

export const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, department: u.department || null, phone: u.phone || '', isDemo: Boolean(u.isDemo), createdAt: u.createdAt });

export async function signSession(user) {
  return new SignJWT({ role: user.role, name: user.name, tv: user.tokenVersion || 0 }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
}
export const sessionCookie = (token) => ({ name: COOKIE, value: token, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });

// Server-side authentication + role check. The user is re-loaded from the database on every call so that
// deactivated accounts and changed roles take effect immediately (the JWT alone is never trusted for authority).
export async function requireUser(req, roles) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  let payload;
  try { ({ payload } = await jwtVerify(token, key())); } catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  const store = await getStore();
  const user = await store.get('users', payload.sub);
  if (!user || !user.active) throw new HttpError(401, 'This account is not active.');
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw new HttpError(401, 'Your session is no longer valid. Please sign in again.');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'You do not have permission to do this.');
  return publicUser(user);
}

// For public endpoints that behave a little differently when someone is signed in (never throws).
export async function optionalUser(req) { try { return await requireUser(req); } catch { return null; } }
