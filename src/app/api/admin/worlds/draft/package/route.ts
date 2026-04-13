import { NextResponse } from 'next/server';
import {
  parseReplaceWorldDraftPackageRequest,
  replaceWorldDraftPackage,
  replaceWorldDraftTuning,
} from '@/lib/server/scene-worlds';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const db = getDatabase();
  const parsed = await parseReplaceWorldDraftPackageRequest(request);
  let world = replaceWorldDraftPackage(
    db,
    actor,
    parsed.worldId,
    parsed.packageText,
  );
  let message = 'Draft world package replaced.';

  if (parsed.tuning) {
    world = replaceWorldDraftTuning(
      db,
      actor,
      parsed.worldId,
      parsed.tuning,
    );
    message = parsed.importedFrom === 'scene-lab-session'
      ? 'Scene editor session imported into draft world and tuning.'
      : 'Draft world package and tuning replaced.';
  }

  return NextResponse.json({
    ok: true,
    message,
    world,
  });
});
