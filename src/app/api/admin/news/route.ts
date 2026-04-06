import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { adminNewsPayload, createNewsPost } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12;
  return NextResponse.json(adminNewsPayload(limit));
});

export const POST = withRouteErrorHandling(async (request: Request) => {
  return NextResponse.json(await createNewsPost(request), { status: 201 });
});
