import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { womMePayload } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  return NextResponse.json(await womMePayload(getDatabase(), currentUser));
});
