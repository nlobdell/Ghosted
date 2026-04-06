import { NextResponse } from 'next/server';
import { buildCompanionPayload, parseBaseUploadRequest, uploadCompanionBaseAsset } from '@/lib/server/companion';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const asset = await parseBaseUploadRequest(request);
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Companion base updated.',
    library: uploadCompanionBaseAsset(db, actor, asset),
    companion: buildCompanionPayload(db, actor),
  }, { status: 201 });
});
