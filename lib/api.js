import { NextResponse } from 'next/server';
import { HttpError } from './errors.js';
import { optionalUser, requireUser } from './auth.js';
import { rateLimit, clientIp } from './rateLimit.js';

export const json = (data, status = 200) => NextResponse.json(data, { status });

// CSRF defence in depth (on top of SameSite=Lax cookies): browsers always send Origin / Sec-Fetch-Site on cross-site
// writes. Mutating requests from another origin are refused. Non-browser clients (no Origin) are allowed; they still need the cookie.
function assertSameOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let originHost = null; try { originHost = new URL(origin).host; } catch { /* invalid */ }
  if (!originHost || (host && originHost !== host)) throw new HttpError(403, 'Cross-site requests are not allowed.');
}

// Wraps a route handler with authentication, role checks, optional rate limiting and safe error responses.
export function route(handler, { roles, rate, optionalAuth } = {}) {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      if (rate) {
        const r = rateLimit(`${rate.name}:${clientIp(req)}`, rate);
        if (!r.ok) throw new HttpError(429, `Too many attempts. Try again in ${r.retryAfter} seconds.`);
      }
      const user = roles ? await requireUser(req, roles) : optionalAuth ? await optionalUser(req) : null;
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, user, params });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      console.error('[api]', e);
      return NextResponse.json({ error: 'Something went wrong on the server. Please try again.' }, { status: 500 });
    }
  };
}
export async function body(req) {
  try { return await req.json(); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}
export const invalid = (errors) => new HttpError(400, 'Please fix the highlighted fields.', errors);
