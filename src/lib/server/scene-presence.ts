import type Database from 'better-sqlite3';
import type {
  CompanionPreviewSummary,
  ScenePresenceMember,
  ScenePresenceMemberSource,
  ScenePresencePayload,
} from '@/lib/types';
import {
  buildCompanionPreviewSummaryOrBasePayload,
  buildHouseCompanionPreviewSummaryPayload,
} from '@/lib/server/companion';
import { getDatabase } from '@/lib/server/database';
import {
  getDiscordPresenceWorkerSummary,
  listDiscordVoicePresence,
  listScenePresenceChannelAllowlist,
} from '@/lib/server/discord-presence';
import {
  primaryOsrsIdentityJoin,
  primaryOsrsIdentitySelect,
  resolveClaimedOsrsDisplayName,
  resolvePublicDisplayName,
} from '@/lib/server/osrs-identity';
import { resolvePublishedGhostlingWorld, resolvePublishedGhostlingWorldTuning } from '@/lib/server/scene-worlds';
import { buildSharedHeroSceneSnapshot, resetSharedSceneStateForTests } from '@/lib/server/scene-shared-state';
import { womGroupId, womRequestJson } from '@/lib/server/wom';

export const SCENE_PRESENCE_CACHE_TTL_MS = 15_000;
const HISTORY_RETENTION_MS = 10 * SCENE_PRESENCE_CACHE_TTL_MS;
const NEW_MEMBER_WINDOW_MS = 2 * SCENE_PRESENCE_CACHE_TTL_MS;
const MAX_MEMBERS = 15;

type ScenePresenceHistoryEntry = {
  firstSeenAt: number;
  lastSeenAt: number;
};

type ScenePresenceUserRow = {
  id: number;
  username: string;
  global_name: string | null;
  public_name_source: string | null;
  osrs_player_id: number | null;
  osrs_username: string | null;
  osrs_display_name: string | null;
  osrs_claim_source: string | null;
  osrs_claimed_at: string | null;
  osrs_verified_at: string | null;
};

type WidgetVoiceMember = {
  channelId: string;
  username: string;
  displayName: string;
};

type ScenePresenceMemberSeed = Omit<ScenePresenceMember, 'activity'> & {
  aliasDisplayName?: string;
};
type ScenePresencePayloadBase = Omit<ScenePresencePayload, 'sharedScene'>;
type VoiceIdentityEntry = {
  identity: string;
  voiceSource: 'bot' | 'widget';
};

let payloadCache: { value: ScenePresencePayloadBase; expiresAt: number } | null = null;
let payloadRefreshPromise: Promise<ScenePresencePayloadBase> | null = null;
let memberHistory = new Map<string, ScenePresenceHistoryEntry>();

export function resetScenePresenceStateForTests() {
  payloadCache = null;
  payloadRefreshPromise = null;
  memberHistory = new Map();
  resetSharedSceneStateForTests();
}

function normalizeSceneUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeSceneDisplayName(displayName: string) {
  return displayName.trim().toLowerCase();
}

function normalizeSceneVoiceAlias(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return normalized.replace(/[^a-z0-9]/g, '');
}

function buildSceneMemberKey(source: ScenePresenceMemberSource, userId: number | null, username: string) {
  if (userId !== null) return `user:${userId}`;
  return `${source}:${normalizeSceneUsername(username)}`;
}

function sceneMemberStrength(source: ScenePresenceMemberSource) {
  return source === 'voice' ? 'high' : 'medium';
}

function sourcePriority(source: ScenePresenceMemberSource) {
  return source === 'voice' ? 2 : 1;
}

function voiceSourcePriority(member: Pick<ScenePresenceMemberSeed, 'voiceSource'>) {
  if (member.voiceSource === 'bot') return 2;
  if (member.voiceSource === 'widget') return 1;
  return 0;
}

function memberPriority(member: ScenePresenceMemberSeed) {
  return (sourcePriority(member.source) * 100)
    + ((member.userId !== null ? 1 : 0) * 10)
    + voiceSourcePriority(member);
}

