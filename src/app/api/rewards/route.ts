import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { buildRewardsPayload } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await buildRewardsPayload());
});
