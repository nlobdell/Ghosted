import 'server-only';

import { NextResponse } from 'next/server';
import { recordAudit } from '@/lib/server/audit';
import { buildRoleDirectory, buildRuntimeAuthConfig, postWebhook, sortedRoleOptions } from '@/lib/server/discord';
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
  getDiscordPresenceWorkerSummary,
  listScenePresenceChannelAllowlist,
  replaceScenePresenceChannelAllowlist,
} from '@/lib/server/discord-presence';
import { buildAdminWorldPayload } from '@/lib/server/scene-worlds';
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
import type {
  AdminAlert,
  AdminAuditEntry,
  AdminContentData,
  AdminGiveawayRow,
  AdminOverviewData,
  AdminRewardsData,
  AdminRoleOption,
  AdminSectionKey,
  AdminSectionStatus,
  AdminSectionSummary,
  AdminSystemsData,
  AdminUserBalanceRow,
  AdminWomSummary,
  DiscordPresenceAdminChannel,
  DiscordPresenceAdminData,
  DiscordPresenceChannelType,
  DiscordPresenceWorkerSummary,
} from '@/lib/types';

const ADMIN_SECTION_HREFS: Record<AdminSectionKey, string> = {
  rewards: '/admin/rewards/',
  content: '/admin/content/',
  systems: '/admin/systems/',
  worlds: '/admin/worlds/',
  ghostling: '/admin/ghostling/',
};

const ADMIN_AUDIT_SECTION_MAP: Partial<Record<string, AdminSectionKey>> = {
  grant_points: 'rewards',
  create_giveaway: 'rewards',
  create_news_post: 'content',
  delete_news_post: 'content',
  refresh_wom_cache: 'systems',
  update_scene_presence_allowlist: 'systems',
  stage_world_layer_asset: 'worlds',
  replace_world_draft_package: 'worlds',
  replace_world_draft_tuning: 'worlds',
  archive_world_layer_asset: 'worlds',
  restore_world_layer_asset: 'worlds',
  publish_world_draft: 'worlds',
  discard_world_draft: 'worlds',
  upload_companion_base_asset: 'ghostling',
  create_companion_item: 'ghostling',
  update_companion_item: 'ghostling',
  replace_companion_item_assets: 'ghostling',
  import_repo_companion_items: 'ghostling',
  set_companion_item_active: 'ghostling',
  reorder_companion_item: 'ghostling',
  archive_companion_item: 'ghostling',
  restore_companion_item: 'ghostling',
  delete_companion_item: 'ghostling',
};

const ADMIN_AUDIT_LABELS: Partial<Record<string, string>> = {
  grant_points: 'Grant points',
  create_giveaway: 'Create drop',
  create_news_post: 'Save dispatch',
  delete_news_post: 'Delete dispatch',
  refresh_wom_cache: 'Refresh Wise Old Man',
  update_scene_presence_allowlist: 'Update public channels',
  stage_world_layer_asset: 'Stage layer',
  replace_world_draft_package: 'Replace draft package',
  replace_world_draft_tuning: 'Save draft tuning',
  archive_world_layer_asset: 'Archive layer override',
  restore_world_layer_asset: 'Restore layer override',
  publish_world_draft: 'Publish draft',
  discard_world_draft: 'Discard draft',
  upload_companion_base_asset: 'Upload base files',
  create_companion_item: 'Create cosmetic',
  update_companion_item: 'Edit cosmetic',
  replace_companion_item_assets: 'Replace cosmetic files',
  import_repo_companion_items: 'Import repo cosmetics',
  set_companion_item_active: 'Update visibility',
  reorder_companion_item: 'Reorder catalog',
  archive_companion_item: 'Archive cosmetic',
  restore_companion_item: 'Restore cosmetic',
  delete_companion_item: 'Delete cosmetic',
};

function safeJsonLoad<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function adminRoleOptions(roleDirectory: Awaited<ReturnType<typeof buildRoleDirectory>>): AdminRoleOption[] {
  return sortedRoleOptions(roleDirectory).map((role) => ({
    id: role.id,
    name: role.label,
  }));
}

