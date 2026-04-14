import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getDatabase } from '@/lib/server/database';
import { renderRequestedCompanionSvg } from '@/lib/server/companion-render';
import { withRouteErrorHandling } from '@/lib/server/core';
import sharp from 'sharp';

export const runtime = 'nodejs';

function boolSearchParam(value: string | null) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const userRef = String(url.searchParams.get('user') ?? '').trim();
  const previewSlug = String(url.searchParams.get('preview') ?? '').trim();
  const baseOnly = boolSearchParam(url.searchParams.get('base'));
  const responseFormat = String(url.searchParams.get('format') ?? '').trim().toLowerCase();
  const markup = renderRequestedCompanionSvg(getDatabase(), {
    animated: false,
    userRef,
    previewSlug,
    card: boolSearchParam(url.searchParams.get('card')),
    discord: boolSearchParam(url.searchParams.get('discord')),
    baseOnly,
    currentUser: userRef || baseOnly ? null : await getCurrentUser(),
  });

  if (responseFormat === 'png') {
    const png = await sharp(Buffer.from(await markup)).png().toBuffer();
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(await markup, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
