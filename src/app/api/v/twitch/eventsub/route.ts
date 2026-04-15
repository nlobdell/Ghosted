import { withRouteErrorHandling } from '@/lib/server/core';
import { handleGhostedTwitchPlatformWebhook } from '@/lib/server/twitch-platform-runtime';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  return handleGhostedTwitchPlatformWebhook(request);
});
