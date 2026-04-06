import { NextResponse } from 'next/server';
import { createLegacySession, upsertLegacyDevUser } from '@/lib/auth/legacy-user';
import { envFlag } from '@/lib/server/core';

const DEV_ADMIN_COOKIE = 'ghosted_dev_admin';
const LEGACY_SESSION_COOKIE = 'ghosted_session';

export const runtime = 'nodejs';

function titleCase(value: string) {
  return value.replace(/(^|[^A-Za-z0-9]+)([A-Za-z])/g, (match, prefix: string, letter: string) => (
    `${prefix}${letter.toUpperCase()}`
  ));
}

function boolSearchParam(value: string | null) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

export async function GET(request: Request) {
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return NextResponse.json({ error: 'Development auth is disabled.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const username = String(url.searchParams.get('name') ?? 'ghosted-dev').trim() || 'ghosted-dev';
  const discordId = String(url.searchParams.get('discordId') ?? 'dev-user-1').trim() || 'dev-user-1';
  const roles = url.searchParams.getAll('role').map((role) => role.trim()).filter(Boolean);
  const adminRequested = envFlag('DEV_AUTH_ADMIN', false) || boolSearchParam(url.searchParams.get('admin'));
  const user = upsertLegacyDevUser({
    discordId,
    username,
    globalName: titleCase(username),
    roles,
    adminRequested,
  });
  const session = createLegacySession(user.id);
  const destination = url.searchParams.get('next') ?? '/hall/';

  const response = NextResponse.redirect(new URL(destination, url.origin), 302);
  response.cookies.set(LEGACY_SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: session.secure,
    maxAge: session.maxAge,
    expires: session.expiresAt,
  });
  response.cookies.set(DEV_ADMIN_COOKIE, adminRequested ? '1' : '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: adminRequested ? undefined : new Date(0),
  });
  return response;
}
