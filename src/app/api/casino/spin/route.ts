import { NextResponse } from 'next/server';
import { spinCasinoGame } from '@/lib/server/casino';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ gameSlug?: string }>(request);
  const result = spinCasinoGame(getDatabase(), currentUser.id, String(payload.gameSlug ?? ''));
  return NextResponse.json({ ok: true, result });
});
