import { NextResponse } from 'next/server';
import { buildCompanionPayload, updateCompanionItem } from '@/lib/server/companion';
import { AppError, readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireAdminUser } from '@/lib/server/ghosted-api';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<{
    slug?: string;
    name?: string;
    nextSlug?: string | null;
    rarity?: string;
    cost?: number;
    description?: string;
    metadataJson?: string | null;
  }>(request);
  const slug = String(payload.slug ?? '').trim();
  if (!slug) {
    throw new AppError('Choose a cosmetic slug to edit.', 400);
  }
  const db = getDatabase();

  return NextResponse.json({
    ok: true,
    message: 'Companion cosmetic updated.',
    library: updateCompanionItem(db, actor, slug, {
      name: String(payload.name ?? '').trim(),
      slug: String(payload.nextSlug ?? '').trim() || null,
      rarity: String(payload.rarity ?? '').trim(),
      cost: Number(payload.cost ?? 0),
      description: String(payload.description ?? '').trim(),
      metadataJson: payload.metadataJson == null ? null : String(payload.metadataJson),
    }),
    companion: buildCompanionPayload(db, actor),
  });
});