function mergeIdentityForMember(
  member: ScenePresenceMemberSeed,
  identityByUserId: Map<number, string>,
  identityByUsername: Map<string, string>,
  voiceIdentityByAlias: Map<string, VoiceIdentityEntry>,
  linkedIdentityByAlias: Map<string, string>,
  botVoiceDisplayIdentityByAlias: Map<string, string>,
) {
  const normalizedUsername = normalizeSceneUsername(member.username);
  const normalizedUsernameAlias = normalizeSceneVoiceAlias(member.username);
  const displayCandidate = member.aliasDisplayName ?? member.displayName;
  const normalizedDisplayAlias = normalizeSceneVoiceAlias(displayCandidate);
  const normalizedDisplayName = normalizeSceneDisplayName(displayCandidate);

  if (member.userId !== null) {
    const existingByUserId = identityByUserId.get(member.userId);
    if (existingByUserId) return existingByUserId;
  }

  if (normalizedUsername) {
    const existingByUsername = identityByUsername.get(normalizedUsername);
    if (existingByUsername) return existingByUsername;
  }

  if (normalizedUsername) {
    const existingByLinkedAlias = linkedIdentityByAlias.get(normalizedUsername);
    if (existingByLinkedAlias) return existingByLinkedAlias;
  }

  if (normalizedDisplayName) {
    const existingByLinkedDisplayAlias = linkedIdentityByAlias.get(normalizedDisplayName);
    if (existingByLinkedDisplayAlias) return existingByLinkedDisplayAlias;
  }

  if (member.source === 'wom') {
    if (normalizedUsername) {
      const existingByBotVoiceAlias = botVoiceDisplayIdentityByAlias.get(normalizedUsername);
      if (existingByBotVoiceAlias) return existingByBotVoiceAlias;
    }

    if (normalizedDisplayName) {
      const existingByBotVoiceDisplayAlias = botVoiceDisplayIdentityByAlias.get(normalizedDisplayName);
      if (existingByBotVoiceDisplayAlias) return existingByBotVoiceDisplayAlias;
    }
  }

  if (member.source === 'voice') {
    if (normalizedUsernameAlias) {
      const existingByVoiceAlias = voiceIdentityByAlias.get(normalizedUsernameAlias);
      if (
        existingByVoiceAlias
        && member.voiceSource
        && existingByVoiceAlias.voiceSource !== member.voiceSource
      ) {
        return existingByVoiceAlias.identity;
      }
    }

    if (normalizedDisplayAlias) {
      const existingByVoiceUsername = voiceIdentityByAlias.get(normalizedDisplayAlias);
      if (
        existingByVoiceUsername
        && member.voiceSource
        && existingByVoiceUsername.voiceSource !== member.voiceSource
      ) {
        return existingByVoiceUsername.identity;
      }
    }
  }

  if (member.userId !== null) return `user:${member.userId}`;
  if (normalizedUsername) return `name:${normalizedUsername}`;
  return member.key;
}

function shouldRegisterVoiceAliases(member: ScenePresenceMemberSeed) {
  return member.source === 'voice'
    && (
      member.userId !== null
      || member.voiceSource === 'bot'
    );
}

function voiceAliasNames(member: ScenePresenceMemberSeed) {
  if (!shouldRegisterVoiceAliases(member)) return [];

  const normalizedUsername = normalizeSceneUsername(member.username);
  const aliases = new Set<string>();
  const displayName = normalizeSceneDisplayName(member.displayName);
  if (displayName && displayName !== normalizedUsername) {
    aliases.add(displayName);
  }

  const linkedDisplayName = normalizeSceneDisplayName(member.companion?.user?.displayName ?? '');
  if (linkedDisplayName && linkedDisplayName !== normalizedUsername) {
    aliases.add(linkedDisplayName);
  }

  const linkedUsername = normalizeSceneUsername(member.companion?.user?.username ?? '');
  if (linkedUsername && linkedUsername !== normalizedUsername) {
    aliases.add(linkedUsername);
  }

  return Array.from(aliases);
}

