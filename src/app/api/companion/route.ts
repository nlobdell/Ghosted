import { NextResponse } from 'next/server';
import { buildCompanionPayload } from '@/lib/server/companion';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  return NextResponse.json(buildCompanionPayload(getDatabase(), currentUser));
});
