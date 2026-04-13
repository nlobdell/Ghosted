import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { confirmRunelitePairing } from '@/lib/server/runelite-link';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ userCode?: string }>(request);
  const result = await confirmRunelitePairing(getDatabase(), currentUser, {
    userCode: payload.userCode,
  });
  return NextResponse.json(result);
});
