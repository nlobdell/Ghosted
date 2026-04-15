import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { beginTwitchConnect, requireTwitchGameOperator } from '@/lib/server/twitch-loot-chest';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async () => {
  const operator = await requireTwitchGameOperator();
  return NextResponse.json(await beginTwitchConnect(operator), { status: 201 });
});
