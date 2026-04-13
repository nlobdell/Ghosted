import { NextResponse } from 'next/server';
import { publishWorldDraft } from '@/lib/server/scene-worlds';
import { withRouteErrorHandling, readJsonBody } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';
import { resetSharedHeroSceneSnapshot } from '@/lib/server/scene-shared-state';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ worldId?: string }>(request);
  const worldId = String(payload.worldId ?? '').trim();
  if (!worldId) {
    return NextResponse.json({ error: 'A worldId is required.' }, { status: 400 });
  }

  const db = getDatabase();
  const world = publishWorldDraft(
    db,
    actor,
    worldId as 'shared-commons',
    {
      onPublish: () => {
        resetSharedHeroSceneSnapshot(db);
      },
    },
  );

  return NextResponse.json({
    ok: true,
    message: 'Draft world published.',
    world,
  });
});
