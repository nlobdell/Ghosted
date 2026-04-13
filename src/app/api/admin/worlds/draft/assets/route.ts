import { NextResponse } from 'next/server';
import {
  buildAdminWorldPayload,
  parseStageWorldLayerAssetRequest,
  stageWorldLayerAssetUpload,
} from '@/lib/server/scene-worlds';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const db = getDatabase();
  const parsed = await parseStageWorldLayerAssetRequest(request);
  const world = stageWorldLayerAssetUpload(
    db,
    actor,
    parsed.worldId,
    parsed.layerKey,
    parsed.asset,
  );

  return NextResponse.json({
    ok: true,
    message: `Draft ${parsed.layerKey} layer updated.`,
    world: world ?? buildAdminWorldPayload(db, actor),
  });
});
