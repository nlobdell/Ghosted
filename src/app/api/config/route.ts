import { NextResponse } from 'next/server';
import { buildConfigPayload } from '@/lib/server/ghosted-api';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(buildConfigPayload());
});
