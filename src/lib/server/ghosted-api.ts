import 'server-only';

import { auth } from '@/auth';
import { cookies } from 'next/headers';
import type { Database } from 'better-sqlite3';
import { casinoDailyWagerCap, dailyWagerStatus, recentSpins } from '@/lib/server/casino';
import { buildHallCompanionSummaryPayload } from '@/lib/server/companion';
import { buildRoleDirectory, buildRuntimeAuthConfig, resolveRole, resolveRoles, type RoleDirectory } from '@/lib/server/discord';
import { AppError, envFlag, jsonLoad, normalizeLocalPath, parseIso, utcIso, utcNow } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { getBalance, recentLedger } from '@/lib/server/rewards';
import {
  DEFAULT_WOM_HISCORE_METRIC,
  hallClanSummaryPayload,
  womCompetitionsPayload,
  womGroupHiscoresPayload,
  womGroupId,
  womLinkPayload,
} from '@/lib/server/wom';

export { getBalance } from '@/lib/server/rewards';

type UserRow = {
  id: number;
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
  roles_json: string;
  is_admin: number;
};

type GiveawayRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  point_cost: number;
  max_entries: number;
  required_role_id: string | null;
  status: string;
  winner_user_id: number | null;
  created_by_user_id: number | null;
  created_at: string;
};

const SITE_BRAND = {
  label: 'Ghosted',
  href: '/',
};

const SITE_LINKS = {
  twitch: {
    key: 'twitch',
    label: 'Twitch',
    href: 'https://www.twitch.tv/vghosted',
    rel: 'noopener noreferrer',
    presentation: 'link',
  },
  discord: {
    key: 'discord',
    label: 'Discord',
    href: 'https://discord.gg/ghosted',
    target: '_blank',
    rel: 'noopener noreferrer',
    presentation: 'button',
  },
};

const SITE_UTILITY_GROUPS = {
  public: ['twitch', 'discord'],
  app: ['twitch'],
};

const SITE_NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'app', label: 'Hall', href: '/hall/' },
  { key: 'community', label: 'Clan', href: '/hall/clan/' },
  { key: 'rewards', label: 'Rewards', href: '/hall/rewards/' },
  { key: 'giveaways', label: 'Giveaways', href: '/hall/rewards/' },
  { key: 'casino', label: 'Casino', href: '/hall/casino/' },
  { key: 'companion', label: 'Ghostling', href: '/hall/ghostling/' },
  { key: 'profile', label: 'Profile', href: '/hall/profile/' },
];

function getDb() {
  return getDatabase();
}

function siteLinksPayload() {
  return Object.fromEntries(
    Object.entries(SITE_LINKS).map(([key, value]) => [key, { ...value }]),
  );
}

function siteUtilityGroupsPayload() {
  return Object.fromEntries(
    Object.entries(SITE_UTILITY_GROUPS).map(([key, values]) => [key, [...values]]),
  );
}

function activeRouteKey(path: string | null | undefined) {
  const normalized = normalizeLocalPath(path);
  if (normalized === '/') return 'home';
  if (normalized === '/hall' || normalized === '/hall/') return 'app';
  if (normalized.startsWith('/hall/clan') || normalized.startsWith('/hall/competitions')) return 'community';
  if (normalized.startsWith('/hall/rewards')) return 'rewards';
  if (normalized.startsWith('/hall/casino')) return 'casino';
  if (normalized.startsWith('/hall/ghostling')) return 'companion';
  if (normalized.startsWith('/hall/profile')) return 'profile';
  if (normalized.startsWith('/admin')) return 'admin';
  return '';
}

function siteNavigationItems(isAdmin = false) {
  const items = SITE_NAV_ITEMS.map((item) => ({ ...item }));
  if (isAdmin) {
    items.push({ key: 'admin', label: 'Admin', href: '/admin/' });
  }
  return items;
}

export function getUserById(db: Database, userId: number) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
}

export function getUserByDiscordId(db: Database, discordId: string) {
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) as UserRow | undefined;
}

function userRoles(user: UserRow | null | undefined) {
  return user ? jsonLoad<string[]>(user.roles_json, []) : [];
}

export function displayName(user: UserRow) {
  return user.global_name || user.username;
}

