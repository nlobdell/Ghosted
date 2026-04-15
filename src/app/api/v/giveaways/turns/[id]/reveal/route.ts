import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { publishLootChestTurnActionRealtime, revealNextLootChest } from '@/lib/server/twitch-loot-chest';

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
  let chestIndex: unknown;
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawBody) as { chestIndex?: unknown };
      chestIndex = parsed.chestIndex;
    } catch {
      throw new AppError('Reveal request body is invalid JSON.', 400);
    }
  }

  const result = await revealNextLootChest(turnId, chestIndex);
  return NextResponse.json({ ok: true, result, scene: await publishLootChestTurnActionRealtime(result) });
});
