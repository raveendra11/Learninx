import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware that assigns each visitor a stable anonymous id the first
 * time their browser hits the app. The id rides in a long-lived httpOnly
 * cookie so the home page (which is now statically rendered) can stay
 * static while still letting us attribute progress to a per-browser profile.
 */
const COOKIE_NAME = 'learninx_visitor';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function makeVisitorId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return (
    'v_' +
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  );
}

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing && existing.startsWith('v_')) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  res.cookies.set(COOKIE_NAME, makeVisitorId(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

// Don't run on static assets — keep the build fast and avoid noise.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
