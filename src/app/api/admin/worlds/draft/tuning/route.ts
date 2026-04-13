import { NextResponse } from 'next/server';
import { loadGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { withRouteErrorHandling, AppError, readJsonBody } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';
import { replaceWorldDraftTuning } from '@/lib/server/scene-worlds';

export const runtime = 'nodejs';

function parseDraftTuningPayload(value: unknown) {
  try {
    return loadGhostlingSceneTuningSpec(value);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Ghostling scene tuning was invalid.',
      400,
    );
  }
}

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const body = await readJsonBody<{
    worldId?: 'shared-commons';
    tuning?: unknown;
    tuningText?: string;
  }>(request);

  const worldId = String(body.worldId ?? '').trim();
  if (!worldId) {
    throw new AppError('A worldId is required.', 400);
  }

  const rawTuningText = typeof body.tuningText === 'string'
    ? body.tuningText.trim()
    : '';
  if (!body.tuning && !rawTuningText) {
    throw new AppError('A tuning payload is required.', 400);
  }

  let parsedTuning = body.tuning;
  if (rawTuningText) {
    try {
      parsedTuning = JSON.parse(rawTuningText) as unknown;
    } catch {
      throw new AppError('Movement tuning must be valid JSON.', 400);
    }
  }

  const world = replaceWorldDraftTuning(
    getDatabase(),
    actor,
    worldId as 'shared-commons',
    parseDraftTuningPayload(parsedTuning),
  );

  return NextResponse.json({
    ok: true,
    message: 'Draft tuning updated.',
    world,
  });
});