function registerMergedIdentity(
  member: ScenePresenceMemberSeed,
  identity: string,
  identityByUserId: Map<number, string>,
  identityByUsername: Map<string, string>,
  voiceIdentityByAlias: Map<string, VoiceIdentityEntry>,
  linkedIdentityByAlias: Map<string, string>,
  botVoiceDisplayIdentityByAlias: Map<string, string>,
) {
  if (member.userId !== null) {
    identityByUserId.set(member.userId, identity);
  }

  const normalizedUsername = normalizeSceneUsername(member.username);
  if (normalizedUsername) {
    identityByUsername.set(normalizedUsername, identity);
  }

  if (member.userId !== null) {
    const linkedAliases = new Set<string>();
    const normalizedDisplayName = normalizeSceneDisplayName(member.displayName);
    if (normalizedDisplayName) linkedAliases.add(normalizedDisplayName);
    const normalizedAliasDisplayName = normalizeSceneDisplayName(member.aliasDisplayName ?? '');
    if (normalizedAliasDisplayName) linkedAliases.add(normalizedAliasDisplayName);

    const linkedDisplayName = normalizeSceneDisplayName(member.companion?.user?.displayName ?? '');
    if (linkedDisplayName) linkedAliases.add(linkedDisplayName);

    const linkedUsername = normalizeSceneUsername(member.companion?.user?.username ?? '');
    if (linkedUsername) linkedAliases.add(linkedUsername);

    for (const alias of linkedAliases) {
      linkedIdentityByAlias.set(alias, identity);
    }
  }

  if (member.source === 'voice' && member.voiceSource) {
    const aliases = new Set<string>();
    const usernameAlias = normalizeSceneVoiceAlias(member.username);
    if (usernameAlias) aliases.add(usernameAlias);

    for (const alias of voiceAliasNames(member)) {
      const normalizedAlias = normalizeSceneVoiceAlias(alias);
      if (!normalizedAlias) continue;
      aliases.add(normalizedAlias);
    }

    for (const alias of aliases) {
      voiceIdentityByAlias.set(alias, {
        identity,
        voiceSource: member.voiceSource,
      });
    }
  }

  if (member.source === 'voice' && member.voiceSource === 'bot') {
    const displayAliases = new Set<string>();
    const normalizedUsername = normalizeSceneUsername(member.username);
    const normalizedDisplayName = normalizeSceneDisplayName(member.displayName);
    if (normalizedDisplayName && normalizedDisplayName !== normalizedUsername) {
      displayAliases.add(normalizedDisplayName);
    }
    const normalizedAliasDisplayName = normalizeSceneDisplayName(member.aliasDisplayName ?? '');
    if (normalizedAliasDisplayName && normalizedAliasDisplayName !== normalizedUsername) {
      displayAliases.add(normalizedAliasDisplayName);
    }

    const linkedDisplayName = normalizeSceneDisplayName(member.companion?.user?.displayName ?? '');
    if (linkedDisplayName && linkedDisplayName !== normalizedUsername) {
      displayAliases.add(linkedDisplayName);
    }

    for (const alias of displayAliases) {
      botVoiceDisplayIdentityByAlias.set(alias, identity);
    }
  }
}

function stampSceneActivity(member: ScenePresenceMemberSeed, now: number): ScenePresenceMember {
  const previous = memberHistory.get(member.key);
  const firstSeenAt = previous?.firstSeenAt ?? now;
  memberHistory.set(member.key, {
    firstSeenAt,
    lastSeenAt: now,
  });

  return {
    ...member,
    activity: {
      firstSeenAt: new Date(firstSeenAt).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      freshness: now - firstSeenAt <= NEW_MEMBER_WINDOW_MS ? 'new' : 'steady',
      strength: sceneMemberStrength(member.source),
    },
  };
}

function pruneMemberHistory(now: number) {
  const threshold = now - HISTORY_RETENTION_MS;
  for (const [key, entry] of memberHistory.entries()) {
    if (entry.lastSeenAt < threshold) {
      memberHistory.delete(key);
    }
  }
}

function mergePresenceMembers(
  now: number,
  ...groups: ScenePresenceMemberSeed[][]
) {
  const merged = new Map<string, ScenePresenceMemberSeed>();
  const identityByUserId = new Map<number, string>();
  const identityByUsername = new Map<string, string>();
  const voiceIdentityByAlias = new Map<string, VoiceIdentityEntry>();
  const linkedIdentityByAlias = new Map<string, string>();
  const botVoiceDisplayIdentityByAlias = new Map<string, string>();

  for (const group of groups) {
    for (const member of group) {
      const identity = mergeIdentityForMember(
        member,
        identityByUserId,
        identityByUsername,
        voiceIdentityByAlias,
        linkedIdentityByAlias,
        botVoiceDisplayIdentityByAlias,
      );
      const existing = merged.get(identity);
      const preferred = !existing || memberPriority(member) > memberPriority(existing)
        ? member
        : existing;

      merged.set(identity, preferred);
      registerMergedIdentity(
        preferred,
        identity,
        identityByUserId,
        identityByUsername,
        voiceIdentityByAlias,
        linkedIdentityByAlias,
        botVoiceDisplayIdentityByAlias,
      );
    }
  }

  return Array.from(merged.values())
    .map((member) => stampSceneActivity(member, now))
    .slice(0, MAX_MEMBERS);
}

