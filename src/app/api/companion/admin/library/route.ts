import { NextResponse } from 'next/server';
import { buildCompanionAdminPayload } from '@/lib/server/companion';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  await requireAdminUser();
  return NextResponse.json(buildCompanionAdminPayload(getDatabase()));
});
