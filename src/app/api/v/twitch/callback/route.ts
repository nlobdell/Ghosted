import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import {
  getTwitchPlatformFeatureBaseUrl,
  isTwitchPlatformOperator,
  twitchPlatformLoginHref,
} from '@/lib/server/twitch-platform';
import { completeGhostedTwitchPlatformConnect } from '@/lib/server/twitch-platform-runtime';

export const runtime = 'nodejs';

function redirectBaseUrl(request: Request) {
  const configuredBaseUrl = getTwitchPlatformFeatureBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    return `${forwardedProto ?? requestUrl.protocol.replace(/:$/, '')}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

function redirectWithMessage(request: Request, nextPath: string, message: string) {
  const url = new URL(nextPath, redirectBaseUrl(request));
  url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

function callbackNextPath(request: Request) {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.redirect(new URL(twitchPlatformLoginHref(callbackNextPath(request)), redirectBaseUrl(request)));
  }
  if (!isTwitchPlatformOperator(currentUser)) {
    return redirectWithMessage(request, '/v?tab=setup', 'This Twitch connection is not allowed for your Discord account.');
  }

  const url = new URL(request.url);
  const error = String(url.searchParams.get('error') ?? '').trim();
  const errorDescription = String(url.searchParams.get('error_description') ?? '').trim();
  if (error) {
    return redirectWithMessage(request, '/v?tab=setup', errorDescription || `Twitch connection failed: ${error}`);
  }

  try {
    const result = await completeGhostedTwitchPlatformConnect({
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      actor: currentUser,
    });
    return redirectWithMessage(request, result.nextPath, 'Twitch broadcaster connected.');
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Twitch connection failed.';
    return redirectWithMessage(request, '/v?tab=setup', message);
  }
}
