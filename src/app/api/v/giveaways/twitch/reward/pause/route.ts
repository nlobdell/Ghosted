import { NextResponse } from 'next/server';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { pauseLootChestReward } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  if (typeof payload.paused !== 'boolean') {
    throw new AppError('A paused boolean is required.', 400);
  }
  return NextResponse.json(await pauseLootChestReward(payload.paused));
});