async function adminRoleOptionsPayload() {
  return adminRoleOptions(await buildRoleDirectory());
}

function adminUsersWithBalances(limit = 20) {
  const db = getDatabase();
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
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 50))) as Array<{
    id: number;
    discord_id: string;
    username: string;
    global_name: string | null;
    is_admin: number;
    balance: number;
  }>;
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS tracked_users,
      SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) AS admin_users
    FROM users
  `).get() as {
    tracked_users: number;
    admin_users: number;
  };

  return {
    rows: users.map((user) => ({
      id: user.id,
      discordId: user.discord_id,
      displayName: user.global_name || user.username,
      balance: Number(user.balance),
      isAdmin: Boolean(user.is_admin),
    })) satisfies AdminUserBalanceRow[],
    trackedUsers: Number(totals.tracked_users ?? 0),
    adminUsers: Number(totals.admin_users ?? 0),
  };
}

async function adminGiveawayRows(): Promise<AdminGiveawayRow[]> {
  const giveaways = await listGiveaways(null);
  return giveaways.map((giveaway) => ({
    id: giveaway.id,
    title: giveaway.title,
    status: giveaway.status,
    pointCost: Number(giveaway.pointCost ?? 0),
    maxEntries: Number(giveaway.maxEntries ?? 0),
    totalEntries: Number(giveaway.totalEntries ?? 0),
    endAt: giveaway.endAt,
    requiredRoleLabel: giveaway.requiredRole?.label ?? null,
  }));
}

function adminNewsCounts() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM news_posts
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>;
  const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentPublishedRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM news_posts
    WHERE status = 'published'
      AND COALESCE(published_at, created_at) >= ?
  `).get(utcIso(lastDay)) as { count: number };

  return {
    publishedCount: Number(rows.find((row) => row.status === 'published')?.count ?? 0),
    draftCount: Number(rows.find((row) => row.status === 'draft')?.count ?? 0),
    recentlyPublishedCount: Number(recentPublishedRow.count ?? 0),
  };
}

function adminWomSummary(): AdminWomSummary {
  const db = getDatabase();
  return {
    configured: womGroupId() !== undefined,
    linkedUsers: countLinkedGameAccounts(db, 'osrs'),
  };
}

function adminGhostlingSummary() {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total_items,
      SUM(CASE WHEN active = 1 AND archived_at IS NULL THEN 1 ELSE 0 END) AS active_items,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived_items
    FROM companion_catalog
  `).get() as {
    total_items: number;
    active_items: number | null;
    archived_items: number | null;
  };

  return {
    totalItems: Number(row.total_items ?? 0),
    activeItems: Number(row.active_items ?? 0),
    archivedItems: Number(row.archived_items ?? 0),
  };
}

function adminWorldsSummary() {
  const payload = buildAdminWorldPayload(getDatabase(), {
    id: 0,
    username: 'system',
    global_name: 'System',
  });

  return {
    layerCount: payload.layers.length,
    hasDraft: payload.world.hasDraft,
    hasPublishedVariant: payload.world.hasPublishedVariant,
    archivedLayerCount: payload.world.archivedLayerCount,
  };
}

function countAuditActions(actions: string[], since?: Date) {
  if (!actions.length) return 0;
  const db = getDatabase();
  const placeholders = actions.map(() => '?').join(', ');
  const params: unknown[] = [...actions];
  let where = `action IN (${placeholders})`;
  if (since) {
    where += ' AND created_at >= ?';
    params.push(utcIso(since));
  }
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM audit_log
    WHERE ${where}
  `).get(...params) as { count: number };
  return Number(row.count ?? 0);
}

function systemsHealthSeverity(data: DiscordPresenceAdminData, wom: AdminWomSummary): AdminSectionStatus {
  if (!wom.configured || !data.guild.ready || data.worker.health === 'error') return 'critical';
  if (data.worker.health !== 'healthy' || data.allowlist.length === 0) return 'warning';
  return 'ready';
}

