import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { publishLootChestOperatorPresentation } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const cue = await publishLootChestOperatorPresentation({
    turnId: payload.turnId,
    chestIndex: payload.chestIndex,
    selectedChests: payload.selectedChests,
  });

  return NextResponse.json({
    ok: true,
    cue,
  });
});
