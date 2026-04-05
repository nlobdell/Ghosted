import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth(async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const legacyDevSession = process.env.ENABLE_DEV_AUTH === 'true'
    && Boolean(request.cookies.get('ghosted_session')?.value);
  const sessionUser = request.auth?.user;

  if (pathname.startsWith('/hall') && !sessionUser?.id && !legacyDevSession) {
    const loginUrl = new URL('/auth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = Boolean(sessionUser && 'isAdmin' in sessionUser && sessionUser.isAdmin);
  if (pathname.startsWith('/admin') && !isAdmin) {
    if (!sessionUser?.id && !legacyDevSession) {
      const loginUrl = new URL('/auth/login', request.nextUrl.origin);
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL('/hall/', request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/hall/:path*', '/admin/:path*'],
};
