import { NextResponse } from 'next/server';
import {
  parseReplaceWorldDraftPackageRequest,
  replaceWorldDraftPackage,
} from '@/lib/server/scene-worlds';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const db = getDatabase();
  const parsed = await parseReplaceWorldDraftPackageRequest(request);
  const world = replaceWorldDraftPackage(
    db,
    actor,
    parsed.worldId,
    parsed.packageText,
  );

  return NextResponse.json({
    ok: true,
    message: 'Draft world package replaced.',
    world,
  });
});
