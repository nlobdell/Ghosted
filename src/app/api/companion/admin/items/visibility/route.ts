import { NextResponse } from 'next/server';
import { buildCompanionPayload, setCompanionItemActive } from '@/lib/server/companion';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ slug?: string; active?: boolean }>(request);
  const slug = String(payload.slug ?? '').trim();
  if (!slug) {
    throw new AppError('Choose a cosmetic slug to hide or show.', 400);
  }
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Companion visibility updated.',
    library: setCompanionItemActive(db, actor, slug, Boolean(payload.active)),
    companion: buildCompanionPayload(db, actor),
  });
});