function rewardsSectionSummary(input: {
  activeGiveaways: number;
  scheduledGiveaways: number;
  trackedUsers: number;
  recentGrantCount: number;
}): AdminSectionSummary {
  const status: AdminSectionStatus = input.recentGrantCount >= 8 ? 'warning' : 'ready';
  return {
    key: 'rewards',
    label: 'Rewards',
    href: ADMIN_SECTION_HREFS.rewards,
    status,
    primary: `${input.activeGiveaways} live ${input.activeGiveaways === 1 ? 'drop' : 'drops'}`,
    secondary: `${input.recentGrantCount} direct balance ${input.recentGrantCount === 1 ? 'update' : 'updates'} in the last 24 hours.`,
    chips: [
      `${input.trackedUsers} tracked balances`,
      `${input.scheduledGiveaways} scheduled`,
    ],
  };
}

function contentSectionSummary(input: {
  publishedCount: number;
  draftCount: number;
  recentlyPublishedCount: number;
}): AdminSectionSummary {
  const status: AdminSectionStatus = input.draftCount > 0 ? 'warning' : 'ready';
  return {
    key: 'content',
    label: 'Content',
    href: ADMIN_SECTION_HREFS.content,
    status,
    primary: `${input.publishedCount} published dispatches`,
    secondary: input.draftCount > 0
      ? `${input.draftCount} draft ${input.draftCount === 1 ? 'dispatch is' : 'dispatches are'} waiting for review.`
      : `${input.recentlyPublishedCount} published in the last 24 hours.`,
    chips: [
      `${input.draftCount} drafts`,
      `${input.recentlyPublishedCount} recently published`,
    ],
  };
}

function systemsSectionSummary(input: {
  wom: AdminWomSummary;
  discord: DiscordPresenceAdminData;
}): AdminSectionSummary {
  return {
    key: 'systems',
    label: 'Systems',
    href: ADMIN_SECTION_HREFS.systems,
    status: systemsHealthSeverity(input.discord, input.wom),
    primary: input.wom.configured ? 'Wise Old Man linked to Ghosted' : 'Wise Old Man needs configuration',
    secondary: input.discord.guild.ready
      ? `Discord worker health is ${input.discord.worker.health.replaceAll('-', ' ')}.`
      : 'Discord guild sync still needs bot credentials before public channel control is reliable.',
    chips: [
      `${input.wom.linkedUsers} Wise Old Man links`,
      `${input.discord.allowlist.length} public channels`,
    ],
  };
}

function worldsSectionSummary(input: {
  layerCount: number;
  hasDraft: boolean;
  hasPublishedVariant: boolean;
  archivedLayerCount: number;
}): AdminSectionSummary {
  const status: AdminSectionStatus = input.hasDraft || input.archivedLayerCount > 0 ? 'warning' : 'ready';
  return {
    key: 'worlds',
    label: 'Worlds',
    href: ADMIN_SECTION_HREFS.worlds,
    status,
    primary: input.hasDraft ? 'Draft world changes are pending' : 'Draft and live world are aligned',
    secondary: input.archivedLayerCount > 0
      ? `${input.archivedLayerCount} ${input.archivedLayerCount === 1 ? 'layer override is' : 'layer overrides are'} archived and restorable.`
      : input.hasPublishedVariant
        ? 'The homepage is using a published runtime world variant.'
        : 'The homepage is still using the repo fallback world package.',
    chips: [
      `${input.layerCount} layers`,
      `${input.archivedLayerCount} archived overrides`,
    ],
  };
}

