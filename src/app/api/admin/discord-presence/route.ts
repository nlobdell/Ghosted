import { NextResponse } from 'next/server';
import { withRouteErrorHandling } from '@/lib/server/core';
import {
  discordPresenceAdminPayload,
  saveDiscordPresenceAllowlist,
} from '@/lib/server/ghosted-admin';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async () => {
  return NextResponse.json(await discordPresenceAdminPayload());
});

export const POST = withRouteErrorHandling(async (request: Request) => {
  return NextResponse.json(await saveDiscordPresenceAllowlist(request));
});
