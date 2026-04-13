import { NextResponse } from 'next/server';
import { archiveWorldLayerAsset } from '@/lib/server/scene-worlds';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ worldId?: string; layerKey?: string }>(request);
  const worldId = String(payload.worldId ?? '').trim();
  const layerKey = String(payload.layerKey ?? '').trim();
  if (!worldId) {
    throw new AppError('A worldId is required.', 400);
  }
  if (!layerKey) {
    throw new AppError('A layerKey is required.', 400);
  }

  return NextResponse.json({
    ok: true,
    message: `Archived ${layerKey} draft override.`,
    world: archiveWorldLayerAsset(getDatabase(), actor, worldId as 'shared-commons', layerKey),
  });
});