function ghostlingSectionSummary(input: { totalItems: number; activeItems: number; archivedItems: number }): AdminSectionSummary {
  const hiddenItems = Math.max(0, input.totalItems - input.activeItems - input.archivedItems);
  const status: AdminSectionStatus = input.totalItems === 0 ? 'warning' : 'ready';
  return {
    key: 'ghostling',
    label: 'Ghostling',
    href: ADMIN_SECTION_HREFS.ghostling,
    status,
    primary: input.totalItems > 0 ? `${input.activeItems} visible cosmetics live` : 'Ghostling library needs content',
    secondary: input.totalItems > 0
      ? `${hiddenItems} ${hiddenItems === 1 ? 'item is' : 'items are'} hidden and ${input.archivedItems} ${input.archivedItems === 1 ? 'item is' : 'items are'} archived.`
      : 'Upload base files or cosmetics before members rely on this library.',
    chips: [
      `${input.totalItems} total cosmetics`,
      `${hiddenItems} hidden`,
      `${input.archivedItems} archived`,
    ],
  };
}

function adminAlertHref(section: AdminSectionKey) {
  return ADMIN_SECTION_HREFS[section];
}

function workerHealthDetail(data: DiscordPresenceAdminData) {
  if (data.worker.health === 'healthy') {
    return 'Public Discord channel matching is healthy.';
  }
  if (data.worker.health === 'not-installed') {
    return 'The configured guild does not have the bot installed yet, so public presence is still using fallback behavior.';
  }
  if (data.worker.health === 'stale') {
    return 'The worker heartbeat is stale. Recheck the worker before trusting the public homepage scene.';
  }
  if (data.worker.health === 'error') {
    return 'The worker reported an error and needs attention before public presence can be trusted.';
  }
  if (!data.guild.ready) {
    return 'Set DISCORD_GUILD_ID and DISCORD_BOT_TOKEN before you expect bot-backed public presence.';
  }
  return 'Public presence is not fully ready yet.';
}

function buildAdminAlerts(input: {
  wom: AdminWomSummary;
  discord: DiscordPresenceAdminData;
}): AdminAlert[] {
  const alerts: AdminAlert[] = [];

  if (!input.wom.configured) {
    alerts.push({
      id: 'wom-not-configured',
      title: 'Wise Old Man is not configured',
      detail: 'Clan sync, Hall competition state, and admin refresh controls stay degraded until WOM_GROUP_ID is set.',
      variant: 'warning',
      section: 'systems',
      href: adminAlertHref('systems'),
      ctaLabel: 'Open systems',
    });
  }

  if (!input.discord.guild.ready) {
    alerts.push({
      id: 'discord-not-ready',
      title: 'Discord guild sync is incomplete',
      detail: 'Set DISCORD_GUILD_ID and DISCORD_BOT_TOKEN before public channel visibility can be managed safely.',
      variant: 'warning',
      section: 'systems',
      href: adminAlertHref('systems'),
      ctaLabel: 'Review systems',
    });
  } else if (input.discord.worker.health !== 'healthy') {
    alerts.push({
      id: `discord-worker-${input.discord.worker.health}`,
      title: 'Discord worker needs attention',
      detail: workerHealthDetail(input.discord),
      variant: input.discord.worker.health === 'error' ? 'error' : 'warning',
      section: 'systems',
      href: adminAlertHref('systems'),
      ctaLabel: 'Inspect systems',
    });
  }

  if (input.discord.guild.ready && input.discord.allowlist.length === 0) {
    alerts.push({
      id: 'discord-allowlist-empty',
      title: 'No public voice or stage channels are allowed yet',
      detail: 'The homepage cannot safely show Discord presence until at least one channel is selected for the public allowlist.',
      variant: 'warning',
      section: 'systems',
      href: adminAlertHref('systems'),
      ctaLabel: 'Choose channels',
    });
  }

  return alerts;
}

function auditSection(action: string): AdminSectionKey | null {
  return ADMIN_AUDIT_SECTION_MAP[action] ?? null;
}

function auditActionLabel(action: string) {
  return ADMIN_AUDIT_LABELS[action] ?? action.replaceAll('_', ' ');
}

