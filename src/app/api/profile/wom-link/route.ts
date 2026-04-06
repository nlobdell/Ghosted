import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { linkWomAccount, unlinkWomAccount } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ username?: string }>(request);
  const result = await linkWomAccount(getDatabase(), currentUser, String(payload.username ?? ''));
  return NextResponse.json({ ok: true, message: 'WOM account linked.', result }, { status: 201 });
});

export const DELETE = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  const result = await unlinkWomAccount(getDatabase(), currentUser);
  return NextResponse.json({ ok: true, message: 'WOM account unlinked.', result });
});