function avatarUrl(user: UserRow) {
  if (!user.avatar_hash) return undefined;
  return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar_hash}.png?size=128`;
}

function buildPerks(user: UserRow) {
  const roles = userRoles(user);
  const config = buildRuntimeAuthConfig();
  const perks: string[] = [];
  if (config.memberRoleId && roles.includes(config.memberRoleId)) perks.push('Verified Ghosted member');
  if (config.vipRoleId && roles.includes(config.vipRoleId)) perks.push('VIP reward perks');
  if (user.is_admin) perks.push('Admin controls enabled');
  return perks;
}

async function profilePayload(db: Database, user: UserRow, roleDirectory: RoleDirectory) {
  const giveawayEntriesRow = db
    .prepare('SELECT COUNT(*) AS count FROM giveaway_entries WHERE user_id = ?')
    .get(user.id) as { count: number };
  const womLink = await womLinkPayload(db, user.id);

  return {
    id: user.id,
    discordId: user.discord_id,
    displayName: displayName(user),
    username: user.username,
    avatarUrl: avatarUrl(user),
    roles: userRoles(user),
    roleDetails: resolveRoles(userRoles(user), roleDirectory),
    perks: buildPerks(user),
    isAdmin: Boolean(user.is_admin),
    balance: getBalance(db, user.id),
    giveawayEntries: Number(giveawayEntriesRow.count ?? 0),
    recentSpins: recentSpins(db, user.id, 3),
    womLink,
  };
}

function getLegacySessionUser(db: Database, token: string) {
  return db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at >= ?
  `).get(token, utcIso()) as UserRow | undefined;
}

export async function getCurrentUser() {
  const db = getDb();
  const session = await auth();
  const authUserId = session?.user && 'id' in session.user ? Number(session.user.id ?? 0) : 0;
  if (authUserId > 0) {
    const user = getUserById(db, authUserId);
    if (user) return user;
  }

  const cookieStore = await cookies();
  const legacyToken = cookieStore.get('ghosted_session')?.value;
  if (!legacyToken) return null;
  return getLegacySessionUser(db, legacyToken) ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError('Please sign in with Discord first.', 401);
  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();
  if (!user.is_admin) {
    throw new AppError('You do not have access to admin tools.', 403);
  }
  return user;
}

export function buildConfigPayload() {
  const authConfig = buildRuntimeAuthConfig();
  return {
    authConfigured: authConfig.oauthReady,
    guildSyncConfigured: authConfig.guildReady,
    devAuthEnabled: envFlag('ENABLE_DEV_AUTH', false),
    dailyWagerCap: casinoDailyWagerCap(),
    womConfigured: womGroupId() !== undefined,
    womGroupId: womGroupId() ?? null,
  };
}

export async function buildSiteShell(nextPath = '/') {
  const db = getDb();
  const currentUser = await getCurrentUser();
  const roleDirectory = currentUser ? await buildRoleDirectory() : {};
  const currentRouteKey = activeRouteKey(nextPath);
  const womConfigured = womGroupId() !== undefined;
  const authConfigured = buildRuntimeAuthConfig().oauthReady;
  const loginHref = process.env.ENABLE_DEV_AUTH === 'true'
    ? `/auth/dev-login?next=${encodeURIComponent(normalizeLocalPath(nextPath))}`
    : authConfigured
      ? `/auth/login?next=${encodeURIComponent(normalizeLocalPath(nextPath))}`
      : undefined;

  if (!currentUser) {
    return {
      brand: { ...SITE_BRAND },
      links: siteLinksPayload(),
      utilityGroups: siteUtilityGroupsPayload(),
      activeRouteKey: currentRouteKey,
      authenticated: false,
      auth: {
        configured: authConfigured,
        devAuthEnabled: envFlag('ENABLE_DEV_AUTH', false),
        canSignIn: Boolean(loginHref),
        loginHref,
      },
      user: null,
      profile: null,
      wom: {
        configured: womConfigured,
        linked: false,
        username: null,
        displayName: null,
        inGroup: false,
        membership: null,
        lastSyncedAt: null,
      },
      navigation: siteNavigationItems(),
    };
  }

  const user = await profilePayload(db, currentUser, roleDirectory);
  const womLink = user.womLink ?? {};

  return {
    brand: { ...SITE_BRAND },
    links: siteLinksPayload(),
    utilityGroups: siteUtilityGroupsPayload(),
    activeRouteKey: currentRouteKey,
    authenticated: true,
    auth: {
      configured: authConfigured,
      devAuthEnabled: envFlag('ENABLE_DEV_AUTH', false),
      canSignIn: Boolean(loginHref),
      loginHref,
    },
    user,
    profile: {
      rolesCount: user.roleDetails.length,
      perks: user.perks,
      recentSpins: user.recentSpins.length,
      giveawayEntries: Number(user.giveawayEntries ?? 0),
    },
    wom: {
      configured: womConfigured,
      linked: Boolean(womLink.linked),
      username: womLink.username,
      displayName: womLink.displayName,
      inGroup: Boolean(womLink.inGroup),
      membership: womLink.membership,
      lastSyncedAt: womLink.lastSyncedAt,
    },
    navigation: siteNavigationItems(Boolean(user.isAdmin)),
  };
}

