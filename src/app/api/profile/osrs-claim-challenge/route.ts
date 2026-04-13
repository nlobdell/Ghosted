import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { createOsrsClaimChallenge } from '@/lib/server/osrs-claim';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  const challenge = await createOsrsClaimChallenge(getDatabase(), currentUser);
  return NextResponse.json({
    ok: true,
    message: 'OSRS claim challenge sent to your Discord DMs.',
    challenge,
  }, { status: 201 });
});