function findSceneUserByUsername(
  db: Database.Database,
  username: string,
) {
  const normalizedUsername = String(username ?? '').trim();
  if (!normalizedUsername) return undefined;

  return db.prepare(`
    SELECT
      users.id,
      users.username,
      users.global_name,
      ${primaryOsrsIdentitySelect('users')}
    FROM users
    ${primaryOsrsIdentityJoin('users')}
    WHERE LOWER(users.username) = LOWER(?)
    LIMIT 1
  `).get(normalizedUsername) as ScenePresenceUserRow | undefined;
}

function findSceneUserByDiscordId(
  db: Database.Database,
  discordId: string,
) {
  const normalizedDiscordId = String(discordId ?? '').trim();
  if (!normalizedDiscordId) return undefined;

  return db.prepare(`
    SELECT
      users.id,
      users.username,
      users.global_name,
      ${primaryOsrsIdentitySelect('users')}
    FROM users
    ${primaryOsrsIdentityJoin('users')}
    WHERE users.discord_id = ?
    LIMIT 1
  `).get(normalizedDiscordId) as ScenePresenceUserRow | undefined;
}

function findSceneUserByWomIdentity(
  db: Database.Database,
  player: Record<string, unknown>,
) {
  const womPlayerId = Number.parseInt(String(player.id ?? ''), 10);
  if (Number.isFinite(womPlayerId)) {
    const byPlayerId = db.prepare(`
      SELECT
        users.id,
        users.username,
        users.global_name,
        ${primaryOsrsIdentitySelect('users')}
      FROM user_game_accounts
      JOIN users ON users.id = user_game_accounts.user_id
      ${primaryOsrsIdentityJoin('users')}
      WHERE user_game_accounts.game = 'osrs'
        AND user_game_accounts.wom_player_id = ?
      LIMIT 1
    `).get(womPlayerId) as ScenePresenceUserRow | undefined;
    if (byPlayerId) return byPlayerId;
  }

  const womUsername = String(player.username ?? '').trim();
  if (womUsername) {
    const byUsername = db.prepare(`
      SELECT
        users.id,
        users.username,
        users.global_name,
        ${primaryOsrsIdentitySelect('users')}
      FROM user_game_accounts
      JOIN users ON users.id = user_game_accounts.user_id
      ${primaryOsrsIdentityJoin('users')}
      WHERE user_game_accounts.game = 'osrs'
        AND LOWER(user_game_accounts.username) = LOWER(?)
      LIMIT 1
    `).get(womUsername) as ScenePresenceUserRow | undefined;
    if (byUsername) return byUsername;
  }

  const womDisplayName = String(player.displayName ?? '').trim();
  if (womDisplayName) {
    const byDisplayName = db.prepare(`
      SELECT
        users.id,
        users.username,
        users.global_name,
        ${primaryOsrsIdentitySelect('users')}
      FROM user_game_accounts
      JOIN users ON users.id = user_game_accounts.user_id
      ${primaryOsrsIdentityJoin('users')}
      WHERE user_game_accounts.game = 'osrs'
        AND LOWER(user_game_accounts.display_name) = LOWER(?)
      LIMIT 1
    `).get(womDisplayName) as ScenePresenceUserRow | undefined;
    if (byDisplayName) return byDisplayName;
  }

  const womAliases = new Set(
    [womUsername, womDisplayName]
      .map((value) => normalizeSceneVoiceAlias(value))
      .filter(Boolean),
  );
  if (womAliases.size === 0) return undefined;
  const womAliasList = Array.from(womAliases);

  const rows = db.prepare(`
    SELECT
      users.id,
      users.username,
      users.global_name,
      ${primaryOsrsIdentitySelect('users')}
    FROM user_game_accounts
    JOIN users ON users.id = user_game_accounts.user_id
    ${primaryOsrsIdentityJoin('users')}
    WHERE user_game_accounts.game = 'osrs'
  `).all() as ScenePresenceUserRow[];

  const matches = new Map<number, ScenePresenceUserRow>();
  for (const row of rows) {
    const rowAliases = new Set(
      [row.osrs_username, row.osrs_display_name]
        .map((value) => normalizeSceneVoiceAlias(String(value ?? '')))
        .filter(Boolean),
    );
    if (womAliasList.some((alias) => rowAliases.has(alias))) {
      matches.set(row.id, row);
    }
  }

  if (matches.size !== 1) return undefined;
  return Array.from(matches.values())[0];
}

