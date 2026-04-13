import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { startRunelitePairing } from '@/lib/server/runelite-link';

export const runtime = 'nodejs';

function resolvePublicOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = process.env.AUTH_URL?.trim() || process.env.PUBLIC_BASE_URL?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    return `${forwardedProto ?? requestUrl.protocol.replace(/:$/, '')}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export const POST = withRouteErrorHandling(async (request: Request) => {
  const payload = await readJsonBody<{
    accountHash?: string | number;
    username?: string;
    launcherDisplayName?: string;
    pluginVersion?: string;
  }>(request);

  const result = startRunelitePairing(getDatabase(), {
    accountHash: payload.accountHash,
    username: payload.username,
    launcherDisplayName: payload.launcherDisplayName,
    pluginVersion: payload.pluginVersion,
    publicOrigin: resolvePublicOrigin(request),
  });

  if ('status' in result && result.status === 'already_linked') {
    return NextResponse.json(result);
  }

  return NextResponse.json(result, { status: 201 });
});
