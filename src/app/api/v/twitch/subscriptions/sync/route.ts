import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { syncGhostedTwitchPlatformSubscriptions } from '@/lib/server/twitch-platform-runtime';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async () => {
  return NextResponse.json(await syncGhostedTwitchPlatformSubscriptions());
});
