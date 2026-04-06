import { NextResponse } from 'next/server';
import { casinoDailyWagerCap, listCasinoGames } from '@/lib/server/casino';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { getCurrentUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const currentUser = await getCurrentUser();
  return NextResponse.json({
    games: listCasinoGames(getDatabase(), currentUser?.id ?? null),
    dailyWagerCap: casinoDailyWagerCap(),
  });
});
