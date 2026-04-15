import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { requireTwitchPlatformOperator } from '@/lib/server/twitch-platform';
import { buildGhostedTwitchPlatformState } from '@/lib/server/twitch-platform-runtime';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const operator = await requireTwitchPlatformOperator();
  return NextResponse.json(await buildGhostedTwitchPlatformState(operator));
});
