import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { adminContentPayload } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await adminContentPayload());
});
