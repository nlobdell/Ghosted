import { NextResponse } from 'next/server';
import { readJsonBody, withRouteErrorHandling } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { requireCurrentUser } from '@/lib/server/ghosted-api';
import { normalizePublicNameSource, setUserPublicNameSource } from '@/lib/server/osrs-identity';
import { getUserGameAccount, womLinkPayload } from '@/lib/server/wom';
import { recordAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  const currentUser = await requireCurrentUser();
  const payload = await readJsonBody<{ source?: string }>(request);
  const nextSource = normalizePublicNameSource(payload.source);
  const db = getDatabase();

  if (nextSource === 'osrs' && !getUserGameAccount(db, currentUser.id, 'osrs')) {
    return NextResponse.json(
      { error: 'Link a Wise Old Man RuneScape account before using it as your public name.' },
      { status: 400 },
    );
  }

  setUserPublicNameSource(db, currentUser.id, nextSource);
  recordAudit(currentUser.id, 'set_public_name_source', 'user', String(currentUser.id), {
    source: nextSource,
  });

  return NextResponse.json({
    ok: true,
    message: 'Public name preference updated.',
    result: await womLinkPayload(db, currentUser.id),
  });
});

export const DELETE = withRouteErrorHandling(async () => {
  const currentUser = await requireCurrentUser();
  const db = getDatabase();
  setUserPublicNameSource(db, currentUser.id, 'discord');
  recordAudit(currentUser.id, 'set_public_name_source', 'user', String(currentUser.id), {
    source: 'discord',
  });

  return NextResponse.json({
    ok: true,
    message: 'Public name reverted to Discord.',
    result: await womLinkPayload(db, currentUser.id),
  });
});
