import { NextResponse } from 'next/server';
import { listNewsPosts } from '@/lib/server/ghosted-api';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12;
  return NextResponse.json({ posts: listNewsPosts(false, limit) });
});
