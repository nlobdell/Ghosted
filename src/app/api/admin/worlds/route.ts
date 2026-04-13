import { NextResponse } from 'next/server';
import { buildAdminWorldPayload } from '@/lib/server/scene-worlds';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  const actor = await requireAdminUser();
  return NextResponse.json(buildAdminWorldPayload(getDatabase(), actor));
});
