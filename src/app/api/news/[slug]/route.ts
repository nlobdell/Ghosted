import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { getNewsPostBySlug } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await context.params;
  const post = getNewsPostBySlug(slug);
  if (!post) {
    throw new AppError('News post not found.', 404);
  }
  return NextResponse.json({ post });
});
