import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { completeTwitchConnect, isTwitchGameOperator, twitchGameLoginHref } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

function redirectWithMessage(request: Request, message: string) {
  const url = new URL('/v/giveaways/', request.url);
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
    return NextResponse.redirect(new URL(twitchGameLoginHref(callbackNextPath(request)), request.url));
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
