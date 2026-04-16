import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { utcIso } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import {
  replaceScenePresenceChannelAllowlist,
  upsertDiscordPresenceWorkerState,
} from '@/lib/server/discord-presence';

const {
  requireAdminUserMock,
  getCurrentUserMock,
  getBalanceMock,
  getUserByDiscordIdMock,
  getUserByIdMock,
  listGiveawaysMock,
  listNewsPostsMock,
} = vi.hoisted(() => ({
  requireAdminUserMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getBalanceMock: vi.fn(),
  getUserByDiscordIdMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  listGiveawaysMock: vi.fn(),
  listNewsPostsMock: vi.fn(),
}));

vi.mock('@/lib/server/ghosted-api', () => {
  return {
    displayName: (user: { global_name?: string | null; username: string }) => user.global_name || user.username,
    getBalance: getBalanceMock,
    getUserByDiscordId: getUserByDiscordIdMock,
    getUserById: getUserByIdMock,
    listGiveaways: listGiveawaysMock,
    listNewsPosts: listNewsPostsMock,
    requireAdminUser: requireAdminUserMock,
    getCurrentUser: getCurrentUserMock,
  };
});

import { GET as getOverviewRoute } from '@/app/api/admin/overview/route';
import { GET as getRewardsRoute } from '@/app/api/admin/rewards/route';
import { GET as getContentRoute } from '@/app/api/admin/content/route';
import { GET as getSystemsRoute } from '@/app/api/admin/systems/route';
import {
  adminContentPayload,
  adminOverviewPayload,
  adminRewardsPayload,
  adminSystemsPayload,
} from '@/lib/server/ghosted-admin';

