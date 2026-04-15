import { NextResponse } from 'next/server';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { buildLootChestSceneSnapshot, selectLootChestTurnChests } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const turnId = Number.parseInt(id, 10);
  if (!Number.isFinite(turnId) || turnId <= 0) {
    throw new AppError('Turn ID is invalid.', 400);
  }

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const result = await selectLootChestTurnChests(turnId, payload.chests);
  return NextResponse.json({
    ok: true,
    result,
    scene: buildLootChestSceneSnapshot(),
  });
});
