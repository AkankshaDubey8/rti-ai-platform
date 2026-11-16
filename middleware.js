import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { jwtSecret } from './lib/env.js';

// Page-level gate (edge runtime): checks the signed session cookie and the role for each area.
// This is a UX/defence-in-depth layer only. Every API route re-checks the user and role on the server.
const HOME = { citizen: '/citizen', officer: '/officer', admin: '/admin' };
const AREA = [['/citizen', ['citizen']], ['/officer', ['officer', 'admin']], ['/admin', ['admin']], ['/settings', ['citizen', 'officer', 'admin']]];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  let role = null;
  const token = req.cookies.get('rti_session')?.value;
  if (token) { try { role = (await jwtVerify(token, new TextEncoder().encode(jwtSecret()))).payload.role; } catch { role = null; } }

  if (pathname === '/login' || pathname === '/register') return role ? NextResponse.redirect(new URL(HOME[role] || '/', req.url)) : NextResponse.next();
  const area = AREA.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!area) return NextResponse.next();
  if (!role) { const url = new URL('/login', req.url); url.searchParams.set('next', pathname); return NextResponse.redirect(url); }
  if (!area[1].includes(role)) return NextResponse.redirect(new URL(HOME[role] || '/', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/citizen/:path*', '/officer/:path*', '/admin/:path*', '/settings', '/login', '/register'] };
