import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { startLootChestTurn } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const turnId = Number.parseInt(id, 10);
  if (!Number.isFinite(turnId) || turnId <= 0) {
    throw new AppError('Turn ID is invalid.', 400);
  }
  return NextResponse.json({ ok: true, result: await startLootChestTurn(turnId) });
});
