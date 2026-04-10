import 'server-only';

import { NextResponse } from 'next/server';
import { buildRuntimeAuthConfig } from '@/lib/server/discord';
import { getDatabase } from '@/lib/server/database';
import { withRouteErrorHandling } from '@/lib/server/core';
import { womGroupId, womRequestJson } from '@/lib/server/wom';

export const runtime = 'nodejs';

type PresenceMember = {
  userId: number | null;
  username: string;
};

type PresencePayload = {
  members: PresenceMember[];
  source: 'voice' | 'wom' | 'empty';
};

const CACHE_TTL_MS = 60_000;
const MAX_MEMBERS = 15;

let payloadCache: { value: PresencePayload; expiresAt: number } | null = null;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchVoiceMembers(): Promise<PresenceMember[] | null> {
  const { guildId } = buildRuntimeAuthConfig();
  if (!guildId) return null;

  let data: Record<string, unknown>;
  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${guildId}/widget.json`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    data = await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }

  const rawMembers = Array.isArray(data.members)
    ? (data.members as Array<Record<string, unknown>>)
    : [];
  const rawChannels = Array.isArray(data.channels)
    ? (data.channels as Array<Record<string, unknown>>)
    : [];

  const voiceChannelIds = new Set(rawChannels.map((c) => String(c.id ?? '')));
  const voiceMembers = rawMembers.filter(
    (m) => m.channel_id && voiceChannelIds.has(String(m.channel_id)),
  );

  if (voiceMembers.length === 0) return null;

  const db = getDatabase();
  const results: PresenceMember[] = voiceMembers.map((m) => {
    const username = String(m.username ?? '').trim();
    const row = username
      ? (db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').get(username) as { id: number } | undefined)
      : undefined;
    return { userId: row?.id ?? null, username };
  });

  return shuffle(results).slice(0, MAX_MEMBERS);
}

async function fetchWomActiveMembers(): Promise<PresenceMember[]> {
  const groupId = womGroupId();
  if (!groupId) return [];

  let data: unknown;
  try {
    data = await womRequestJson(`/groups/${groupId}/gained`, {
      query: { metric: 'overall', period: 'day', limit: MAX_MEMBERS },
    });
  } catch {
    return [];
  }

  const entries: Array<Record<string, unknown>> = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : [];

  const db = getDatabase();
  const results: PresenceMember[] = [];

  for (const entry of entries) {
    const player = (entry.player ?? entry) as Record<string, unknown>;
    const username = String(player.displayName ?? player.username ?? '').trim();
    if (!username) continue;

    const row = db.prepare(
      `SELECT user_id FROM user_game_accounts
       WHERE game = 'osrs' AND LOWER(username) = LOWER(?) LIMIT 1`,
    ).get(username) as { user_id: number } | undefined;

    results.push({ userId: row?.user_id ?? null, username });
  }

  return shuffle(results).slice(0, MAX_MEMBERS);
}

async function buildPayload(): Promise<PresencePayload> {
  const voiceMembers = await fetchVoiceMembers();
  if (voiceMembers && voiceMembers.length > 0) {
    return { members: voiceMembers, source: 'voice' };
  }

  const womMembers = await fetchWomActiveMembers();
  if (womMembers.length > 0) {
    return { members: womMembers, source: 'wom' };
  }

  return { members: [], source: 'empty' };
}

export const GET = withRouteErrorHandling(async () => {
  const now = Date.now();
  if (payloadCache && payloadCache.expiresAt > now) {
    return NextResponse.json(payloadCache.value);
  }

  const payload = await buildPayload();
  payloadCache = { value: payload, expiresAt: now + CACHE_TTL_MS };
  return NextResponse.json(payload);
});