function auditSummary(action: string, targetId: string, payloadJson: string) {
  const payload = safeJsonLoad<Record<string, unknown>>(payloadJson, {});
  switch (action) {
    case 'grant_points':
      return `Granted ${Number(payload.amount ?? 0).toLocaleString()} pts to user #${targetId}.`;
    case 'create_giveaway':
      return `Created drop "${String(payload.title ?? targetId)}".`;
    case 'create_news_post':
      return `Saved dispatch "${String(payload.title ?? targetId)}" as ${String(payload.status ?? 'draft')}.`;
    case 'delete_news_post':
      return `Deleted dispatch "${String(payload.title ?? targetId)}".`;
    case 'refresh_wom_cache':
      return `Refreshed Wise Old Man cache for ${String(payload.scope ?? 'all')}.`;
    case 'update_scene_presence_allowlist': {
      const channelIds = Array.isArray(payload.channelIds) ? payload.channelIds.length : 0;
      return `Updated the public Discord allowlist for ${channelIds} ${channelIds === 1 ? 'channel' : 'channels'}.`;
    }
    case 'stage_world_layer_asset':
      return `Staged a draft override for the "${String(payload.layerKey ?? 'layer')}" layer.`;
    case 'replace_world_draft_package':
      return 'Replaced the draft world package and rebound its layer sources.';
    case 'replace_world_draft_tuning':
      return 'Updated runtime max-visible tuning for the draft world.';
    case 'archive_world_layer_asset':
      return `Archived the "${String(payload.layerKey ?? 'layer')}" draft override without deleting files.`;
    case 'restore_world_layer_asset':
      return `Restored the archived "${String(payload.layerKey ?? 'layer')}" draft override.`;
    case 'publish_world_draft':
      return 'Published the draft world to the live runtime variant.';
    case 'discard_world_draft':
      return 'Discarded draft-only world changes and realigned with live state.';
    case 'upload_companion_base_asset':
      return 'Uploaded new Ghostling base files.';
    case 'create_companion_item':
      return `Created Ghostling cosmetic "${String(payload.name ?? targetId)}".`;
    case 'update_companion_item': {
      const previousSlug = String(payload.previousSlug ?? '').trim();
      return previousSlug && previousSlug !== targetId
        ? `Updated Ghostling cosmetic "${previousSlug}" to "${targetId}".`
        : `Updated Ghostling cosmetic "${targetId}".`;
    }
    case 'replace_companion_item_assets':
      return `Replaced live files for Ghostling item "${targetId}".`;
    case 'import_repo_companion_items':
      return 'Imported repo Ghostling cosmetics into the live library.';
    case 'set_companion_item_active':
      return Boolean(payload.active)
        ? `Restored Ghostling item "${targetId}" to the live catalog.`
        : `Hid Ghostling item "${targetId}" from the live catalog.`;
    case 'reorder_companion_item':
      return `Changed the live order for Ghostling item "${targetId}".`;
    case 'archive_companion_item':
      return `Archived Ghostling item "${targetId}" without deleting its files.`;
    case 'restore_companion_item':
      return `Restored Ghostling item "${targetId}" to the operator catalog.`;
    case 'delete_companion_item':
      return `Permanently deleted archived Ghostling item "${targetId}".`;
    default:
      return `${auditActionLabel(action)} on ${targetId}.`;
  }
}

function buildAdminAuditFeed(limit = 6, sections?: AdminSectionKey[]): AdminAuditEntry[] {
  const db = getDatabase();
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const rows = db.prepare(`
    SELECT
      audit_log.id,
      audit_log.action,
      audit_log.target_type,
      audit_log.target_id,
      audit_log.payload_json,
      audit_log.created_at,
      users.username AS actor_username,
      users.global_name AS actor_global_name
    FROM audit_log
    LEFT JOIN users ON users.id = audit_log.actor_user_id
    ORDER BY audit_log.created_at DESC, audit_log.id DESC
    LIMIT ?
  `).all(safeLimit * 5) as Array<{
    id: number;
    action: string;
    target_type: string;
    target_id: string;
    payload_json: string;
    created_at: string;
    actor_username: string | null;
    actor_global_name: string | null;
  }>;
  const sectionSet = sections ? new Set(sections) : null;

  return rows
    .map((row) => {
      const section = auditSection(row.action);
      if (!section) return null;
      if (sectionSet && !sectionSet.has(section)) return null;
      return {
        id: row.id,
        action: row.action,
        actionLabel: auditActionLabel(row.action),
        section,
        targetType: row.target_type,
        targetId: row.target_id,
        actorDisplayName: row.actor_global_name || row.actor_username || 'System',
        createdAt: row.created_at,
        summary: auditSummary(row.action, row.target_id, row.payload_json),
      } satisfies AdminAuditEntry;
    })
    .filter((entry): entry is AdminAuditEntry => Boolean(entry))
    .slice(0, safeLimit);
}

