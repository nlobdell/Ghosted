import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getTwitchPlatformFeatureBaseUrl } from '@/lib/server/twitch-platform';
import { completeTwitchConnect, isTwitchGameOperator, twitchGameLoginHref } from '@/lib/server/twitch-loot-chest';

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

function redirectWithMessage(request: Request, message: string) {
  const url = new URL('/v/giveaways/', redirectBaseUrl(request));
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
    return NextResponse.redirect(new URL(twitchGameLoginHref(callbackNextPath(request)), redirectBaseUrl(request)));
  }
  if (!isTwitchGameOperator(currentUser)) {
    return redirectWithMessage(request, 'This Twitch connection is not allowed for your Discord account.');
  }

  const url = new URL(request.url);
  const error = String(url.searchParams.get('error') ?? '').trim();
  const errorDescription = String(url.searchParams.get('error_description') ?? '').trim();
  if (error) {
    return redirectWithMessage(request, errorDescription || `Twitch connection failed: ${error}`);
  }

  try {
    await completeTwitchConnect({
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      actor: currentUser,
    });
    return redirectWithMessage(request, 'Twitch broadcaster connected.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Twitch connection failed.';
    return redirectWithMessage(request, message);
  }
}
