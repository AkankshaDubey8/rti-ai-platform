// Minimal stand-in for next/server (NextResponse with json() and cookies.set()).
export class NextResponse extends Response {
  constructor(body, init) { super(body, init); const self = this; this.cookies = { set(c) { self.headers.append('set-cookie', `${c.name}=${c.value}; Path=${c.path || '/'}; Max-Age=${c.maxAge ?? ''}${c.httpOnly ? '; HttpOnly' : ''}${c.sameSite ? `; SameSite=${c.sameSite}` : ''}`); } }; }
  static json(data, init = {}) { return new NextResponse(JSON.stringify(data), { status: init.status || 200, headers: { 'content-type': 'application/json' } }); }
  static redirect(url, status = 307) { return new NextResponse(null, { status, headers: { location: String(url) } }); }
  static next() { return new NextResponse(null, { status: 200 }); }
}
export const NextRequest = Request;
