import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { womCompetitionsPayload } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12;
  return NextResponse.json(await womCompetitionsPayload(getDatabase(), limit));
});
