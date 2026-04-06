import { NextResponse } from 'next/server';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import { deleteNewsPost } from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const DELETE = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const postId = Number.parseInt(id, 10);
  if (!Number.isFinite(postId) || postId <= 0) {
    throw new AppError('News post ID is invalid.', 400);
  }
  return NextResponse.json(await deleteNewsPost(postId));
});
