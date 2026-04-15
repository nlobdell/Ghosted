import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { requireTwitchPlatformOperator } from '@/lib/server/twitch-platform';
import { beginGhostedTwitchPlatformConnect } from '@/lib/server/twitch-platform-runtime';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const operator = await requireTwitchPlatformOperator();
  const rawBody = await request.text();
  let payload: Record<string, unknown> = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new AppError('Request body must be valid JSON.', 400);
    }
  }
  const nextPath = typeof payload.next === 'string' ? payload.next : undefined;
  return NextResponse.json(await beginGhostedTwitchPlatformConnect(operator, nextPath), { status: 201 });
});
