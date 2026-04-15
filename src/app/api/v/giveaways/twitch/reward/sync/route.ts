import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { syncLootChestReward } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  return NextResponse.json(await syncLootChestReward({
    title: typeof payload.title === 'string' ? payload.title : undefined,
    prompt: typeof payload.prompt === 'string' ? payload.prompt : undefined,
    cost: payload.cost === undefined ? undefined : Number(payload.cost),
  }));
});
