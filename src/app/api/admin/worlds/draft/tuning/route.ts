import { NextResponse } from 'next/server';
import { loadGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { withRouteErrorHandling, AppError } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';
import { replaceWorldDraftTuning } from '@/lib/server/scene-worlds';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const body = await request.json().catch(() => null) as {
    worldId?: 'shared-commons';
    tuning?: unknown;
  } | null;

  const worldId = String(body?.worldId ?? '').trim();
  if (!worldId) {
    throw new AppError('A worldId is required.', 400);
  }

  if (!body?.tuning) {
    throw new AppError('A tuning payload is required.', 400);
  }

  const world = replaceWorldDraftTuning(
    getDatabase(),
    actor,
    worldId as 'shared-commons',
    loadGhostlingSceneTuningSpec(body.tuning),
  );

  return NextResponse.json({
    ok: true,
    message: 'Draft tuning updated.',
    world,
  });
});
