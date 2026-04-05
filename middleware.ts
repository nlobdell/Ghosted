import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const token = await getToken({
    req: request as never,
    secret: process.env.AUTH_SECRET,
  });
  const legacyDevSession = process.env.ENABLE_DEV_AUTH === 'true'
    && Boolean(request.cookies.get('ghosted_session')?.value);

  if (pathname.startsWith('/hall') && !token?.sub && !legacyDevSession) {
    const loginUrl = new URL('/auth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = Boolean(token && 'isAdmin' in token && token.isAdmin);
  if (pathname.startsWith('/admin') && !isAdmin) {
    if (!token?.sub && !legacyDevSession) {
      const loginUrl = new URL('/auth/login', request.nextUrl.origin);
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL('/hall/', request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/hall/:path*', '/admin/:path*'],
};
