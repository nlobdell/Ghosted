import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
];

async function clearAuthCookies() {
  const cookieStore = await cookies();
  for (const name of COOKIE_NAMES) {
    cookieStore.set(name, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  await clearAuthCookies();
  const url = new URL(request.url);
  const destination = url.searchParams.get('next') ?? '/';
  return NextResponse.redirect(new URL(destination, url.origin));
}
