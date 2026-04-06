import 'server-only';

import type { Database } from 'better-sqlite3';
import { AppError, clamp, envInt, envText, humanizeIdentifier, jsonLoad, parseIso, utcIso, utcNow } from '@/lib/server/core';

const DEFAULT_WOM_API_BASE = 'https://api.wiseoldman.net/v2';
const DEFAULT_WOM_CACHE_TTL_SECONDS = 900;
export const DEFAULT_WOM_PERIOD = 'week';
export const DEFAULT_WOM_HISCORE_METRIC = 'overall';

type GameAccountRow = {
  id: number;
  user_id: number;
  game: string;
  wom_player_id: number;
  username: string;
  display_name: string;
  status: string;
  is_primary: number;
  linked_at: string;
  updated_at: string;
};

type WomCacheRow = {
  cache_key: string;
  payload_json: string;
  fetched_at: string;
  expires_at: string;
};

export function womGroupId() {
  const value = envText('WOM_GROUP_ID');
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function womApiBase() {
  return (envText('WOM_API_BASE') ?? DEFAULT_WOM_API_BASE).replace(/\/+$/, '');
}

function womCacheTtlSeconds() {
  return Math.max(60, envInt('WOM_CACHE_TTL_SECONDS', DEFAULT_WOM_CACHE_TTL_SECONDS));
}

function womHeaders(extra?: HeadersInit) {
  return {
    Accept: 'application/json',
    'User-Agent': 'GhostedApp/0.1 (+https://ghosted.smirkhub.com)',
    ...extra,
  };
}

function womUrl(path: string, query?: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
      continue;
    }
    params.append(key, String(value));
  }
  const queryString = params.toString();
  return `${womApiBase()}/${path.replace(/^\/+/, '')}${queryString ? `?${queryString}` : ''}`;
}

function womCacheKey(path: string, query?: Record<string, unknown>) {
  const params = new URLSearchParams();
  const entries = Object.entries(query ?? {}).sort(([left], [right]) => left.localeCompare(right));
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
      continue;
    }
    params.append(key, String(value));
  }
  const queryString = params.toString();
  return `${path.replace(/^\/+/, '')}${queryString ? `?${queryString}` : ''}`;
}

