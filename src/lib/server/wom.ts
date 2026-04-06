import 'server-only';

import type { Database } from 'better-sqlite3';
import { recordAudit } from '@/lib/server/audit';
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

type CurrentUserLike = {
  id: number;
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArrayOfRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    : [];
}

function playerSummary(player: unknown) {
  const payload = asRecord(player);
  return {
    id: typeof payload.id === 'number' ? payload.id : undefined,
    username: String(payload.username ?? ''),
    displayName: String(payload.displayName ?? payload.username ?? ''),
  };
}

function requireWomGroupId() {
  const groupId = womGroupId();
  if (groupId === undefined) {
    throw new AppError('Wise Old Man integration is not configured yet.', 503);
  }
  return groupId;
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
      for (const item of value) {
        params.append(key, String(item));
      }
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
      for (const item of value) {
        params.append(key, String(item));
      }
      continue;
    }
    params.append(key, String(value));
  }

  const queryString = params.toString();
  return `${path.replace(/^\/+/, '')}${queryString ? `?${queryString}` : ''}`;
}

export function womGroupId() {
  const value = envText('WOM_GROUP_ID');
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  return db.prepare('SELECT * FROM wom_cache WHERE cache_key = ?').get(cacheKey) as WomCacheRow | undefined;
}

export function setWomCacheEntry(db: Database, cacheKey: string, payload: unknown) {
  const fetchedAt = utcNow();
  const expiresAt = new Date(fetchedAt.getTime() + womCacheTtlSeconds() * 1000);

  db.prepare(`
    INSERT INTO wom_cache (cache_key, payload_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(cacheKey, JSON.stringify(payload), utcIso(fetchedAt), utcIso(expiresAt));
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

export function saveUserGameAccount(
  db: Database,
  userId: number,
  game: string,
  player: Record<string, unknown>,
) {
  const existing = getUserGameAccount(db, userId, game);
  const now = utcIso();

  try {
    db.prepare(`
      INSERT INTO user_game_accounts (
        user_id, game, wom_player_id, username, display_name, status, is_primary, linked_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, game) DO UPDATE SET
        wom_player_id = excluded.wom_player_id,
        username = excluded.username,
        display_name = excluded.display_name,
        status = excluded.status,
        is_primary = 1,
        updated_at = excluded.updated_at
    `).run(
      userId,
      game,
      Number(player.id),
      String(player.username ?? '').trim(),
      String(player.displayName ?? player.username ?? '').trim(),
      String(player.status ?? 'unknown').trim() || 'unknown',
      existing?.linked_at ?? now,
      now,
    );
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code.startsWith('SQLITE_CONSTRAINT')) {
      throw new AppError('That Wise Old Man account is already linked to another Ghosted user.', 409);
    }
    throw error;
  }

  return getUserGameAccount(db, userId, game)!;
}

export function deleteUserGameAccount(db: Database, userId: number, game = 'osrs') {
  db.prepare('DELETE FROM user_game_accounts WHERE user_id = ? AND game = ?').run(userId, game);
}

function playerInGroup(groupId: number, memberships: Array<Record<string, unknown>>) {
  const target = String(groupId);
  return memberships.some((membership) => {
    const group = asRecord(membership.group);
    return String(membership.groupId ?? '') === target || String(group.id ?? '') === target;
  });
}

function averageSkill(statistics: Record<string, unknown>, metric: string) {
  return asRecord(asRecord(asRecord(asRecord(statistics.averageStats).data).skills)[metric]);
}

function averageComputed(statistics: Record<string, unknown>, metric: string) {
  return asRecord(asRecord(asRecord(asRecord(statistics.averageStats).data).computed)[metric]);
}

function groupLinkCoverage(db: Database, group?: Record<string, unknown>) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  const linkedUsers = countLinkedGameAccounts(db, 'osrs');
  const trackedUsers = Number(row.count ?? 0);
  const groupMemberCount = Number(group?.memberCount ?? 0);

  return {
    trackedUsers,
    linkedUsers,
    unlinkedUsers: Math.max(0, trackedUsers - linkedUsers),
    groupMemberCount,
  };
}

function normalizeWomMembership(groupId: number | undefined, memberships: Array<Record<string, unknown>>) {
  if (groupId === undefined) return null;
  const target = String(groupId);

  for (const membership of memberships) {
    const group = asRecord(membership.group);
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

function normalizeGroupHiscores(entries: Array<Record<string, unknown>>) {
  return entries.map((entry, index) => {
    const player = asRecord(entry.player);
    const data = asRecord(entry.data);
    return {
      rank: Number(data.rank ?? index + 1),
      player: {
        id: typeof player.id === 'number' ? player.id : undefined,
        username: String(player.username ?? ''),
        displayName: String(player.displayName ?? player.username ?? ''),
      },
      value: data.experience ?? data.kills ?? data.score ?? data.value ?? 0,
      raw: data,
    };
  });
}

function normalizeGroupGains(entries: Array<Record<string, unknown>>) {
  return entries.map((entry, index) => {
    const player = asRecord(entry.player);
    const data = asRecord(entry.data);
    return {
      rank: index + 1,
      player: {
        id: typeof player.id === 'number' ? player.id : undefined,
        username: String(player.username ?? ''),
        displayName: String(player.displayName ?? player.username ?? ''),
      },
      gained: data.gained ?? entry.gained ?? 0,
      raw: entry,
    };
  });
}

function normalizeGroupMemberships(group: Record<string, unknown>) {
  const memberships = Array.isArray(group.memberships) ? group.memberships : [];
  const normalized = memberships.flatMap((membership) => {
    if (!membership || typeof membership !== 'object') return [];

    const payload = membership as Record<string, unknown>;
    const player = asRecord(payload.player);
    const rawRole = payload.rankLabel ?? payload.roleName ?? payload.title ?? payload.rank ?? payload.role;
    const rankLabel = humanizeIdentifier(rawRole) || 'Member';
    const roleKey = String(payload.role ?? '').trim().toLowerCase() || null;
    const rawRankOrder = payload.rankOrder ?? payload.rankId;
    const parsedRankOrder = Number.parseInt(String(rawRankOrder ?? ''), 10);
    const rankOrder = Number.isFinite(parsedRankOrder) ? parsedRankOrder : null;

    return [{
      player: {
        id: typeof player.id === 'number' ? player.id : undefined,
        username: String(player.username ?? ''),
        displayName: String(player.displayName ?? player.username ?? ''),
        type: typeof player.type === 'string' ? player.type : undefined,
        build: typeof player.build === 'string' ? player.build : undefined,
        status: typeof player.status === 'string' ? player.status : undefined,
      },
      value: player.exp ?? 0,
      roleKey,
      role: rankLabel,
      rankLabel,
      rankOrder: rankOrder ?? undefined,
      joinedAt: typeof payload.createdAt === 'string' ? payload.createdAt : undefined,
      updatedAt: typeof (payload.updatedAt ?? player.updatedAt) === 'string' ? String(payload.updatedAt ?? player.updatedAt) : undefined,
      raw: payload,
    }];
  });

  normalized.sort((left, right) => {
    const leftRank = left.rankOrder ?? 9999;
    const rightRank = right.rankOrder ?? 9999;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftValue = Number(left.value ?? 0);
    const rightValue = Number(right.value ?? 0);
    if (leftValue !== rightValue) return rightValue - leftValue;

    const leftName = String(left.player.displayName || left.player.username || '').toLowerCase();
    const rightName = String(right.player.displayName || right.player.username || '').toLowerCase();
    return leftName.localeCompare(rightName);
  });

  return normalized.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function normalizeGroupActivity(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => ({
    type: entry.type,
    role: entry.role,
    createdAt: entry.createdAt,
    player: playerSummary(entry.player),
  }));
}

function normalizeAchievements(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => ({
    name: entry.name,
    metric: entry.metric,
    measure: entry.measure,
    threshold: entry.threshold,
    createdAt: entry.createdAt,
    player: playerSummary(entry.player),
  }));
}

export function competitionStatus(startsAt?: string | null, endsAt?: string | null, now = utcNow()) {
  const starts = parseIso(startsAt);
  const ends = parseIso(endsAt);
  if (starts && now < starts) return 'upcoming';
  if (ends && now > ends) return 'finished';
  return 'ongoing';
}

function normalizeCompetitionItem(entry: Record<string, unknown>) {
  return {
    id: Number(entry.id ?? 0),
    title: String(entry.title ?? ''),
    metric: String(entry.metric ?? ''),
    type: String(entry.type ?? ''),
    startsAt: typeof entry.startsAt === 'string' ? entry.startsAt : undefined,
    endsAt: typeof entry.endsAt === 'string' ? entry.endsAt : undefined,
    groupId: typeof entry.groupId === 'number' ? entry.groupId : undefined,
    score: typeof entry.score === 'number' ? entry.score : undefined,
    status: competitionStatus(
      typeof entry.startsAt === 'string' ? entry.startsAt : undefined,
      typeof entry.endsAt === 'string' ? entry.endsAt : undefined,
    ),
    participantCount: Array.isArray(entry.participants) ? entry.participants.length : 0,
    raw: entry,
  };
}

function normalizeCompetitionParticipants(entries: Array<Record<string, unknown>>) {
  return entries.map((entry, index) => {
    const player = asRecord(entry.player);
    const progress = asRecord(entry.progress);
    return {
      rank: Number(entry.rank ?? index + 1),
      player: playerSummary(player),
      progress: {
        start: progress.start,
        end: progress.end,
        gained: progress.gained ?? entry.gained ?? 0,
      },
      updatedAt: entry.updatedAt ?? player.updatedAt,
      raw: entry,
    };
  });
}

function normalizeCompetitionHistory(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => ({
    player: playerSummary(entry.player),
    history: Array.isArray(entry.history) ? entry.history : [],
  }));
}

export async function womMembershipPayload(db: Database, account: GameAccountRow, forceRefresh = false) {
  const groupId = womGroupId();
  if (groupId === undefined) return null;

  const memberships = await womCachedJson(
    db,
    `/players/${encodeURIComponent(account.username)}/groups`,
    { forceRefresh },
  );

  return normalizeWomMembership(groupId, asArrayOfRecords(memberships));
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

export async function linkWomAccount(db: Database, user: CurrentUserLike, username: string) {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername) {
    throw new AppError('Runescape username is required.', 400);
  }

  const groupId = requireWomGroupId();
  const player = asRecord(await womRequestJson(`/players/${encodeURIComponent(normalizedUsername)}`, { method: 'POST' }));
  const memberships = asArrayOfRecords(await womCachedJson(db, `/players/${encodeURIComponent(String(player.username ?? ''))}/groups`));

  if (!playerInGroup(groupId, memberships)) {
    throw new AppError('That Wise Old Man player is not in the configured Ghosted group.', 400);
  }

  const account = saveUserGameAccount(db, user.id, 'osrs', player);
  recordAudit(user.id, 'link_wom_account', 'user_game_account', String(account.id), {
    game: 'osrs',
    womPlayerId: Number(account.wom_player_id),
    username: account.username,
  });

  return womLinkPayload(db, user.id);
}

export async function unlinkWomAccount(db: Database, user: CurrentUserLike) {
  const account = getUserGameAccount(db, user.id, 'osrs');
  if (account) {
    deleteUserGameAccount(db, user.id, 'osrs');
    recordAudit(user.id, 'unlink_wom_account', 'user_game_account', String(account.id), {
      game: 'osrs',
      womPlayerId: Number(account.wom_player_id),
    });
  }

  return womLinkPayload(db, user.id);
}

export async function hallClanSummaryPayload(db: Database, forceRefresh = false) {
  const groupId = requireWomGroupId();
  const group = asRecord(await womCachedJson(db, `/groups/${groupId}`, { forceRefresh }));

  return {
    name: typeof group.name === 'string' ? group.name : undefined,
    memberCount: typeof group.memberCount === 'number' ? group.memberCount : undefined,
  };
}

export async function womClanPayload(db: Database, forceRefresh = false) {
  const groupId = requireWomGroupId();
  const [groupValue, statisticsValue, achievementsValue, activityValue, hiscoresValue, gainsValue] = await Promise.all([
    womCachedJson(db, `/groups/${groupId}`, { forceRefresh }),
    womCachedJson(db, `/groups/${groupId}/statistics`, { forceRefresh }),
    womCachedJson(db, `/groups/${groupId}/achievements`, {
      query: { limit: 6 },
      forceRefresh,
    }),
    womCachedJson(db, `/groups/${groupId}/activity`, {
      query: { limit: 8 },
      forceRefresh,
    }),
    womCachedJson(db, `/groups/${groupId}/hiscores`, {
      query: { metric: DEFAULT_WOM_HISCORE_METRIC, limit: 5 },
      forceRefresh,
    }),
    womCachedJson(db, `/groups/${groupId}/gained`, {
      query: { metric: DEFAULT_WOM_HISCORE_METRIC, period: DEFAULT_WOM_PERIOD, limit: 5 },
      forceRefresh,
    }),
  ]);

  const group = asRecord(groupValue);
  const statistics = asRecord(statisticsValue);

  return {
    group: {
      id: group.id,
      name: group.name,
      clanChat: group.clanChat,
      description: group.description,
      homeworld: group.homeworld,
      memberCount: group.memberCount,
      score: group.score,
      verified: group.verified,
      updatedAt: group.updatedAt,
    },
    statistics: {
      maxedCombatCount: Number(statistics.maxedCombatCount ?? 0),
      maxedTotalCount: Number(statistics.maxedTotalCount ?? 0),
      maxed200msCount: Number(statistics.maxed200msCount ?? 0),
      averageOverallLevel: averageSkill(statistics, 'overall').level,
      averageOverallExperience: averageSkill(statistics, 'overall').experience,
      averageEhp: averageComputed(statistics, 'ehp').value,
      averageEhb: averageComputed(statistics, 'ehb').value,
      raw: statistics,
    },
    linkCoverage: groupLinkCoverage(db, group),
    featuredHiscores: {
      metric: DEFAULT_WOM_HISCORE_METRIC,
      entries: normalizeGroupHiscores(asArrayOfRecords(hiscoresValue)),
    },
    featuredGains: {
      metric: DEFAULT_WOM_HISCORE_METRIC,
      period: DEFAULT_WOM_PERIOD,
      entries: normalizeGroupGains(asArrayOfRecords(gainsValue)),
    },
    recentAchievements: normalizeAchievements(asArrayOfRecords(achievementsValue)),
    recentActivity: normalizeGroupActivity(asArrayOfRecords(activityValue)),
  };
}

export async function womGroupRosterPayload(db: Database, forceRefresh = false) {
  const groupId = requireWomGroupId();
  const group = asRecord(await womCachedJson(db, `/groups/${groupId}`, { forceRefresh }));
  const entries = normalizeGroupMemberships(group);

  return {
    group: {
      id: group.id,
      name: group.name,
      clanChat: group.clanChat,
      description: group.description,
      homeworld: group.homeworld,
      memberCount: group.memberCount ?? entries.length,
      score: group.score,
      verified: group.verified,
      updatedAt: group.updatedAt,
    },
    entries,
  };
}

export async function womGroupHiscoresPayload(
  db: Database,
  metric = DEFAULT_WOM_HISCORE_METRIC,
  limit = 10,
  forceRefresh = false,
) {
  const groupId = requireWomGroupId();
  const entries = await womCachedJson(db, `/groups/${groupId}/hiscores`, {
    query: { metric: metric || DEFAULT_WOM_HISCORE_METRIC, limit: clamp(limit, 1, 50) },
    forceRefresh,
  });

  return {
    metric: metric || DEFAULT_WOM_HISCORE_METRIC,
    entries: normalizeGroupHiscores(asArrayOfRecords(entries)),
  };
}

export async function womGroupGainsPayload(
  db: Database,
  metric = DEFAULT_WOM_HISCORE_METRIC,
  period = DEFAULT_WOM_PERIOD,
  limit = 10,
  forceRefresh = false,
) {
  const groupId = requireWomGroupId();
  const entries = await womCachedJson(db, `/groups/${groupId}/gained`, {
    query: { metric: metric || DEFAULT_WOM_HISCORE_METRIC, period: period || DEFAULT_WOM_PERIOD, limit: clamp(limit, 1, 50) },
    forceRefresh,
  });

  return {
    metric: metric || DEFAULT_WOM_HISCORE_METRIC,
    period: period || DEFAULT_WOM_PERIOD,
    entries: normalizeGroupGains(asArrayOfRecords(entries)),
  };
}

export async function womMePayload(db: Database, user: CurrentUserLike, forceRefresh = false) {
  const existingAccount = getUserGameAccount(db, user.id, 'osrs');
  if (!existingAccount) {
    throw new AppError('Link a Wise Old Man RuneScape account first.', 404);
  }

  const player = asRecord(await womCachedJson(db, `/players/id/${Number(existingAccount.wom_player_id)}`, { forceRefresh }));
  const username = String(player.username ?? existingAccount.username);
  const account = saveUserGameAccount(db, user.id, 'osrs', player);

  const [gains, achievements, standings, membership] = await Promise.all([
    womCachedJson(db, `/players/${encodeURIComponent(username)}/gained`, {
      query: { period: DEFAULT_WOM_PERIOD },
      forceRefresh,
    }),
    womCachedJson(db, `/players/${encodeURIComponent(username)}/achievements`, { forceRefresh }),
    womCachedJson(db, `/players/${encodeURIComponent(username)}/competitions/standings`, {
      query: { status: 'ongoing' },
      forceRefresh,
    }),
    womMembershipPayload(db, account, forceRefresh),
  ]);

  return {
    player: {
      id: player.id,
      username: player.username,
      displayName: player.displayName ?? player.username,
      type: player.type,
      build: player.build,
      status: player.status,
      exp: player.exp,
      ehp: player.ehp,
      ehb: player.ehb,
      updatedAt: player.updatedAt,
      lastChangedAt: player.lastChangedAt,
      lastImportedAt: player.lastImportedAt,
    },
    membership,
    gains,
    achievements: normalizeAchievements(asArrayOfRecords(achievements)),
    competitions: asArrayOfRecords(standings).map(normalizeCompetitionItem),
  };
}

export async function womCompetitionsPayload(db: Database, limit = 12, forceRefresh = false) {
  const groupId = requireWomGroupId();
  const competitions = await womCachedJson(db, `/groups/${groupId}/competitions`, {
    query: { limit: clamp(limit, 1, 25) },
    forceRefresh,
  });

  return {
    competitions: asArrayOfRecords(competitions).map(normalizeCompetitionItem),
  };
}

export async function womCompetitionDetailPayload(db: Database, competitionId: number, forceRefresh = false) {
  const [competitionValue, topHistoryValue] = await Promise.all([
    womCachedJson(db, `/competitions/${competitionId}`, { forceRefresh }),
    womCachedJson(db, `/competitions/${competitionId}/top-history`, { forceRefresh }),
  ]);

  const competition = asRecord(competitionValue);
  return {
    competition: {
      ...normalizeCompetitionItem(competition),
      participants: normalizeCompetitionParticipants(asArrayOfRecords(competition.participants)),
    },
    topHistory: normalizeCompetitionHistory(asArrayOfRecords(topHistoryValue)),
  };
}
