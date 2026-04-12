import 'server-only';

import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { buildScenePresencePayload, resetScenePresenceStateForTests } from '@/lib/server/scene-presence';

export const runtime = 'nodejs';

export function resetPresencePayloadCacheForTests() {
  resetScenePresenceStateForTests();
}

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await buildScenePresencePayload());
});
