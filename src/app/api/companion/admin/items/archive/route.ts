import { NextResponse } from 'next/server';
import { archiveCompanionItem, buildCompanionPayload } from '@/lib/server/companion';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ slug?: string }>(request);
  const slug = String(payload.slug ?? '').trim();
  if (!slug) {
    throw new AppError('Choose a cosmetic slug to archive.', 400);
  }
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Companion cosmetic archived.',
    library: archiveCompanionItem(db, actor, slug),
    companion: buildCompanionPayload(db, actor),
  });
});
