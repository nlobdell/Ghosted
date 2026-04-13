import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { redeemOsrsClaimChallenge } from '@/lib/server/osrs-claim';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const payload = await readJsonBody<{ code?: string; username?: string }>(request);
  const result = await redeemOsrsClaimChallenge(getDatabase(), {
    code: String(payload.code ?? ''),
    username: String(payload.username ?? ''),
  });

  return NextResponse.json({
    ok: true,
    message: 'OSRS claim verified.',
    result,
  });
});
