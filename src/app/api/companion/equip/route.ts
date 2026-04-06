import { NextResponse } from 'next/server';
import { equipCompanionItem } from '@/lib/server/companion';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ slot?: string; slug?: string | null }>(request);
  const slot = String(payload.slot ?? '').trim();
  const slug = String(payload.slug ?? '').trim() || null;

  return NextResponse.json({
    ok: true,
    message: 'Companion updated.',
    companion: equipCompanionItem(getDatabase(), currentUser, slot, slug),
  });
});
