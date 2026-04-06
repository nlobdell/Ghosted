import { NextResponse } from 'next/server';
import { buildSiteShell } from '@/lib/server/ghosted-api';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get('next') ?? '/';
  return NextResponse.json(await buildSiteShell(nextPath));
});
