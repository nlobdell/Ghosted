import { NextResponse } from 'next/server';
import { getCurrentUser, listGiveaways } from '@/lib/server/ghosted-api';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const currentUser = await getCurrentUser();
  return NextResponse.json({ giveaways: await listGiveaways(currentUser) });
});
