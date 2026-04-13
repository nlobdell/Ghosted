import { NextResponse } from 'next/server';
import { discardWorldDraft } from '@/lib/server/scene-worlds';
import { withRouteErrorHandling, readJsonBody } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ worldId?: string }>(request);
  const worldId = String(payload.worldId ?? '').trim();
  if (!worldId) {
    return NextResponse.json({ error: 'A worldId is required.' }, { status: 400 });
  }

  const world = discardWorldDraft(
    getDatabase(),
    actor,
    worldId as 'shared-commons',
  );

  return NextResponse.json({
    ok: true,
    message: 'Draft world discarded.',
    world,
  });
});
