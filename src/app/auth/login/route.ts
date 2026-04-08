import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDiscordRedirectUri, isDiscordAuthConfigured } from '@/lib/auth/server-config';
import { normalizeLocalPath } from '@/lib/server/core';

function getPublicOrigin(requestUrl: URL, forwardedHeaders: Headers) {
  const configuredOrigin = process.env.AUTH_URL?.trim()
    || process.env.PUBLIC_BASE_URL?.trim()
    || getDiscordRedirectUri()?.origin;
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '');
  }

  const forwardedHost = forwardedHeaders.get('x-forwarded-host') ?? forwardedHeaders.get('host');
  const forwardedProto = forwardedHeaders.get('x-forwarded-proto');
  if (forwardedHost) {
    return `${forwardedProto ?? requestUrl.protocol.replace(/:$/, '')}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const devAuthEnabled = process.env.ENABLE_DEV_AUTH === 'true';
  const headerStore = await headers();
  const origin = getPublicOrigin(url, headerStore);
  const nextPath = normalizeLocalPath(url.searchParams.get('next') ?? '/hall/');

  if (devAuthEnabled) {
    const destination = new URL('/auth/dev-login', origin);
    destination.searchParams.set('next', nextPath);
    return NextResponse.redirect(destination);
  }

  if (!isDiscordAuthConfigured()) {
    return new NextResponse('Discord auth is not configured on this deployment.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const destination = new URL('/api/auth/signin', origin);
  destination.searchParams.set('callbackUrl', nextPath);
  return NextResponse.redirect(destination);
}
