import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { adminSystemsPayload } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await adminSystemsPayload());
});
