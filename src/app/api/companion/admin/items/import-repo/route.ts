import { NextResponse } from 'next/server';
import { buildCompanionPayload, importRepoCompanionItems } from '@/lib/server/companion';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ items?: Array<Record<string, unknown>> }>(request);
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Repo Ghostling cosmetics imported.',
    library: importRepoCompanionItems(db, actor, Array.isArray(payload.items) ? payload.items : []),
    companion: buildCompanionPayload(db, actor),
  }, { status: 201 });
});