function stubDiscordFetch() {
  return vi.fn().mockImplementation(async (input: string | URL) => {
    const url = String(input);
    if (url.includes('/channels')) {
      return new Response(JSON.stringify([
        { id: 'voice-1', name: 'Lounge', type: 2 },
        { id: 'stage-1', name: 'Main Stage', type: 13 },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/roles')) {
      return new Response(JSON.stringify([
        { id: 'vip-role', name: 'VIP' },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

describe('admin dashboard payloads and routes', () => {
  let context: ServerTestContext;
  let adminUserId: number;

  beforeEach(() => {
    context = setupServerTestEnvironment({
      DISCORD_GUILD_ID: 'ghosted-guild',
      DISCORD_BOT_TOKEN: 'bot-token',
      WOM_GROUP_ID: '123',
    });

    adminUserId = insertUser(context.db, {
      discordId: 'admin-discord',
      username: 'admin',
      globalName: 'Admin User',
      isAdmin: 1,
    });
    const memberUserId = insertUser(context.db, {
      discordId: 'member-discord',
      username: 'member',
      globalName: 'Member User',
      isAdmin: 0,
    });

    addRewardLedgerEntry(context.db, memberUserId, 250, 'admin_grant', 'Balance correction');
    context.db.prepare(`
      INSERT INTO giveaways (
        slug, title, description, start_at, end_at, point_cost, max_entries,
        required_role_id, status, winner_user_id, created_by_user_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      'moon-bundle',
      'Moon bundle',
      'Bundle description',
      utcIso(new Date(Date.now() - 60 * 60 * 1000)),
      utcIso(new Date(Date.now() + 60 * 60 * 1000)),
      50,
      10,
      null,
      'active',
      adminUserId,
      utcIso(),
    );
    context.db.prepare(`
      INSERT INTO news_posts (
        slug, title, excerpt, body, status, published_at, created_by_user_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'welcome',
      'Welcome back',
      'Tonight at reset.',
      'Long body',
      'published',
      utcIso(),
      adminUserId,
      utcIso(),
      utcIso(),
    );
    context.db.prepare(`
      INSERT INTO companion_catalog (
        slug, name, slot_key, rarity, cost, description, active, sort_order, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('moon-hood', 'Moon Hood', 'hat', 'rare', 120, 'Ghostling hat', 1, 10, utcIso());
    context.db.prepare(`
      INSERT INTO audit_log (actor_user_id, action, target_type, target_id, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
    `).run(
      adminUserId, 'grant_points', 'user', String(memberUserId), JSON.stringify({ amount: 250, description: 'Balance correction' }), utcIso(),
      adminUserId, 'create_news_post', 'news_post', '1', JSON.stringify({ title: 'Welcome back', status: 'published' }), utcIso(),
    );

    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: utcIso(),
      lastSyncAt: utcIso(),
      lastError: null,
    });
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);

    const adminUser = {
      id: adminUserId,
      discord_id: 'admin-discord',
      username: 'admin',
      global_name: 'Admin User',
      avatar_hash: null,
      roles_json: '[]',
      is_admin: 1,
    };

    requireAdminUserMock.mockReset();
    requireAdminUserMock.mockResolvedValue(adminUser);
    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockResolvedValue(adminUser);
    getBalanceMock.mockReset();
    getBalanceMock.mockImplementation((_db, userId: number) => {
      const row = getDatabase().prepare(`
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM reward_ledger
        WHERE user_id = ?
      `).get(userId) as { balance: number };
      return Number(row.balance ?? 0);
    });
    getUserByIdMock.mockReset();
    getUserByIdMock.mockImplementation((_db, userId: number) => {
      return getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(userId);
    });
    getUserByDiscordIdMock.mockReset();
    getUserByDiscordIdMock.mockImplementation((_db, discordId: string) => {
      return getDatabase().prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
    });
    listGiveawaysMock.mockReset();
    listGiveawaysMock.mockImplementation(async () => {
      type GiveawayQueryRow = {
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
        total_entries: number;
      };

      return (getDatabase().prepare(`
        SELECT
          giveaways.id,
          giveaways.slug,
          giveaways.title,
          giveaways.description,
          giveaways.start_at,
          giveaways.end_at,
          giveaways.point_cost,
          giveaways.max_entries,
          giveaways.required_role_id,
          giveaways.status,
          giveaways.winner_user_id,
          COALESCE(entry_counts.total_entries, 0) AS total_entries
        FROM giveaways
        LEFT JOIN (
          SELECT giveaway_id, COUNT(*) AS total_entries
          FROM giveaway_entries
          GROUP BY giveaway_id
        ) AS entry_counts ON entry_counts.giveaway_id = giveaways.id
        ORDER BY giveaways.end_at ASC, giveaways.id ASC
      `).all() as GiveawayQueryRow[]).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        startAt: row.start_at,
        endAt: row.end_at,
        pointCost: Number(row.point_cost ?? 0),
        maxEntries: Number(row.max_entries ?? 0),
        userEntries: 0,
        totalEntries: Number(row.total_entries ?? 0),
        requiredRoleId: row.required_role_id,
        requiredRole: null,
        status: row.status,
        winnerUserId: row.winner_user_id,
        canEnter: false,
        eligibility: {
          authenticated: true,
          roleOk: true,
          enoughPoints: true,
          remainingEntries: Number(row.max_entries ?? 0),
        },
      }));
    });
    listNewsPostsMock.mockReset();
    listNewsPostsMock.mockImplementation((includeDrafts = false, limit = 12) => {
      type NewsPostQueryRow = {
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
      };

      const visibilityClause = includeDrafts
        ? ''
        : "WHERE news_posts.status = 'published' AND (news_posts.published_at IS NULL OR news_posts.published_at <= ?)";
      const params = includeDrafts ? [limit] : [utcIso(), limit];
      return (getDatabase().prepare(`
        SELECT
          news_posts.*,
          users.username AS author_username,
          users.global_name AS author_global_name
        FROM news_posts
        LEFT JOIN users ON users.id = news_posts.created_by_user_id
        ${visibilityClause}
        ORDER BY COALESCE(news_posts.published_at, news_posts.created_at) DESC, news_posts.id DESC
        LIMIT ?
      `).all(...params) as NewsPostQueryRow[]).map((row) => ({
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
    });
    vi.stubGlobal('fetch', stubDiscordFetch());
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds the expanded overview payload with alerts, summaries, quick-action data, and recent audit', async () => {
    const payload = await adminOverviewPayload();

    expect(payload.alerts).toEqual([]);
    expect(payload.quickActionReferenceData.roles).toEqual([
      { id: 'vip-role', name: 'VIP' },
    ]);
    expect(payload.sectionSummaries.map((summary) => summary.key)).toEqual([
      'rewards',
      'content',
      'systems',
      'worlds',
      'ghostling',
    ]);
    expect(payload.recentAudit[0]?.actionLabel).toBe('Save dispatch');
  });

  it('builds rewards, content, and systems specialist payloads', async () => {
    const rewards = await adminRewardsPayload();
    const content = await adminContentPayload();
    const systems = await adminSystemsPayload();

    expect(rewards.giveaways[0]?.title).toBe('Moon bundle');
    expect(content.posts[0]?.title).toBe('Welcome back');
    expect(systems.discord.allowlist[0]?.channelName).toBe('Lounge');
  });

  it('serves the new admin aggregate routes', async () => {
    const overviewResponse = await getOverviewRoute();
    const rewardsResponse = await getRewardsRoute();
    const contentResponse = await getContentRoute();
    const systemsResponse = await getSystemsRoute();

    const overview = await overviewResponse.json();
    const rewards = await rewardsResponse.json();
    const content = await contentResponse.json();
    const systems = await systemsResponse.json();

    expect(overview.sectionSummaries).toHaveLength(5);
    expect(rewards.stats.activeGiveaways).toBe(1);
    expect(content.stats.publishedCount).toBe(1);
    expect(systems.discord.publicMode).toBe('bot');
  });
});
