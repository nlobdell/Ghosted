import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { womCompetitionDetailPayload } from '@/lib/server/wom';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const competitionId = Number.parseInt(id, 10);
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new AppError('Competition ID is invalid.', 400);
  }

  return NextResponse.json(await womCompetitionDetailPayload(getDatabase(), competitionId));
});
