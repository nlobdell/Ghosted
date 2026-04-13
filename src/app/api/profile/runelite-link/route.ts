import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { deleteRuneliteLink, runeliteLinkPayload } from '@/lib/server/runelite-link';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  return NextResponse.json(runeliteLinkPayload(getDatabase(), currentUser.id));
});

export const DELETE = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  const link = deleteRuneliteLink(getDatabase(), currentUser);
  return NextResponse.json({
    ok: true,
    message: 'RuneLite account unlinked.',
    link,
  });
});