export async function womRequestJson(
  path: string,
  options?: {
    method?: string;
    payload?: Record<string, unknown>;
    query?: Record<string, unknown>;
  },
) {
  const response = await fetch(womUrl(path, options?.query), {
    method: options?.method ?? 'GET',
    headers: womHeaders(options?.payload ? { 'Content-Type': 'application/json' } : undefined),
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(`Wise Old Man request failed: ${body || response.statusText || `HTTP ${response.status}`}`, 502);
  }

  return await response.json();
}

function getWomCacheEntry(db: Database, cacheKey: string) {
  return db
    .prepare('SELECT * FROM wom_cache WHERE cache_key = ?')
    .get(cacheKey) as WomCacheRow | undefined;
}

function setWomCacheEntry(db: Database, cacheKey: string, payload: unknown) {
  const fetchedAt = utcNow();
  const expiresAt = new Date(fetchedAt.getTime() + womCacheTtlSeconds() * 1000);
  db.prepare(`
    INSERT INTO wom_cache (cache_key, payload_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(
    cacheKey,
    JSON.stringify(payload),
    utcIso(fetchedAt),
    utcIso(expiresAt),
  );
}

export async function womCachedJson(
  db: Database,
  path: string,
  options?: {
    query?: Record<string, unknown>;
    forceRefresh?: boolean;
    allowStale?: boolean;
  },
) {
  const cacheKey = womCacheKey(path, options?.query);
  const cachedRow = options?.forceRefresh ? undefined : getWomCacheEntry(db, cacheKey);
  const cachedPayload = cachedRow ? jsonLoad(cachedRow.payload_json, null) : null;
  const expiresAt = cachedRow ? parseIso(cachedRow.expires_at) : null;

  if (cachedPayload && expiresAt && expiresAt >= utcNow()) {
    return cachedPayload;
  }

  try {
    const payload = await womRequestJson(path, { query: options?.query });
    setWomCacheEntry(db, cacheKey, payload);
    return payload;
  } catch (error) {
    if (cachedPayload && options?.allowStale !== false) {
      return cachedPayload;
    }
    throw error;
  }
}

export function invalidateWomCache(db: Database, prefix?: string) {
  const statement = prefix
    ? db.prepare('DELETE FROM wom_cache WHERE cache_key LIKE ?')
    : db.prepare('DELETE FROM wom_cache');
  const result = prefix ? statement.run(`${prefix}%`) : statement.run();
  return Number(result.changes ?? 0);
}

export function getUserGameAccount(db: Database, userId: number, game = 'osrs') {
  return db.prepare(`
    SELECT *
    FROM user_game_accounts
    WHERE user_id = ? AND game = ?
    ORDER BY is_primary DESC, id ASC
    LIMIT 1
  `).get(userId, game) as GameAccountRow | undefined;
}

export function countLinkedGameAccounts(db: Database, game = 'osrs') {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM user_game_accounts WHERE game = ? AND is_primary = 1')
    .get(game) as { count: number };
  return Number(row.count ?? 0);
}

function normalizeWomMembership(groupId: number | undefined, memberships: Array<Record<string, unknown>>) {
  if (groupId === undefined) return null;
  const target = String(groupId);

  for (const membership of memberships) {
    const group = (membership.group && typeof membership.group === 'object'
      ? membership.group
      : {}) as Record<string, unknown>;
    const membershipGroupId = membership.groupId ?? group.id;
    if (String(membershipGroupId) !== target) continue;

    const rawRole = membership.role;
    let roleName = '';
    let rankOrder: number | null = null;
    if (rawRole && typeof rawRole === 'object') {
      const role = rawRole as Record<string, unknown>;
      roleName = String(role.name ?? role.label ?? role.title ?? role.role ?? '').trim();
      const rawRankOrder = role.order ?? role.rankOrder ?? role.rank ?? role.id;
      const parsedRankOrder = Number.parseInt(String(rawRankOrder ?? ''), 10);
      rankOrder = Number.isFinite(parsedRankOrder) ? parsedRankOrder : null;
    } else if (rawRole !== undefined && rawRole !== null && rawRole !== '') {
      roleName = String(rawRole).trim();
    }

    const rawRankLabel = membership.rankLabel ?? membership.roleName ?? membership.title ?? membership.rank ?? roleName;
    const membershipRankLabel = humanizeIdentifier(rawRankLabel);
    if (rankOrder === null) {
      const parsedMembershipRank = Number.parseInt(String(membership.rankOrder ?? membership.rankId ?? ''), 10);
      rankOrder = Number.isFinite(parsedMembershipRank) ? parsedMembershipRank : null;
    }

    const groupName = String(group.name ?? group.groupName ?? 'Ghosted').trim() || 'Ghosted';
    const fallbackRole = humanizeIdentifier(roleName) || 'Member';

    return {
      groupId: Number(group.id ?? membershipGroupId ?? groupId),
      groupName,
      role: membershipRankLabel || fallbackRole,
      rankLabel: membershipRankLabel || fallbackRole,
      rankOrder: rankOrder ?? undefined,
      raw: membership,
    };
  }

  return null;
}

export async function womMembershipPayload(db: Database, account: GameAccountRow, forceRefresh = false) {
  const groupId = womGroupId();
  if (groupId === undefined) return null;

  const memberships = await womCachedJson(
    db,
    `/players/${encodeURIComponent(account.username)}/groups`,
    { forceRefresh },
  );

  return normalizeWomMembership(
    groupId,
    Array.isArray(memberships) ? memberships as Array<Record<string, unknown>> : [],
  );
}

export async function womLinkPayload(db: Database, userId: number) {
  const account = getUserGameAccount(db, userId, 'osrs');
  if (!account) {
    return {
      linked: false,
      playerId: null,
      username: null,
      displayName: null,
      inGroup: false,
      membership: null,
      lastSyncedAt: null,
      status: 'unlinked',
    };
  }

  let membership = null;
  if (womGroupId() !== undefined) {
    try {
      membership = await womMembershipPayload(db, account);
    } catch {
      membership = null;
    }
  }

  return {
    linked: true,
    playerId: Number(account.wom_player_id),
    username: account.username,
    displayName: account.display_name,
    inGroup: womGroupId() !== undefined ? Boolean(membership) : true,
    membership,
    lastSyncedAt: account.updated_at,
    status: account.status,
  };
}

function competitionStatus(startsAt?: string | null, endsAt?: string | null) {
  const current = utcNow();
  const starts = parseIso(startsAt);
  const ends = parseIso(endsAt);
  if (starts && current < starts) return 'upcoming';
  if (ends && current > ends) return 'finished';
  return 'ongoing';
}

function normalizeGroupHiscores(entries: Array<Record<string, unknown>>) {
  return entries.map((entry, index) => {
    const player = (entry.player && typeof entry.player === 'object' ? entry.player : {}) as Record<string, unknown>;
    const data = (entry.data && typeof entry.data === 'object' ? entry.data : {}) as Record<string, unknown>;
    return {
      rank: Number(data.rank ?? index + 1),
      player: {
        id: player.id as number | undefined,
        username: String(player.username ?? ''),
        displayName: String(player.displayName ?? player.username ?? ''),
      },
      value: data.experience ?? data.kills ?? data.score ?? data.value ?? 0,
      raw: data,
    };
  });
}

function normalizeCompetitionItem(entry: Record<string, unknown>) {
  return {
    id: Number(entry.id ?? 0),
    title: String(entry.title ?? ''),
    metric: String(entry.metric ?? ''),
    type: String(entry.type ?? ''),
    startsAt: entry.startsAt as string | undefined,
    endsAt: entry.endsAt as string | undefined,
    groupId: entry.groupId as number | undefined,
    score: entry.score as number | undefined,
    status: competitionStatus(entry.startsAt as string | undefined, entry.endsAt as string | undefined),
    participantCount: Array.isArray(entry.participants) ? entry.participants.length : 0,
    raw: entry,
  };
}

export async function womCompetitionsPayload(db: Database, limit = 12, forceRefresh = false) {
  const groupId = womGroupId();
  if (groupId === undefined) {
    throw new AppError('Wise Old Man integration is not configured yet.', 503);
  }

  const competitions = await womCachedJson(db, `/groups/${groupId}/competitions`, {
    query: { limit: clamp(limit, 1, 25) },
    forceRefresh,
  });

  return {
    competitions: Array.isArray(competitions)
      ? competitions
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map(normalizeCompetitionItem)
      : [],
  };
}

export async function womGroupHiscoresPayload(db: Database, metric = DEFAULT_WOM_HISCORE_METRIC, limit = 10, forceRefresh = false) {
  const groupId = womGroupId();
  if (groupId === undefined) {
    throw new AppError('Wise Old Man integration is not configured yet.', 503);
  }

  const entries = await womCachedJson(db, `/groups/${groupId}/hiscores`, {
    query: { metric: metric || DEFAULT_WOM_HISCORE_METRIC, limit: clamp(limit, 1, 50) },
    forceRefresh,
  });

  return {
    metric: metric || DEFAULT_WOM_HISCORE_METRIC,
    entries: Array.isArray(entries)
      ? normalizeGroupHiscores(entries.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')))
      : [],
  };
}

export async function hallClanSummaryPayload(db: Database, forceRefresh = false) {
  const groupId = womGroupId();
  if (groupId === undefined) {
    throw new AppError('Wise Old Man integration is not configured yet.', 503);
  }

  const group = await womCachedJson(db, `/groups/${groupId}`, { forceRefresh });
  const payload = group && typeof group === 'object' ? group as Record<string, unknown> : {};
  return {
    name: payload.name as string | undefined,
    memberCount: payload.memberCount as number | undefined,
  };
}
