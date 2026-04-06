import { NextResponse } from 'next/server';
import { purchaseCompanionItem } from '@/lib/server/companion';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ slug?: string }>(request);
  const slug = String(payload.slug ?? '').trim();
  if (!slug) {
    throw new AppError('A companion item slug is required.', 400);
  }

  return NextResponse.json({
    ok: true,
    message: 'Companion cosmetic unlocked.',
    companion: purchaseCompanionItem(getDatabase(), currentUser, slug),
  }, { status: 201 });
});
