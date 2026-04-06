import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { grantPoints } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  return NextResponse.json(await grantPoints(request));
});
