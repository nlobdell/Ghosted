import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { createGiveaway } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  return NextResponse.json(await createGiveaway(request), { status: 201 });
});
