import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function mapLegacyAppPath(pathname: string) {
  if (pathname === '/app' || pathname === '/app/') return '/hall/';
  if (pathname.startsWith('/app/companion')) return pathname.replace('/app/companion', '/hall/ghostling');
  if (pathname.startsWith('/app/rewards')) return pathname.replace('/app/rewards', '/hall/rewards');
  if (pathname.startsWith('/app/giveaways')) return pathname.replace('/app/giveaways', '/hall/rewards');
  if (pathname.startsWith('/app/competitions')) return pathname.replace('/app/competitions', '/hall/competitions');
  if (pathname.startsWith('/app/community')) return pathname.replace('/app/community', '/hall/clan');
  if (pathname.startsWith('/app/clan')) return pathname.replace('/app/clan', '/hall/clan');
  if (pathname.startsWith('/app/profile')) return pathname.replace('/app/profile', '/hall/profile');
  if (pathname.startsWith('/app/casino')) return pathname.replace('/app/casino', '/hall/casino');
  return null;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const legacyPath = mapLegacyAppPath(pathname);

  if (legacyPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyPath;
    return NextResponse.redirect(redirectUrl);
  }

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
  matcher: ['/hall/:path*', '/admin/:path*', '/app/:path*'],
};