async function fetchWidgetVoiceMembersRaw(guildId: string): Promise<WidgetVoiceMember[]> {
  if (!guildId) return [];

  let data: Record<string, unknown>;
  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${guildId}/widget.json`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    data = await res.json() as Record<string, unknown>;
  } catch {
    return [];
  }

  const rawMembers = Array.isArray(data.members)
    ? (data.members as Array<Record<string, unknown>>)
    : [];
  const rawChannels = Array.isArray(data.channels)
    ? (data.channels as Array<Record<string, unknown>>)
    : [];

  const voiceChannelIds = new Set(rawChannels.map((channel) => String(channel.id ?? '')));
  const voiceMembers = rawMembers.filter(
    (member) => member.channel_id && voiceChannelIds.has(String(member.channel_id)),
  );

  return voiceMembers.map((member) => {
    const username = String(member.username ?? '').trim();
    const channelId = String(member.channel_id ?? '').trim();
    const displayName = String(
      member.display_name
      ?? member.global_name
      ?? member.username
      ?? '',
    ).trim() || username;

    return {
      channelId,
      username,
      displayName,
    } satisfies WidgetVoiceMember;
  }).filter((member) => member.username && member.channelId);
}

async function fetchWidgetVoiceMembers(options: {
  db: Database.Database;
  guildId: string | null;
  matchUsers: boolean;
  excludeUsernames?: Set<string>;
  allowedChannelIds?: Set<string> | null;
  fallbackCompanion: CompanionPreviewSummary;
}): Promise<ScenePresenceMemberSeed[]> {
  const {
    db,
    guildId,
    matchUsers,
    excludeUsernames,
    allowedChannelIds,
    fallbackCompanion,
  } = options;
  if (!guildId) return [];

  const rawMembers = await fetchWidgetVoiceMembersRaw(guildId);
  if (rawMembers.length === 0) return [];

  const seenKeys = new Set<string>();
  const results: ScenePresenceMemberSeed[] = [];

  for (const member of rawMembers) {
    if (allowedChannelIds && !allowedChannelIds.has(member.channelId)) continue;

    const normalizedUsername = normalizeSceneUsername(member.username);
    if (excludeUsernames?.has(normalizedUsername)) continue;

    const row = matchUsers ? findSceneUserByUsername(db, member.username) : undefined;
    const userId = row?.id ?? null;
    const key = buildSceneMemberKey('voice', userId, member.username);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    results.push({
      key,
      userId,
      username: member.username,
      displayName: row ? resolvePublicDisplayName(row) : (member.displayName || member.username),
      aliasDisplayName: member.displayName || member.username,
      source: 'voice',
      voiceSource: 'widget',
      companion: buildCompanionPreviewSummaryOrBasePayload(db, row, fallbackCompanion),
    });

    if (results.length >= MAX_MEMBERS) break;
  }

  return results;
}

function fetchBotVoiceMembers(
  db: Database.Database,
  guildId: string | null,
  allowedChannelIds: Set<string>,
  fallbackCompanion: CompanionPreviewSummary,
): ScenePresenceMemberSeed[] {
  if (!guildId || allowedChannelIds.size === 0) return [];

  return listDiscordVoicePresence(db, guildId)
    .filter((row) => allowedChannelIds.has(row.channelId))
    .map((row) => {
      const linkedUser = findSceneUserByDiscordId(db, row.discordId);
      const userId = linkedUser?.id ?? null;

      return {
        key: buildSceneMemberKey('voice', userId, row.username),
        userId,
        username: row.username,
        displayName: linkedUser ? resolvePublicDisplayName(linkedUser) : (row.displayName || row.username),
        aliasDisplayName: row.displayName || row.username,
        source: 'voice',
        voiceSource: 'bot',
        companion: buildCompanionPreviewSummaryOrBasePayload(db, linkedUser, fallbackCompanion),
      } satisfies ScenePresenceMemberSeed;
    })
    .slice(0, MAX_MEMBERS);
}

async function fetchWomActiveMembers(
  db: Database.Database,
  fallbackCompanion: CompanionPreviewSummary,
): Promise<ScenePresenceMemberSeed[]> {
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
  const results: ScenePresenceMemberSeed[] = [];

  for (const entry of entries) {
    const player = (entry.player ?? entry) as Record<string, unknown>;
    const username = String(player.username ?? player.displayName ?? '').trim();
    const displayName = String(player.displayName ?? player.username ?? '').trim();
    if (!username && !displayName) continue;

    const row = findSceneUserByWomIdentity(db, player);

    const userId = row?.id ?? null;
    const publicDisplayName = row ? resolvePublicDisplayName(row) : displayName;
    const sceneUsername = username || displayName;
    results.push({
      key: buildSceneMemberKey('wom', userId, sceneUsername),
      userId,
      username: sceneUsername,
      displayName: publicDisplayName || sceneUsername,
      aliasDisplayName: displayName || resolveClaimedOsrsDisplayName(row ?? {}) || sceneUsername,
      source: 'wom',
      companion: buildCompanionPreviewSummaryOrBasePayload(db, row, fallbackCompanion),
    });
  }

  return results.slice(0, MAX_MEMBERS);
}

async function buildPayloadBase(
  db: Database.Database,
  now: number,
): Promise<ScenePresencePayloadBase> {
  pruneMemberHistory(now);

  const workerSummary = getDiscordPresenceWorkerSummary(db);
  const guildId = workerSummary.guildId;
  const fallbackCompanion = buildHouseCompanionPreviewSummaryPayload(db);
  const publicAllowlist = listScenePresenceChannelAllowlist(db, guildId);
  const allowlistedChannelIds = new Set(publicAllowlist.map((entry) => entry.channelId));
  const widgetAllowedChannelIds = allowlistedChannelIds.size > 0 ? allowlistedChannelIds : null;

  let voiceMembers: ScenePresenceMemberSeed[] = [];
  if (workerSummary.health === 'healthy') {
    const botVoiceMembers = fetchBotVoiceMembers(db, guildId, allowlistedChannelIds, fallbackCompanion);
    const representedUsernames = new Set(
      botVoiceMembers.map((member) => normalizeSceneUsername(member.username)),
    );
    const widgetFallbackMembers = await fetchWidgetVoiceMembers({
      db,
      guildId,
      matchUsers: false,
      excludeUsernames: representedUsernames,
      allowedChannelIds: widgetAllowedChannelIds,
      fallbackCompanion,
    });

    voiceMembers = [...botVoiceMembers, ...widgetFallbackMembers].slice(0, MAX_MEMBERS);
  } else {
    voiceMembers = await fetchWidgetVoiceMembers({
      db,
      guildId,
      matchUsers: true,
      allowedChannelIds: widgetAllowedChannelIds,
      fallbackCompanion,
    });
  }

  const womMembers = await fetchWomActiveMembers(db, fallbackCompanion);
  const members = mergePresenceMembers(now, voiceMembers, womMembers);

  if (members.length > 0) {
    return {
      members,
      source: voiceMembers.length > 0 ? 'voice' : 'wom',
    };
  }

  return { members: [], source: 'empty' };
}

function refreshPayloadBase(
  db: Database.Database,
  now: number,
) {
  if (payloadRefreshPromise) {
    return payloadRefreshPromise;
  }

  payloadRefreshPromise = buildPayloadBase(db, now)
    .then((payloadBase) => {
      payloadCache = {
        value: payloadBase,
        expiresAt: Date.now() + SCENE_PRESENCE_CACHE_TTL_MS,
      };
      return payloadBase;
    })
    .finally(() => {
      payloadRefreshPromise = null;
    });

  return payloadRefreshPromise;
}

export async function buildScenePresencePayload(options: {
  now?: number;
  db?: Database.Database;
  forceRefresh?: boolean;
} = {}): Promise<ScenePresencePayload> {
  const now = options.now ?? Date.now();
  const db = options.db ?? getDatabase();
  const runtimeWorld = resolvePublishedGhostlingWorld(db, 'shared-commons');
  const runtimeTuning = resolvePublishedGhostlingWorldTuning(db, 'shared-commons');
  let payloadBase = payloadCache?.value ?? null;

  if (options.forceRefresh || !payloadBase || !payloadCache) {
    payloadBase = await refreshPayloadBase(db, now);
  } else if (payloadCache.expiresAt <= now) {
    void refreshPayloadBase(db, now);
  }

  return {
    ...payloadBase,
    sharedScene: {
      hero: buildSharedHeroSceneSnapshot(db, payloadBase.members, payloadBase.source, now, runtimeWorld, runtimeTuning),
    },
  } satisfies ScenePresencePayload;
}
