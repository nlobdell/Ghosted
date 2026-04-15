import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { clearLootChestCache } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async () => {
  return NextResponse.json(await clearLootChestCache());
});