async function buildSharedAdminState(actorOverride?: Awaited<ReturnType<typeof requireAdminUser>>) {
  const [roles, giveaways, discord] = await Promise.all([
    adminRoleOptionsPayload(),
    adminGiveawayRows(),
    buildDiscordPresenceAdminData(actorOverride),
  ]);
  const users = adminUsersWithBalances(24);
  const wom = adminWomSummary();
  const news = adminNewsCounts();
  const ghostling = adminGhostlingSummary();
  const worlds = adminWorldsSummary();
  const recentGrantCount = countAuditActions(['grant_points'], new Date(Date.now() - 24 * 60 * 60 * 1000));

  return {
    roles,
    users,
    giveaways,
    wom,
    news,
    ghostling,
    worlds,
    discord,
    recentGrantCount,
  };
}

export async function adminOverviewPayload(): Promise<AdminOverviewData> {
  const actor = await requireAdminUser();
  const shared = await buildSharedAdminState(actor);
  const rewardsSummary = rewardsSectionSummary({
    activeGiveaways: shared.giveaways.filter((giveaway) => giveaway.status === 'active').length,
    scheduledGiveaways: shared.giveaways.filter((giveaway) => giveaway.status === 'scheduled').length,
    trackedUsers: shared.users.trackedUsers,
    recentGrantCount: shared.recentGrantCount,
  });
  const contentSummary = contentSectionSummary(shared.news);
  const systemsSummary = systemsSectionSummary({
    wom: shared.wom,
    discord: shared.discord,
  });
  const worldsSummary = worldsSectionSummary(shared.worlds);
  const ghostlingSummary = ghostlingSectionSummary(shared.ghostling);

  return {
    actor: { displayName: displayName(actor) },
    overview: {
      users: shared.users.rows,
      giveaways: shared.giveaways.map((giveaway) => ({
        id: giveaway.id,
        title: giveaway.title,
        status: giveaway.status,
      })),
      wom: shared.wom,
      newsCount: shared.news.publishedCount + shared.news.draftCount,
    },
    alerts: buildAdminAlerts({
      wom: shared.wom,
      discord: shared.discord,
    }),
    sectionSummaries: [
      rewardsSummary,
      contentSummary,
      systemsSummary,
      worldsSummary,
      ghostlingSummary,
    ],
    quickActionReferenceData: {
      roles: shared.roles,
    },
    recentAudit: buildAdminAuditFeed(8),
  };
}

export async function discordRolesPayload() {
  return {
    roles: await adminRoleOptionsPayload(),
  };
}

const DISCORD_VOICE_CHANNEL_TYPE = 2;
const DISCORD_STAGE_CHANNEL_TYPE = 13;
const DISCORD_ADMIN_MODULES = [
  { key: 'voicePresence', label: 'Voice presence' },
] as const;

type DiscordGuildChannelPayload = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
};

function normalizeDiscordPresenceChannelType(value: unknown): DiscordPresenceChannelType | null {
  const numericType = Number(value);
  if (numericType === DISCORD_VOICE_CHANNEL_TYPE) return 'voice';
  if (numericType === DISCORD_STAGE_CHANNEL_TYPE) return 'stage';
  return null;
}

function discordAdminHeaders(botToken: string) {
  return {
    Accept: 'application/json',
    Authorization: `Bot ${botToken}`,
    'User-Agent': 'GhostedNext/1.0',
  };
}