export async function buildRewardsPayload() {
  const db = getDb();
  const user = await requireCurrentUser();
  return {
    balance: getBalance(db, user.id),
    entries: recentLedger(db, user.id),
    spins: recentSpins(db, user.id),
    ...dailyWagerStatus(db, user.id),
  };
}

function newsVisibility(includeDrafts: boolean) {
  if (includeDrafts) return { clause: '', params: [] as unknown[] };
  return {
    clause: "WHERE news_posts.status = 'published' AND (news_posts.published_at IS NULL OR news_posts.published_at <= ?)",
    params: [utcIso()],
  };
}

export function listNewsPosts(includeDrafts = false, limit = 12) {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const visibility = newsVisibility(includeDrafts);
  const rows = db.prepare(`
    SELECT
      news_posts.*,
      users.username AS author_username,
      users.global_name AS author_global_name
    FROM news_posts
    LEFT JOIN users ON users.id = news_posts.created_by_user_id
    ${visibility.clause}
    ORDER BY COALESCE(news_posts.published_at, news_posts.created_at) DESC, news_posts.id DESC
    LIMIT ?
  `).all(...visibility.params, safeLimit) as Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    body: string;
    status: 'draft' | 'published';
    published_at: string | null;
    created_at: string;
    updated_at: string;
    author_username: string | null;
    author_global_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorDisplayName: row.author_global_name || row.author_username || 'Ghosted',
  }));
}

export function getNewsPostBySlug(slug: string, includeDrafts = false) {
  const db = getDb();
  const visibility = newsVisibility(includeDrafts);
  const row = db.prepare(`
    SELECT
      news_posts.*,
      users.username AS author_username,
      users.global_name AS author_global_name
    FROM news_posts
    LEFT JOIN users ON users.id = news_posts.created_by_user_id
    ${visibility.clause} ${visibility.clause ? 'AND' : 'WHERE'} news_posts.slug = ?
    LIMIT 1
  `).get(...visibility.params, slug) as {
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    body: string;
    status: 'draft' | 'published';
    published_at: string | null;
    created_at: string;
    updated_at: string;
    author_username: string | null;
    author_global_name: string | null;
  } | undefined;

  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorDisplayName: row.author_global_name || row.author_username || 'Ghosted',
  };
}

function giveawayStatus(giveaway: GiveawayRow) {
  if (giveaway.status === 'completed') return 'completed';
  const current = utcNow();
  const startsAt = parseIso(giveaway.start_at);
  const endsAt = parseIso(giveaway.end_at);
  if (startsAt && current < startsAt) return 'scheduled';
  if (endsAt && current > endsAt) return 'ended';
  return giveaway.status;
}

export async function listGiveaways(currentUser: UserRow | null = null) {
  const db = getDb();
  const roleDirectory = await buildRoleDirectory();
  const rows = db.prepare(`
    SELECT
      giveaways.*,
      COALESCE(entry_counts.total_entries, 0) AS total_entries,
      COALESCE(user_entries.user_entries, 0) AS user_entries
    FROM giveaways
    LEFT JOIN (
      SELECT giveaway_id, COUNT(*) AS total_entries
      FROM giveaway_entries
      GROUP BY giveaway_id
    ) AS entry_counts ON entry_counts.giveaway_id = giveaways.id
    LEFT JOIN (
      SELECT giveaway_id, COUNT(*) AS user_entries
      FROM giveaway_entries
      WHERE user_id = ?
      GROUP BY giveaway_id
    ) AS user_entries ON user_entries.giveaway_id = giveaways.id
    ORDER BY end_at ASC, id ASC
  `).all(currentUser?.id ?? -1) as Array<GiveawayRow & { total_entries: number; user_entries: number }>;

  const roles = new Set(userRoles(currentUser));
  const balance = currentUser ? getBalance(db, currentUser.id) : 0;

  return rows.map((row) => {
    const status = giveawayStatus(row);
    const requiredRole = resolveRole(row.required_role_id, roleDirectory);
    const roleOk = !row.required_role_id || roles.has(row.required_role_id);
    const userEntries = Number(row.user_entries ?? 0);
    const maxEntries = Number(row.max_entries ?? 0);

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      startAt: row.start_at,
      endAt: row.end_at,
      pointCost: Number(row.point_cost),
      maxEntries,
      userEntries,
      totalEntries: Number(row.total_entries ?? 0),
      requiredRoleId: row.required_role_id,
      requiredRole,
      status,
      winnerUserId: row.winner_user_id,
      canEnter: Boolean(
        currentUser
        && status === 'active'
        && roleOk
        && userEntries < maxEntries
        && balance >= Number(row.point_cost),
      ),
      eligibility: {
        authenticated: Boolean(currentUser),
        roleOk,
        enoughPoints: balance >= Number(row.point_cost),
        remainingEntries: maxEntries - userEntries,
      },
    };
  });
}

