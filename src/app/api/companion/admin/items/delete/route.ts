import { NextResponse } from 'next/server';
import { buildCompanionPayload, deleteCompanionItem } from '@/lib/server/companion';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{ slug?: string }>(request);
  const slug = String(payload.slug ?? '').trim();
  if (!slug) {
    throw new AppError('Choose a cosmetic slug to permanently delete.', 400);
  }
  const db = getDatabase();
  const result = deleteCompanionItem(db, actor, slug);

  return NextResponse.json({
    ok: true,
    message: result.warning
      ? `Companion cosmetic permanently deleted. Warning: ${result.warning}`
      : 'Companion cosmetic permanently deleted.',
    library: result.library,
    companion: buildCompanionPayload(db, actor),
  });
});
