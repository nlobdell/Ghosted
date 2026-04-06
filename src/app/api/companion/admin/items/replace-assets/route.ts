import { NextResponse } from 'next/server';
import { buildCompanionPayload, parseReplaceCompanionAssetsRequest, replaceCompanionItemAssets } from '@/lib/server/companion';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await parseReplaceCompanionAssetsRequest(request);
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Companion assets replaced.',
    library: replaceCompanionItemAssets(db, actor, payload.slug, payload),
    companion: buildCompanionPayload(db, actor),
  });
});