export async function enterGiveaway(giveawayId: number) {
  const db = getDb();
  const currentUser = await requireCurrentUser();
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId) as GiveawayRow | undefined;
  if (!giveaway) throw new AppError('That giveaway does not exist.', 404);

  const status = giveawayStatus(giveaway);
  if (status !== 'active') {
    throw new AppError('That giveaway is not currently accepting entries.', 400);
  }

  const roles = new Set(userRoles(currentUser));
  if (giveaway.required_role_id && !roles.has(giveaway.required_role_id)) {
    throw new AppError('Your Discord roles do not qualify for this giveaway.', 403);
  }

  const existingEntriesRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM giveaway_entries
    WHERE giveaway_id = ? AND user_id = ?
  `).get(giveawayId, currentUser.id) as { count: number };
  const existingEntries = Number(existingEntriesRow.count ?? 0);

  if (existingEntries >= Number(giveaway.max_entries)) {
    throw new AppError('You have already used all of your entries for this giveaway.', 400);
  }

  const balance = getBalance(db, currentUser.id);
  if (balance < Number(giveaway.point_cost)) {
    throw new AppError('You do not have enough points for another entry.', 400);
  }

  const transaction = db.transaction(() => {
    if (Number(giveaway.point_cost) > 0) {
      db.prepare(`
        INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        currentUser.id,
        -Number(giveaway.point_cost),
        'giveaway_entry',
        `Entered giveaway: ${giveaway.title}.`,
        JSON.stringify({ giveaway_id: giveawayId, cost: Number(giveaway.point_cost) }),
        utcIso(),
      );
    }

    db.prepare(`
      INSERT INTO giveaway_entries (giveaway_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(giveawayId, currentUser.id, utcIso());
  });

  transaction();

  return {
    giveawayId,
    title: giveaway.title,
    entriesUsed: existingEntries + 1,
    entriesRemaining: Number(giveaway.max_entries) - existingEntries - 1,
    balance: getBalance(db, currentUser.id),
  };
}

function hallRewardsSummaryPayload(db: Database, user: UserRow) {
  return {
    balance: getBalance(db, user.id),
    entries: recentLedger(db, user.id),
    ...dailyWagerStatus(db, user.id),
  };
}

export async function buildHallDashboard() {
  const db = getDb();
  const currentUser = await getCurrentUser();
  let error: string | null = null;
  let rewards = null;
  let companion = null;

  if (currentUser) {
    try {
      rewards = hallRewardsSummaryPayload(db, currentUser);
    } catch (routeError) {
      error = error ?? (routeError instanceof Error ? routeError.message : 'Failed to load rewards.');
    }
    try {
      companion = buildHallCompanionSummaryPayload(db, currentUser);
    } catch (routeError) {
      error = error ?? (routeError instanceof Error ? routeError.message : 'Failed to load Ghostling summary.');
    }
  }

  let giveaways = { activeCount: 0 };
  try {
    const entries = await listGiveaways(currentUser);
    giveaways = { activeCount: entries.filter((entry) => entry.status === 'active').length };
  } catch {
    giveaways = { activeCount: 0 };
  }

  let clan = null;
  try {
    clan = await hallClanSummaryPayload(db);
  } catch {
    clan = null;
  }

  let competitions: Array<Record<string, unknown>> = [];
  try {
    competitions = (await womCompetitionsPayload(db, 6)).competitions;
  } catch {
    competitions = [];
  }

  let hiscores: Array<Record<string, unknown>> = [];
  try {
    hiscores = (await womGroupHiscoresPayload(db, DEFAULT_WOM_HISCORE_METRIC, 3)).entries;
  } catch {
    hiscores = [];
  }

  return {
    authenticated: Boolean(currentUser),
    error,
    rewards,
    companion,
    giveaways,
    clan,
    competitions,
    hiscores,
  };
}
