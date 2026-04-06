import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

async function readAuthToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  return (
    await getToken({
      req: request as never,
      secret,
      secureCookie: true,
      cookieName: '__Secure-authjs.session-token',
      salt: '__Secure-authjs.session-token',
    })
    ?? await getToken({
      req: request as never,
      secret,
      secureCookie: false,
      cookieName: 'authjs.session-token',
      salt: 'authjs.session-token',
    })
  );
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const devAuthEnabled = process.env.ENABLE_DEV_AUTH === 'true';
  const legacyDevSession = devAuthEnabled
    && Boolean(request.cookies.get('ghosted_session')?.value);
  const legacyDevAdmin = legacyDevSession
    && request.cookies.get('ghosted_dev_admin')?.value === '1';
  const token = await readAuthToken(request);

  if (pathname.startsWith('/hall') && !token?.sub && !legacyDevSession) {
    const loginUrl = new URL(devAuthEnabled ? '/auth/dev-login' : '/auth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') && !token?.sub && !legacyDevSession && !legacyDevAdmin) {
    const loginUrl = new URL(devAuthEnabled ? '/auth/dev-login' : '/auth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/hall/:path*', '/admin/:path*'],
};
