import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

function getPublicOrigin(requestUrl: URL, forwardedHeaders: Headers) {
  const configuredOrigin = process.env.AUTH_URL?.trim() || process.env.PUBLIC_BASE_URL?.trim();
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
  const headerStore = await headers();
  const origin = getPublicOrigin(url, headerStore);
  const nextPath = url.searchParams.get('next') ?? '/hall/';
  const destination = new URL('/api/auth/signin/discord', origin);
  destination.searchParams.set('callbackUrl', new URL(nextPath, origin).toString());
  return NextResponse.redirect(destination);
}