async function fetchDiscordPresenceGuildChannels(config = buildRuntimeAuthConfig()) {
  if (!config.guildId || !config.botToken) {
    return {
      channels: [] as DiscordPresenceAdminChannel[],
      error: 'Discord guild sync is not configured yet.',
    };
  }

  try {
    const response = await fetch(`https://discord.com/api/guilds/${config.guildId}/channels`, {
      headers: discordAdminHeaders(config.botToken),
      cache: 'no-store',
    });

    if (!response.ok) {
      const rawBody = await response.text().catch(() => '');
      const body = rawBody.trim();
      if (response.status === 401 || response.status === 403) {
        return {
          channels: [] as DiscordPresenceAdminChannel[],
          error: 'Discord rejected the bot token or channel lookup permissions. Check the bot install and gateway settings.',
        };
      }
      if (response.status === 404) {
        return {
          channels: [] as DiscordPresenceAdminChannel[],
          error: 'The configured Discord guild could not be found for channel management.',
        };
      }
      return {
        channels: [] as DiscordPresenceAdminChannel[],
        error: body
          ? `Discord channel lookup failed: ${body}`
          : `Discord channel lookup failed with HTTP ${response.status}.`,
      };
    }

    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload)) {
      return {
        channels: [] as DiscordPresenceAdminChannel[],
        error: 'Discord returned an unexpected guild channel payload.',
      };
    }

    const channels: DiscordPresenceAdminChannel[] = [];
    for (const entry of payload) {
      const channel = entry as DiscordGuildChannelPayload;
      const id = String(channel.id ?? '').trim();
      const name = String(channel.name ?? '').trim();
      const type = normalizeDiscordPresenceChannelType(channel.type);
      if (!id || !name || !type) continue;
      channels.push({
        id,
        name,
        type,
        selected: false,
      });
    }

    channels.sort((left, right) => {
      const typeCompare = left.type.localeCompare(right.type);
      if (typeCompare !== 0) return typeCompare;
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });

    return {
      channels,
      error: null,
    };
  } catch {
    return {
      channels: [] as DiscordPresenceAdminChannel[],
      error: 'Discord guild channel lookup failed. Check the bot install and local network access.',
    };
  }
}

function resolveDiscordPresencePublicMode(worker: DiscordPresenceWorkerSummary) {
  return worker.health === 'healthy' ? 'bot' : 'widget';
}

function withSelectedChannels(
  channels: DiscordPresenceAdminChannel[],
  selectedIds: Set<string>,
) {
  return channels.map((channel) => ({
    ...channel,
    selected: selectedIds.has(channel.id),
  }));
}

async function buildDiscordPresenceAdminData(actorOverride?: Awaited<ReturnType<typeof requireAdminUser>>): Promise<DiscordPresenceAdminData> {
  const db = getDatabase();
  const actor = actorOverride ?? await requireAdminUser();
  const runtimeConfig = buildRuntimeAuthConfig();
  const worker = getDiscordPresenceWorkerSummary(db);
  const allowlist = listScenePresenceChannelAllowlist(db, runtimeConfig.guildId ?? worker.guildId);
  const selectedIds = new Set(allowlist.map((entry) => entry.channelId));
  const channelLookup = await fetchDiscordPresenceGuildChannels(runtimeConfig);

  return {
    actor: { displayName: displayName(actor) },
    guild: {
      id: runtimeConfig.guildId ?? worker.guildId,
      configured: Boolean(runtimeConfig.guildId || worker.guildId),
      ready: Boolean(runtimeConfig.guildId && runtimeConfig.botToken),
    },
    publicMode: resolveDiscordPresencePublicMode(worker),
    worker: {
      ...worker,
      activeModules: DISCORD_ADMIN_MODULES.map((module) => ({
        ...module,
        enabled: worker.configured,
      })),
    },
    channels: withSelectedChannels(channelLookup.channels, selectedIds),
    allowlist,
    channelFetchError: channelLookup.error,
  };
}

export async function discordPresenceAdminPayload() {
  return buildDiscordPresenceAdminData();
}

