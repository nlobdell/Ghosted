import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { womClanPayload } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await womClanPayload(getDatabase()));
});
