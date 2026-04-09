import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getDatabase } from '@/lib/server/database';
import { renderRequestedCompanionSvg } from '@/lib/server/companion-render';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

function boolSearchParam(value: string | null) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const userRef = String(url.searchParams.get('user') ?? '').trim();
  const previewSlug = String(url.searchParams.get('preview') ?? '').trim();
  const baseOnly = boolSearchParam(url.searchParams.get('base'));
  const markup = renderRequestedCompanionSvg(getDatabase(), {
    animated: false,
    userRef,
    previewSlug,
    card: boolSearchParam(url.searchParams.get('card')),
    discord: boolSearchParam(url.searchParams.get('discord')),
    baseOnly,
    currentUser: userRef || baseOnly ? null : await getCurrentUser(),
  });

  return new Response(await markup, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
