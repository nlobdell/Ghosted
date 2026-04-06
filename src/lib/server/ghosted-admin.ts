import 'server-only';

import { NextResponse } from 'next/server';
import { recordAudit } from '@/lib/server/audit';
import { buildRoleDirectory, postWebhook, sortedRoleOptions } from '@/lib/server/discord';
import { AppError, parseIso, readJsonBody, slugify, utcIso, utcNow } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { appendRewardLedger } from '@/lib/server/rewards';
import {
  displayName,
  getBalance,
  getCurrentUser,
  getUserByDiscordId,
  getUserById,
  listGiveaways,
  listNewsPosts,
  requireAdminUser,
} from '@/lib/server/ghosted-api';
import {
  DEFAULT_WOM_PERIOD,
  countLinkedGameAccounts,
  invalidateWomCache,
  womCachedJson,
  womClanPayload,
  womCompetitionDetailPayload,
  womCompetitionsPayload,
  womGroupId,
  womRequestJson,
} from '@/lib/server/wom';

export async function adminOverviewPayload() {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const users = db.prepare(`
    SELECT
      users.id,
      users.discord_id,
      users.username,
      users.global_name,
      users.is_admin,
      COALESCE(SUM(reward_ledger.amount), 0) AS balance
    FROM users
    LEFT JOIN reward_ledger ON reward_ledger.user_id = users.id
    GROUP BY users.id
    ORDER BY balance DESC, users.id ASC
    LIMIT 20
  `).all() as Array<{
    id: number;
    discord_id: string;
    username: string;
    global_name: string | null;
    is_admin: number;
    balance: number;
  }>;
  const newsCountRow = db.prepare('SELECT COUNT(*) AS count FROM news_posts').get() as { count: number };

  return {
    actor: { displayName: displayName(actor) },
    overview: {
      users: users.map((user) => ({
        id: user.id,
        discordId: user.discord_id,
        displayName: user.global_name || user.username,
        balance: Number(user.balance),
        isAdmin: Boolean(user.is_admin),
      })),
      giveaways: (await listGiveaways(null)).map((giveaway) => ({
        id: giveaway.id,
        title: giveaway.title,
        status: giveaway.status,
      })),
      wom: {
        configured: womGroupId() !== undefined,
        linkedUsers: countLinkedGameAccounts(db, 'osrs'),
      },
      newsCount: Number(newsCountRow.count ?? 0),
    },
  };
}

export async function discordRolesPayload() {
  const roleDirectory = await buildRoleDirectory();
  return {
    roles: sortedRoleOptions(roleDirectory).map((role) => ({
      id: role.id,
      name: role.label,
    })),
  };
}

export async function grantPoints(request: Request) {
  const actor = await requireAdminUser();
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const amount = Number(payload.amount ?? 0);
  const description = String(payload.description ?? '').trim();
  const rawUserId = String(payload.userId ?? '').trim();
  const rawDiscordId = String(payload.discordId ?? '').trim();

  if (amount === 0 || !description) {
    throw new AppError('Grant amount and description are required.');
  }

  let target = /^\d+$/.test(rawUserId) ? getUserById(getDatabase(), Number(rawUserId)) : undefined;
  if (!target) {
    const discordId = rawDiscordId || rawUserId;
    if (discordId) {
      target = getUserByDiscordId(getDatabase(), discordId);
    }
  }
  if (!target) {
    throw new AppError('Could not find that user.', 404);
  }

  appendRewardLedger(getDatabase(), target.id, amount, 'admin_grant', description, { actor_user_id: actor.id });
  recordAudit(actor.id, 'grant_points', 'user', String(target.id), { amount, description });

  return {
    userId: target.id,
    balance: getBalance(getDatabase(), target.id),
  };
}

