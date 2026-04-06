import { NextResponse } from 'next/server';
import { buildCompanionPayload, createCompanionItem, parseCreateCompanionItemRequest } from '@/lib/server/companion';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const input = await parseCreateCompanionItemRequest(request);
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Custom companion cosmetic created.',
    library: createCompanionItem(db, actor, input),
    companion: buildCompanionPayload(db, actor),
  }, { status: 201 });
});
