import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { runelitePairingStatus } from '@/lib/server/runelite-link';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const pollToken = url.searchParams.get('pollToken');
  if (!pollToken) {
    throw new AppError('pollToken is required.', 400);
  }

  return NextResponse.json(runelitePairingStatus(getDatabase(), pollToken));
});
