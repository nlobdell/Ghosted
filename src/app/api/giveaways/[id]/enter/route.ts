import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { enterGiveaway } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const giveawayId = Number.parseInt(id, 10);
  if (!Number.isFinite(giveawayId) || giveawayId <= 0) {
    throw new AppError('Giveaway ID is invalid.', 400);
  }
  return NextResponse.json({ ok: true, result: await enterGiveaway(giveawayId) }, { status: 201 });
});