export async function createGiveaway(request: Request) {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const title = String(payload.title ?? '').trim();
  const description = String(payload.description ?? '').trim();
  const startAt = String(payload.startAt ?? utcIso()).trim();
  const endAt = String(payload.endAt ?? '').trim();
  const pointCost = Number(payload.pointCost ?? 0);
  const maxEntries = Number(payload.maxEntries ?? 1);
  const requiredRoleId = String(payload.requiredRoleId ?? '').trim() || null;

  if (!title || !description || !startAt || !endAt) {
    throw new AppError('Title, description, start, and end are required.');
  }

  const start = parseIso(startAt);
  const end = parseIso(endAt);
  if (!start || !end || end <= start) {
    throw new AppError('Giveaway timing is invalid.');
  }
  if (pointCost < 0 || maxEntries < 1) {
    throw new AppError('Giveaway cost and max entries must be positive.');
  }

  const slug = `${slugify(title)}-${Math.floor(utcNow().getTime() / 1000)}`;
  const status = start <= utcNow() && utcNow() <= end ? 'active' : 'scheduled';

  db.prepare(`
    INSERT INTO giveaways (
      slug, title, description, start_at, end_at, point_cost, max_entries,
      required_role_id, status, winner_user_id, created_by_user_id, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    slug,
    title,
    description,
    utcIso(start),
    utcIso(end),
    pointCost,
    maxEntries,
    requiredRoleId,
    status,
    actor.id,
    utcIso(),
  );

  const giveawayId = Number((db.prepare('SELECT last_insert_rowid()').get() as Record<string, number>)['last_insert_rowid()'] ?? 0);
  recordAudit(actor.id, 'create_giveaway', 'giveaway', String(giveawayId), payload);
  await postWebhook(`New Ghosted giveaway launched: **${title}**`);

  return {
    id: giveawayId,
    title,
    status,
  };
}

export async function createNewsPost(request: Request) {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const payload = await readJsonBody<Record<string, unknown>>(request);
  const title = String(payload.title ?? '').trim();
  const excerpt = String(payload.excerpt ?? '').trim();
  const body = String(payload.body ?? '').trim();
  const status = String(payload.status ?? 'draft').trim().toLowerCase();
  const publishedAtRaw = String(payload.publishedAt ?? '').trim();

  if (!title || !excerpt || !body) {
    throw new AppError('Title, excerpt, and body are required.');
  }
  if (!['draft', 'published'].includes(status)) {
    throw new AppError("Status must be 'draft' or 'published'.");
  }

  const now = utcNow();
  let publishedAt: string | null = null;
  if (status === 'published') {
    if (publishedAtRaw) {
      const parsed = parseIso(publishedAtRaw);
      if (!parsed) throw new AppError('Published date is invalid.');
      publishedAt = utcIso(parsed);
    } else {
      publishedAt = utcIso(now);
    }
  }

  const slugBase = slugify(title);
  let slug = slugBase;
  let suffix = 1;
  while (db.prepare('SELECT 1 FROM news_posts WHERE slug = ? LIMIT 1').get(slug)) {
    suffix += 1;
    slug = `${slugBase}-${suffix}`;
  }

  const createdAt = utcIso(now);
  db.prepare(`
    INSERT INTO news_posts (
      slug, title, excerpt, body, status, published_at, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(slug, title, excerpt, body, status, publishedAt, actor.id, createdAt, createdAt);

  const postId = Number((db.prepare('SELECT last_insert_rowid()').get() as Record<string, number>)['last_insert_rowid()'] ?? 0);
  recordAudit(actor.id, 'create_news_post', 'news_post', String(postId), { title, status });

  return {
    id: postId,
    slug,
    title,
    status,
    publishedAt,
  };
}

export async function deleteNewsPost(postId: number) {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const row = db.prepare('SELECT id, slug, title FROM news_posts WHERE id = ?').get(postId) as {
    id: number;
    slug: string;
    title: string;
  } | undefined;

  if (!row) throw new AppError('News post not found.', 404);

  db.prepare('DELETE FROM news_posts WHERE id = ?').run(postId);
  recordAudit(actor.id, 'delete_news_post', 'news_post', String(postId), { slug: row.slug, title: row.title });
  return row;
}

export function adminNewsPayload(limit: number) {
  return {
    posts: listNewsPosts(true, limit),
  };
}

export async function refreshWomData(request: Request) {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const hasBody = request.headers.get('content-length') && request.headers.get('content-length') !== '0';
  const payload = hasBody ? await readJsonBody<Record<string, unknown>>(request) : {};
  const scope = String(payload.scope ?? 'all').trim().toLowerCase();
  let deleted = 0;
  const refreshed: Record<string, unknown> = { scope };

  if (scope === 'all') {
    deleted += invalidateWomCache(db);
    refreshed.clan = await womClanPayload(db, true);
    refreshed.competitions = await womCompetitionsPayload(db, 12, true);
  } else if (scope === 'group') {
    const groupId = womGroupId();
    if (groupId === undefined) throw new AppError('Wise Old Man integration is not configured yet.', 503);
    deleted += invalidateWomCache(db, `groups/${groupId}`);
    refreshed.clan = await womClanPayload(db, true);
  } else if (scope === 'player') {
    const username = String(payload.username ?? '').trim();
    if (!username) throw new AppError('A Wise Old Man username is required to refresh player data.', 400);
    deleted += invalidateWomCache(db, `players/${encodeURIComponent(username)}`);
    refreshed.player = {
      player: await womRequestJson(`/players/${encodeURIComponent(username)}`, { method: 'POST' }),
      gains: await womCachedJson(db, `/players/${encodeURIComponent(username)}/gained`, {
        query: { period: DEFAULT_WOM_PERIOD },
        forceRefresh: true,
      }),
      achievements: await womCachedJson(db, `/players/${encodeURIComponent(username)}/achievements`, {
        forceRefresh: true,
      }),
    };
  } else if (scope === 'competition') {
    const competitionId = Number(payload.competitionId ?? 0);
    if (!competitionId) throw new AppError('A competitionId is required to refresh competition data.', 400);
    deleted += invalidateWomCache(db, `competitions/${competitionId}`);
    refreshed.competition = await womCompetitionDetailPayload(db, competitionId, true);
  } else {
    throw new AppError('Refresh scope is invalid.', 400);
  }

  recordAudit(actor.id, 'refresh_wom_cache', 'wom_cache', scope, { scope, deleted, payload });
  return NextResponse.json({ deleted, ...refreshed });
}

export async function requireAdminViewerForLayout() {
  const currentUser = await getCurrentUser();
  return currentUser && currentUser.is_admin ? currentUser : null;
}
