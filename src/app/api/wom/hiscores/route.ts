import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { DEFAULT_WOM_HISCORE_METRIC, womGroupHiscoresPayload } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const metric = url.searchParams.get('metric') ?? DEFAULT_WOM_HISCORE_METRIC;
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '10', 10) || 10;
  return NextResponse.json(await womGroupHiscoresPayload(getDatabase(), metric, limit));
});