export async function adminRewardsPayload(): Promise<AdminRewardsData> {
  const actor = await requireAdminUser();
  const [roles, giveaways, discord] = await Promise.all([
    adminRoleOptionsPayload(),
    adminGiveawayRows(),
    buildDiscordPresenceAdminData(actor),
  ]);
  const users = adminUsersWithBalances(20);
  const wom = adminWomSummary();
  const recentGrantCount = countAuditActions(['grant_points'], new Date(Date.now() - 24 * 60 * 60 * 1000));

  return {
    actor: { displayName: displayName(actor) },
    alerts: buildAdminAlerts({ wom, discord }),
    sectionSummary: rewardsSectionSummary({
      activeGiveaways: giveaways.filter((giveaway) => giveaway.status === 'active').length,
      scheduledGiveaways: giveaways.filter((giveaway) => giveaway.status === 'scheduled').length,
      trackedUsers: users.trackedUsers,
      recentGrantCount,
    }),
    stats: {
      trackedUsers: users.trackedUsers,
      adminUsers: users.adminUsers,
      activeGiveaways: giveaways.filter((giveaway) => giveaway.status === 'active').length,
      scheduledGiveaways: giveaways.filter((giveaway) => giveaway.status === 'scheduled').length,
      recentGrantCount,
    },
    roles,
    users: users.rows,
    giveaways,
    recentAudit: buildAdminAuditFeed(8, ['rewards']),
  };
}

export async function adminContentPayload(): Promise<AdminContentData> {
  const actor = await requireAdminUser();
  const [discord] = await Promise.all([
    buildDiscordPresenceAdminData(actor),
  ]);
  const wom = adminWomSummary();
  const posts = listNewsPosts(true, 24);
  const news = adminNewsCounts();

  return {
    actor: { displayName: displayName(actor) },
    alerts: buildAdminAlerts({ wom, discord }),
    sectionSummary: contentSectionSummary(news),
    stats: news,
    posts,
    recentAudit: buildAdminAuditFeed(8, ['content']),
  };
}

export async function adminSystemsPayload(): Promise<AdminSystemsData> {
  const actor = await requireAdminUser();
  const discord = await buildDiscordPresenceAdminData(actor);
  const wom = adminWomSummary();

  return {
    actor: { displayName: displayName(actor) },
    alerts: buildAdminAlerts({ wom, discord }),
    sectionSummary: systemsSectionSummary({ wom, discord }),
    wom,
    discord,
    recentAudit: buildAdminAuditFeed(8, ['systems']),
  };
}

export async function saveDiscordPresenceAllowlist(request: Request) {
  const db = getDatabase();
  const actor = await requireAdminUser();
  const config = buildRuntimeAuthConfig();
  const guildId = String(config.guildId ?? '').trim();
  if (!guildId) {
    throw new AppError('Discord guild sync is not configured yet.', 400);
  }

  const payload = await readJsonBody<Record<string, unknown>>(request);
  const requestedChannelIds = Array.isArray(payload.channelIds)
    ? payload.channelIds.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];

  const channelLookup = await fetchDiscordPresenceGuildChannels(config);
  if (channelLookup.error) {
    throw new AppError(channelLookup.error, 400);
  }

  const channelDirectory = new Map(channelLookup.channels.map((channel) => [channel.id, channel]));
  const invalidIds = requestedChannelIds.filter((channelId) => !channelDirectory.has(channelId));
  if (invalidIds.length > 0) {
    throw new AppError(`Unknown Discord voice or stage channels: ${invalidIds.join(', ')}`, 400);
  }

  replaceScenePresenceChannelAllowlist(
    db,
    guildId,
    requestedChannelIds.map((channelId) => {
      const channel = channelDirectory.get(channelId);
      if (!channel) {
        throw new AppError(`Unknown Discord voice or stage channel: ${channelId}`, 400);
      }
      return {
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
      };
    }),
  );

  recordAudit(actor.id, 'update_scene_presence_allowlist', 'discord_guild', guildId, {
    channelIds: requestedChannelIds,
  });

  return buildDiscordPresenceAdminData(actor);
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
