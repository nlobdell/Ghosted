import { NextResponse } from 'next/server';

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const DEV_ADMIN_COOKIE = 'ghosted_dev_admin';
const LEGACY_SESSION_COOKIE = 'ghosted_session';

export const runtime = 'nodejs';

function filterHeaders(source: Headers) {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === 'content-length') continue;
    headers.set(key, value);
  }
  return headers;
}

function parseSetCookieValue(headerValue: string | null) {
  if (!headerValue) return null;
  const segments = headerValue.split(';').map((segment) => segment.trim()).filter(Boolean);
  const [nameValue, ...attributes] = segments;
  if (!nameValue) return null;
  const separatorIndex = nameValue.indexOf('=');
  if (separatorIndex <= 0) return null;

  const name = nameValue.slice(0, separatorIndex).trim();
  const value = nameValue.slice(separatorIndex + 1);
  const parsed = {
    name,
    value,
    path: '/',
    httpOnly: false,
    sameSite: 'lax' as 'lax' | 'strict' | 'none',
    secure: false,
    maxAge: undefined as number | undefined,
    expires: undefined as Date | undefined,
  };

  for (const attribute of attributes) {
    const [rawKey, ...rawRest] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const nextValue = rawRest.join('=').trim();
    if (key === 'path' && nextValue) parsed.path = nextValue;
    if (key === 'httponly') parsed.httpOnly = true;
    if (key === 'secure') parsed.secure = true;
    if (key === 'samesite' && nextValue.toLowerCase() === 'strict') parsed.sameSite = 'strict';
    if (key === 'samesite' && nextValue.toLowerCase() === 'none') parsed.sameSite = 'none';
    if (key === 'max-age') {
      const numberValue = Number(nextValue);
      if (Number.isFinite(numberValue)) parsed.maxAge = numberValue;
    }
    if (key === 'expires') {
      const dateValue = new Date(nextValue);
      if (!Number.isNaN(dateValue.getTime())) parsed.expires = dateValue;
    }
  }

  return parsed;
}

export async function GET(request: Request) {
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return NextResponse.json({ error: 'Development auth is disabled.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const upstreamSearch = new URLSearchParams(url.searchParams);
  const adminRequested = process.env.DEV_AUTH_ADMIN === 'true'
    || ['1', 'true', 'yes'].includes((upstreamSearch.get('admin') ?? '').toLowerCase());

  if (adminRequested && !upstreamSearch.has('admin')) {
    upstreamSearch.set('admin', '1');
  }

  const upstream = await fetch(`${PYTHON_API_URL}/auth/dev-login?${upstreamSearch.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json,text/html,*/*',
    },
    redirect: 'manual',
    cache: 'no-store',
  });

  const location = upstream.headers.get('location') ?? url.searchParams.get('next') ?? '/hall/';
  const response = NextResponse.redirect(new URL(location, url.origin), upstream.status || 302);
  const headers = filterHeaders(upstream.headers);

  const sessionCookie = parseSetCookieValue(headers.get('set-cookie'));
  if (sessionCookie?.name === LEGACY_SESSION_COOKIE) {
    response.cookies.set(LEGACY_SESSION_COOKIE, sessionCookie.value, {
      path: sessionCookie.path,
      httpOnly: sessionCookie.httpOnly,
      sameSite: sessionCookie.sameSite,
      secure: sessionCookie.secure,
      maxAge: sessionCookie.maxAge,
      expires: sessionCookie.expires,
    });
  }

  response.cookies.set(DEV_ADMIN_COOKIE, adminRequested ? '1' : '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: adminRequested ? undefined : new Date(0),
  });

  return response;
}
