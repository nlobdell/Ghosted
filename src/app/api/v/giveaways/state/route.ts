import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import {
  buildLootChestGameState,
  lootChestStateForOverlayToken,
  requireTwitchGameOperator,
} from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const overlayToken = String(url.searchParams.get('overlayToken') ?? '').trim();

  if (overlayToken) {
    return NextResponse.json(lootChestStateForOverlayToken(overlayToken));
  }

  const operator = await requireTwitchGameOperator();
  return NextResponse.json(await buildLootChestGameState(operator));
});
