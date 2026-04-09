import { getCurrentUser } from '@/lib/server/ghosted-api';
import { renderRequestedDiscordCompanionGif } from '@/lib/server/companion-render';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';

export const runtime = 'nodejs';

function boolSearchParam(value: string | null) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

export const GET = withRouteErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const userRef = String(url.searchParams.get('user') ?? '').trim();
  const previewSlug = String(url.searchParams.get('preview') ?? '').trim();
  const baseOnly = boolSearchParam(url.searchParams.get('base'));
  const payload = await renderRequestedDiscordCompanionGif(getDatabase(), {
    userRef,
    previewSlug,
    baseOnly,
    currentUser: userRef || baseOnly ? null : await getCurrentUser(),
  });

  return new Response(payload, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
    },
  });
});
