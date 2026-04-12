import { NextResponse } from 'next/server';
import {
  buildCompanionPreviewSummaryPayload,
  buildHouseCompanionPreviewSummaryPayload,
  getCompanionUserByRef,
} from '@/lib/server/companion';
import { withRouteErrorHandling, AppError } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const userRef = String(url.searchParams.get('user') ?? '').trim();
  const db = getDatabase();

  if (!userRef) {
    return NextResponse.json(buildHouseCompanionPreviewSummaryPayload(db));
  }

  const user = getCompanionUserByRef(db, userRef);
  if (!user) {
    throw new AppError('Companion owner not found.', 404);
  }

  return NextResponse.json(buildCompanionPreviewSummaryPayload(db, user));
});
