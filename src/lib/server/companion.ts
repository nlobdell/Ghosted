import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { resolveGhostlingActorMetrics } from '@/lib/ghostling-actor';
import type {
  AdminAuditEntry,
  CompanionActorMetrics,
  CompanionAdminData,
  CompanionData,
  CompanionItem,
  CompanionPreviewSummary,
  CompanionSlotKey,
  HallCompanionSummary,
} from '@/lib/types';
import { recordAudit } from '@/lib/server/audit';
import { AppError, slugify, utcIso } from '@/lib/server/core';
import { primaryOsrsIdentityJoin, primaryOsrsIdentitySelect, resolvePublicDisplayName } from '@/lib/server/osrs-identity';
import {
  COMPANION_LOADOUT_COLUMNS,
  COMPANION_SLOT_LABELS,
  COMPANION_SLOT_ORDER,
  companionAssetPath,
  companionAssetUrl,
  companionRenderManifest,
  companionAssetDir,
  companionStoredItemRenderMetadata,
  normalizeCompanionAssetPath,
  parseCompanionItemRenderMetadata,
  readMultipartFormData,
  repoCompanionAssetDir,
  repoCompanionImportCandidates,
  resolveCompanionBaseConfig,
  storeUploadedCompanionAsset,
  uploadedCompanionAssetFromFormData,
  type UploadedCompanionAsset,
} from '@/lib/server/companion-storage';
import { appendRewardLedger, getBalance } from '@/lib/server/rewards';

export type CompanionUserRow = {
  id: number;
  username: string;
  global_name: string | null;
  public_name_source?: string | null;
  osrs_player_id?: number | null;
  osrs_username?: string | null;
  osrs_display_name?: string | null;
  osrs_claim_source?: string | null;
  osrs_claimed_at?: string | null;
  osrs_verified_at?: string | null;
};

export type CompanionUserRefRow = CompanionUserRow & {
  discord_id: string;
};

type CompanionCatalogRow = {
  slug: string;
  name: string;
  slot_key: CompanionSlotKey;
  rarity: string;
  cost: number;
  description: string;
  front_asset_path: string | null;
  back_asset_path: string | null;
  render_metadata_json: string | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
};

type CompanionLoadoutRow = {
  hat_item_slug: string | null;
  face_item_slug: string | null;
  neck_item_slug: string | null;
  body_item_slug: string | null;
  updated_at?: string | null;
};

type RepoCompanionImportInput = {
  slug?: string;
  name?: string;
  slot?: string;
  rarity?: string;
  cost?: number | string;
  description?: string;
  active?: boolean;
  frontAssetPath?: string | null;
  backAssetPath?: string | null;
  renderMetadataPath?: string | null;
};

const companionActorMetricsCache = new Map<string, CompanionActorMetrics>();

const COMPANION_ADMIN_AUDIT_ACTIONS = [
  'upload_companion_base_asset',
  'create_companion_item',
  'update_companion_item',
  'replace_companion_item_assets',
  'import_repo_companion_items',
  'set_companion_item_active',
  'reorder_companion_item',
  'archive_companion_item',
  'restore_companion_item',
  'delete_companion_item',
] as const;

function companionDisplayName(user: CompanionUserRow) {
  return resolvePublicDisplayName(user);
}

function emptyCompanionLoadout() {
  return Object.fromEntries(COMPANION_SLOT_ORDER.map((slot) => [slot, null])) as Record<CompanionSlotKey, string | null>;
}

export function getCompanionUserByRef(db: Database, userRef: string) {
  const normalizedRef = String(userRef ?? '').trim();
  if (!normalizedRef) return null;

  if (/^\d+$/.test(normalizedRef)) {
    return db.prepare(`
      SELECT
        users.id,
        users.discord_id,
        users.username,
        users.global_name,
        ${primaryOsrsIdentitySelect('users')}
      FROM users
      ${primaryOsrsIdentityJoin('users')}
      WHERE users.id = ?
    `).get(Number(normalizedRef)) as CompanionUserRefRow | undefined;
  }

  return db.prepare(`
    SELECT
      users.id,
      users.discord_id,
      users.username,
      users.global_name,
      ${primaryOsrsIdentitySelect('users')}
    FROM users
    ${primaryOsrsIdentityJoin('users')}
    WHERE users.discord_id = ?
  `).get(normalizedRef) as CompanionUserRefRow | undefined;
}

export function ensureUserCompanionLoadout(db: Database, userId: number) {
  db.prepare(`
    INSERT OR IGNORE INTO user_companion_loadout (
      user_id, hat_item_slug, face_item_slug, neck_item_slug, body_item_slug, updated_at
    )
    VALUES (?, NULL, NULL, NULL, NULL, ?)
  `).run(userId, utcIso());
}

export function companionInventorySlugs(db: Database, userId: number) {
  const rows = db.prepare(`
    SELECT item_slug
    FROM user_companion_inventory
    WHERE user_id = ?
  `).all(userId) as Array<{ item_slug: string }>;
  return new Set(rows.map((row) => String(row.item_slug)));
}

export function companionCatalogRows(db: Database, activeOnly = true) {
  const visibility = activeOnly ? 'WHERE active = 1 AND archived_at IS NULL' : '';
  return db.prepare(`
    SELECT slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, render_metadata_json, active, sort_order, created_at, updated_at, archived_at, archived_by_user_id
    FROM companion_catalog
    ${visibility}
    ORDER BY slot_key ASC, sort_order ASC, name ASC
  `).all() as CompanionCatalogRow[];
}

export function companionCatalogMap(db: Database, activeOnly = false) {
  return new Map(companionCatalogRows(db, activeOnly).map((row) => [row.slug, row]));
}

export function companionCatalogRow(db: Database, slug: string) {
  return db.prepare(`
    SELECT *
    FROM companion_catalog
    WHERE slug = ? AND active = 1 AND archived_at IS NULL
  `).get(slug) as CompanionCatalogRow | undefined;
}

export function companionCatalogAnyRow(db: Database, slug: string) {
  return db.prepare(`
    SELECT *
    FROM companion_catalog
    WHERE slug = ?
  `).get(slug) as CompanionCatalogRow | undefined;
}

export function nextCompanionSortOrder(db: Database, slotKey: CompanionSlotKey) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) AS value
    FROM companion_catalog
    WHERE slot_key = ? AND archived_at IS NULL
  `).get(slotKey) as { value: number };
  return Number(row.value ?? 0) + 10;
}

export function companionLoadoutMap(db: Database, userId: number): Record<CompanionSlotKey, string | null> {
  ensureUserCompanionLoadout(db, userId);
  const row = db.prepare(`
    SELECT hat_item_slug, face_item_slug, neck_item_slug, body_item_slug
    FROM user_companion_loadout
    WHERE user_id = ?
  `).get(userId) as CompanionLoadoutRow | undefined;

  return {
    hat: row?.hat_item_slug ?? null,
    face: row?.face_item_slug ?? null,
    neck: row?.neck_item_slug ?? null,
    body: row?.body_item_slug ?? null,
  };
}

function companionShareVersionQuery(db: Database, userId: number) {
  ensureUserCompanionLoadout(db, userId);
  const row = db.prepare(`
    SELECT updated_at
    FROM user_companion_loadout
    WHERE user_id = ?
  `).get(userId) as Pick<CompanionLoadoutRow, 'updated_at'> | undefined;

  return row?.updated_at
    ? `&v=${encodeURIComponent(row.updated_at)}`
    : '';
}

function companionSlotOptions(
  catalogRows: CompanionCatalogRow[],
  ownedSlugs: Set<string>,
  slot: CompanionSlotKey,
) {
  return catalogRows
    .filter((row) => row.slot_key === slot && ownedSlugs.has(row.slug))
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      rarity: row.rarity,
      cost: Number(row.cost),
    }));
}

function companionItemIsArchived(row: Pick<CompanionCatalogRow, 'archived_at'>) {
  return Boolean(String(row.archived_at ?? '').trim());
}

function companionItemState(row: Pick<CompanionCatalogRow, 'active' | 'archived_at'>): 'visible' | 'hidden' | 'archived' {
  if (companionItemIsArchived(row)) return 'archived';
  return Boolean(row.active) ? 'visible' : 'hidden';
}

function visibleCompanionCatalogRows(
  catalogRows: CompanionCatalogRow[],
  ownedSlugs: Set<string>,
  loadout: Record<CompanionSlotKey, string | null>,
) {
  return catalogRows.filter((row) => (
    (Boolean(row.active) && !companionItemIsArchived(row))
    || ownedSlugs.has(row.slug)
    || loadout[row.slot_key] === row.slug
  ));
}

function companionItemPayload(
  row: CompanionCatalogRow,
  ownedSlugs: Set<string>,
  loadout: Record<CompanionSlotKey, string | null>,
): CompanionItem {
  return {
    slug: row.slug,
    name: row.name,
    slot: row.slot_key,
    slotLabel: COMPANION_SLOT_LABELS[row.slot_key],
    rarity: row.rarity,
    cost: Number(row.cost),
    description: row.description,
    active: Boolean(row.active) && !companionItemIsArchived(row),
    archived: companionItemIsArchived(row),
    owned: ownedSlugs.has(row.slug),
    equipped: loadout[row.slot_key] === row.slug,
    previewUrl: `/api/companion/render-animated?preview=${encodeURIComponent(row.slug)}`,
    frontAssetUrl: companionAssetUrl(row.front_asset_path),
    backAssetUrl: companionAssetUrl(row.back_asset_path),
    renderMetadata: companionStoredItemRenderMetadata(
      row.render_metadata_json,
      row.slot_key,
      row.front_asset_path,
      row.back_asset_path,
    ),
  };
}

function companionAuditActionLabel(action: string) {
  switch (action) {
    case 'upload_companion_base_asset':
      return 'Upload base files';
    case 'create_companion_item':
      return 'Create cosmetic';
    case 'update_companion_item':
      return 'Edit cosmetic';
    case 'replace_companion_item_assets':
      return 'Replace cosmetic files';
    case 'import_repo_companion_items':
      return 'Import repo cosmetics';
    case 'set_companion_item_active':
      return 'Update visibility';
    case 'reorder_companion_item':
      return 'Reorder catalog';
    case 'archive_companion_item':
      return 'Archive cosmetic';
    case 'restore_companion_item':
      return 'Restore cosmetic';
    case 'delete_companion_item':
      return 'Delete cosmetic';
    default:
      return action.replaceAll('_', ' ');
  }
}

function companionAuditSummary(action: string, targetId: string, payloadJson: string) {
  let payload: Record<string, unknown> = {};
  try {
    payload = payloadJson ? JSON.parse(payloadJson) as Record<string, unknown> : {};
  } catch {
    payload = {};
  }

  switch (action) {
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
    case 'delete_companion_item': {
      const inventoryPurged = Number(payload.inventoryPurged ?? 0);
      const loadoutCleared = Number(payload.loadoutCleared ?? 0);
      return `Permanently deleted archived Ghostling item "${targetId}" and cleared ${inventoryPurged} ownership ${inventoryPurged === 1 ? 'entry' : 'entries'} plus ${loadoutCleared} equipped ${loadoutCleared === 1 ? 'slot' : 'slots'}.`;
    }
    default:
      return `${companionAuditActionLabel(action)} on ${targetId}.`;
  }
}

function recentCompanionAuditFeed(db: Database, limit = 8): AdminAuditEntry[] {
  const placeholders = COMPANION_ADMIN_AUDIT_ACTIONS.map(() => '?').join(', ');
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
    WHERE audit_log.action IN (${placeholders})
    ORDER BY audit_log.created_at DESC, audit_log.id DESC
    LIMIT ?
  `).all(...COMPANION_ADMIN_AUDIT_ACTIONS, Math.max(1, Math.min(limit, 20))) as Array<{
    id: number;
    action: string;
    target_type: string;
    target_id: string;
    payload_json: string;
    created_at: string;
    actor_username: string | null;
    actor_global_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actionLabel: companionAuditActionLabel(row.action),
    section: 'ghostling',
    targetType: row.target_type,
    targetId: row.target_id,
    actorDisplayName: row.actor_global_name || row.actor_username || 'System',
    createdAt: row.created_at,
    summary: companionAuditSummary(row.action, row.target_id, row.payload_json),
  }));
}

function companionPreviewUser(user: CompanionUserRow | null | undefined) {
  if (!user) return null;
  return {
    displayName: companionDisplayName(user),
    username: user.username,
  };
}

function companionActorMetricsCacheKey(animatedRenderUrl: string, manifest: CompanionPreviewSummary['renderManifest']) {
  const debugActorMetrics = manifest.debug?.actorMetrics
    ? JSON.stringify(manifest.debug.actorMetrics)
    : '';
  const layerSignature = manifest.layers
    .map((layer) => {
      const sliceSignature = (layer.slices ?? [])
        .map((slice) => (
          `${slice.key}:${slice.targetX},${slice.targetY},${slice.targetWidth},${slice.targetHeight}`
        ))
        .join(';');
      return `${layer.key}:${layer.src}:${layer.zIndex}:${layer.slot ?? ''}:${layer.motionGroup ?? ''}:${sliceSignature}`;
    })
    .join('|');
  return `${animatedRenderUrl}|${manifest.width}x${manifest.height}|${debugActorMetrics}|${layerSignature}`;
}

function companionActorMetrics(manifest: CompanionPreviewSummary['renderManifest'], animatedRenderUrl: string) {
  const cacheKey = companionActorMetricsCacheKey(animatedRenderUrl, manifest);
  const cached = companionActorMetricsCache.get(cacheKey);
  if (cached) return cached;

  const resolved = resolveGhostlingActorMetrics(manifest);
  const actorMetrics = {
    sourceWidth: resolved.sourceWidth,
    sourceHeight: resolved.sourceHeight,
    visibleBounds: resolved.visibleBounds,
    footprintBounds: resolved.footprintBounds,
    feetAnchor: resolved.feetAnchor,
  } satisfies CompanionActorMetrics;
  companionActorMetricsCache.set(cacheKey, actorMetrics);
  return actorMetrics;
}

function buildCompanionPreviewSummary(
  db: Database,
  options: {
    user: CompanionUserRow | null;
    loadout: Record<CompanionSlotKey, string | null>;
    renderUrl: string;
    animatedRenderUrl: string;
  },
) {
  const renderManifest = companionRenderManifest(db, options.loadout);
  return {
    user: companionPreviewUser(options.user),
    renderUrl: options.renderUrl,
    animatedRenderUrl: options.animatedRenderUrl,
    renderManifest,
    actorMetrics: companionActorMetrics(renderManifest, options.animatedRenderUrl),
  } satisfies CompanionPreviewSummary;
}

export function buildCompanionPayload(db: Database, user: CompanionUserRow): CompanionData {
  const catalogRows = companionCatalogRows(db, false);
  const ownedSlugs = companionInventorySlugs(db, user.id);
  const loadout = companionLoadoutMap(db, user.id);
  const baseConfig = resolveCompanionBaseConfig(db);
  const visibleRows = visibleCompanionCatalogRows(catalogRows, ownedSlugs, loadout);
  const equippedCount = COMPANION_SLOT_ORDER.filter((slot) => Boolean(loadout[slot])).length;
  const animatedRenderUrl = `/api/companion/render-animated?user=${user.id}`;
  const animatedCardUrl = `/api/companion/render-animated?user=${user.id}&card=1`;
  const discordCardUrl = `/api/companion/render?user=${user.id}&card=1&discord=1`;
  const animatedDiscordCardUrl = `/api/companion/render-animated?user=${user.id}&card=1&discord=1`;
  const shareVersionQuery = companionShareVersionQuery(db, user.id);
  const animatedDiscordEmbedUrl = `/api/companion/render-discord-animated.gif?user=${user.id}${shareVersionQuery}`;

  return {
    user: {
      id: user.id,
      displayName: companionDisplayName(user),
      username: user.username,
    },
    balance: getBalance(db, user.id),
    ownedCount: ownedSlugs.size,
    equippedCount,
    loadout,
    slots: COMPANION_SLOT_ORDER.map((slot) => ({
      key: slot,
      label: COMPANION_SLOT_LABELS[slot],
      equippedSlug: loadout[slot],
      ownedOptions: companionSlotOptions(catalogRows, ownedSlugs, slot),
    })),
    items: visibleRows.map((row) => companionItemPayload(row, ownedSlugs, loadout)),
    renderUrl: `/api/companion/render?user=${user.id}`,
    animatedRenderUrl,
    cardUrl: `/api/companion/render?user=${user.id}&card=1`,
    animatedCardUrl,
    renderManifest: companionRenderManifest(db, loadout),
    share: {
      avatarUrl: `/api/companion/render?user=${user.id}`,
      animatedAvatarUrl: animatedRenderUrl,
      cardUrl: `/api/companion/render?user=${user.id}&card=1`,
      animatedCardUrl,
      discordCardUrl,
      animatedDiscordCardUrl,
      animatedDiscordEmbedUrl,
    },
    baseAssetUrl: baseConfig.bodyAssetUrl,
  };
}

export function buildCompanionPreviewSummaryPayload(db: Database, user: CompanionUserRow): CompanionPreviewSummary {
  return buildCompanionPreviewSummary(db, {
    user,
    loadout: companionLoadoutMap(db, user.id),
    renderUrl: `/api/companion/render?user=${user.id}`,
    animatedRenderUrl: `/api/companion/render-animated?user=${user.id}`,
  });
}

export function buildCompanionPreviewSummaryOrBasePayload(
  db: Database,
  user: CompanionUserRow | null | undefined,
  fallbackPreview?: CompanionPreviewSummary,
): CompanionPreviewSummary {
  if (user) {
    return buildCompanionPreviewSummaryPayload(db, user);
  }

  return fallbackPreview ?? buildHouseCompanionPreviewSummaryPayload(db);
}

export function buildHouseCompanionPreviewSummaryPayload(db: Database): CompanionPreviewSummary {
  return buildCompanionPreviewSummary(db, {
    user: null,
    loadout: emptyCompanionLoadout(),
    renderUrl: '/api/companion/render?base=1',
    animatedRenderUrl: '/api/companion/render-animated?base=1',
  });
}

export function buildHallCompanionSummaryPayload(db: Database, user: CompanionUserRow): HallCompanionSummary {
  const ownedSlugs = companionInventorySlugs(db, user.id);
  const loadout = companionLoadoutMap(db, user.id);
  const equippedCount = COMPANION_SLOT_ORDER.filter((slot) => Boolean(loadout[slot])).length;
  const animatedRenderUrl = `/api/companion/render-animated?user=${user.id}`;
  const preview = buildCompanionPreviewSummary(db, {
    user,
    loadout,
    renderUrl: `/api/companion/render?user=${user.id}`,
    animatedRenderUrl,
  });

  return {
    ...preview,
    user: companionPreviewUser(user)!,
    balance: getBalance(db, user.id),
    ownedCount: ownedSlugs.size,
    equippedCount,
  };
}

export function buildCompanionAdminPayload(db: Database): CompanionAdminData {
  const baseConfig = resolveCompanionBaseConfig(db);
  const rows = companionCatalogRows(db, false);
  const archivedByUserIds = [...new Set(
    rows
      .map((row) => row.archived_by_user_id)
      .filter((value): value is number => Number.isInteger(value) && Number(value) > 0),
  )];
  const archivedByMap = archivedByUserIds.length
    ? new Map((db.prepare(`
      SELECT id, username, global_name
      FROM users
      WHERE id IN (${archivedByUserIds.map(() => '?').join(', ')})
    `).all(...archivedByUserIds) as Array<{ id: number; username: string; global_name: string | null }>)
      .map((row) => [row.id, row.global_name || row.username]))
    : new Map<number, string>();
  const baseRow = db.prepare(`
    SELECT updated_at
    FROM companion_settings
    WHERE singleton_key = 'default'
  `).get() as { updated_at: string | null } | undefined;
  const adminItems = rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    slot: row.slot_key,
    rarity: row.rarity,
    cost: Number(row.cost),
    description: row.description,
    active: Boolean(row.active) && !companionItemIsArchived(row),
    archived: companionItemIsArchived(row),
    state: companionItemState(row),
    sortOrder: Number(row.sort_order ?? 0),
    frontAssetPath: row.front_asset_path,
    frontAssetUrl: companionAssetUrl(row.front_asset_path),
    backAssetPath: row.back_asset_path,
    backAssetUrl: companionAssetUrl(row.back_asset_path),
    renderMetadata: companionStoredItemRenderMetadata(
      row.render_metadata_json,
      row.slot_key,
      row.front_asset_path,
      row.back_asset_path,
    ),
    previewUrl: `/api/companion/render-animated?preview=${encodeURIComponent(row.slug)}`,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    archivedByDisplayName: row.archived_by_user_id ? archivedByMap.get(row.archived_by_user_id) ?? null : null,
  }));

  return {
    storageRoot: companionAssetDir(),
    defaultAssetRoot: repoCompanionAssetDir(),
    base: {
      assetPath: baseConfig.bodyAssetPath,
      assetUrl: baseConfig.bodyAssetUrl,
      bodyAssetPath: baseConfig.bodyAssetPath,
      bodyAssetUrl: baseConfig.bodyAssetUrl,
      headAssetPath: baseConfig.headAssetPath,
      headAssetUrl: baseConfig.headAssetUrl,
      previewUrl: baseConfig.animatedRenderUrl,
      updatedAt: baseRow?.updated_at ?? null,
      renderManifest: companionRenderManifest(db, emptyCompanionLoadout()),
    },
    items: adminItems.filter((row) => !row.archived),
    archivedItems: adminItems
      .filter((row) => row.archived)
      .sort((left, right) => (
        String(right.archivedAt ?? '').localeCompare(String(left.archivedAt ?? ''))
        || left.slot.localeCompare(right.slot)
        || left.sortOrder - right.sortOrder
        || left.name.localeCompare(right.name)
      )),
    repoCandidates: repoCompanionImportCandidates(db),
    recentAudit: recentCompanionAuditFeed(db),
  };
}

function normalizeCompanionSlotOrder(db: Database, slotKey: CompanionSlotKey, orderedSlugs: string[]) {
  for (const [index, slug] of orderedSlugs.entries()) {
    db.prepare('UPDATE companion_catalog SET sort_order = ?, updated_at = ? WHERE slug = ?').run((index + 1) * 10, utcIso(), slug);
  }
}

function normalizeCompanionRarity(rarity: string) {
  const normalized = String(rarity ?? '').trim().toLowerCase() || 'common';
  if (!['common', 'rare', 'epic', 'legendary'].includes(normalized)) {
    throw new AppError('Choose a rarity of common, rare, epic, or legendary.', 400);
  }
  return normalized;
}

function normalizeCompanionItemMetadataJson(
  metadataJson: string | null | undefined,
  options: {
    slot: CompanionSlotKey;
    frontAssetPresent: boolean;
    backAssetPresent: boolean;
  },
) {
  const metadata = parseCompanionItemRenderMetadata(metadataJson, {
    expectedSlot: options.slot,
    frontAssetPresent: options.frontAssetPresent,
    backAssetPresent: options.backAssetPresent,
  });
  return metadata ? JSON.stringify(metadata) : null;
}

async function metadataTextFromFormData(formData: FormData, fieldName = 'metadata') {
  const entry = formData.get(fieldName);
  if (entry == null) return null;
  if (entry instanceof File) {
    const text = (await entry.text()).trim();
    return text || null;
  }
  const value = String(entry ?? '').trim();
  return value || null;
}

function repoMetadataPathForItemAssets(
  frontAssetPath: string | null | undefined,
  backAssetPath: string | null | undefined,
  explicitPath?: string | null,
) {
  const rawExplicitPath = String(explicitPath ?? '').trim();
  if (rawExplicitPath) {
    const metadataPath = normalizeCompanionAssetPath(rawExplicitPath);
    if (!metadataPath.startsWith('repo/defaults/items/') || !metadataPath.endsWith('.ghostling.json')) {
      throw new AppError('Repo metadata files must live in repo/defaults/items and end with .ghostling.json.', 400);
    }
    if (!companionFileExists(metadataPath)) {
      throw new AppError('Repo Ghostling metadata file could not be found.', 404);
    }
    return metadataPath;
  }

  const anchorAssetPath = String(frontAssetPath || backAssetPath || '').trim();
  if (!anchorAssetPath) return null;
  const normalizedAssetPath = normalizeCompanionAssetPath(anchorAssetPath);
  const assetName = path.basename(normalizedAssetPath);
  const title = path.parse(assetName).name.replace(/-(front|back)$/i, '');
  const metadataPath = `repo/defaults/items/${title}.ghostling.json`;
  return companionFileExists(metadataPath) ? metadataPath : null;
}

function repoMetadataJsonForImport(
  slot: CompanionSlotKey,
  frontAssetPath: string | null | undefined,
  backAssetPath: string | null | undefined,
  explicitPath?: string | null,
) {
  const metadataPath = repoMetadataPathForItemAssets(frontAssetPath, backAssetPath, explicitPath);
  if (!metadataPath) return { metadataPath: null, metadataJson: null };

  const metadataJson = fs.readFileSync(companionAssetPath(metadataPath), 'utf8');
  return {
    metadataPath,
    metadataJson: normalizeCompanionItemMetadataJson(metadataJson, {
      slot,
      frontAssetPresent: Boolean(frontAssetPath),
      backAssetPresent: Boolean(backAssetPath),
    }),
  };
}

export function purchaseCompanionItem(db: Database, user: CompanionUserRow, slug: string) {
  const item = companionCatalogRow(db, slug);
  if (!item) {
    const archivedItem = companionCatalogAnyRow(db, slug);
    if (archivedItem && companionItemIsArchived(archivedItem)) {
      throw new AppError('That companion cosmetic is archived and cannot be unlocked right now.', 400);
    }
    throw new AppError('That companion item does not exist.', 404);
  }

  const ownedSlugs = companionInventorySlugs(db, user.id);
  if (ownedSlugs.has(slug)) {
    throw new AppError('You already unlocked that companion cosmetic.', 400);
  }

  const cost = Number(item.cost);
  if (getBalance(db, user.id) < cost) {
    throw new AppError('You do not have enough points to unlock that cosmetic.', 400);
  }

  const transaction = db.transaction(() => {
    if (cost > 0) {
      appendRewardLedger(
        db,
        user.id,
        -cost,
        'companion_purchase',
        `Unlocked companion cosmetic: ${item.name}.`,
        { item_slug: slug, slot: item.slot_key, cost },
      );
    }

    db.prepare(`
      INSERT INTO user_companion_inventory (user_id, item_slug, unlocked_at)
      VALUES (?, ?, ?)
    `).run(user.id, slug, utcIso());

    ensureUserCompanionLoadout(db, user.id);
    const column = COMPANION_LOADOUT_COLUMNS[item.slot_key];
    const current = db.prepare(`
      SELECT ${column} AS equipped_slug
      FROM user_companion_loadout
      WHERE user_id = ?
    `).get(user.id) as { equipped_slug: string | null } | undefined;
    if (!current?.equipped_slug) {
      db.prepare(`
        UPDATE user_companion_loadout
        SET ${column} = ?, updated_at = ?
        WHERE user_id = ?
      `).run(slug, utcIso(), user.id);
    }
  });

  transaction();
  return buildCompanionPayload(db, user);
}

export function equipCompanionItem(
  db: Database,
  user: CompanionUserRow,
  slot: string,
  slug: string | null,
) {
  const normalizedSlot = String(slot ?? '').trim().toLowerCase();
  if (!COMPANION_SLOT_ORDER.includes(normalizedSlot as CompanionSlotKey)) {
    throw new AppError('That companion slot is invalid.', 400);
  }

  const slotKey = normalizedSlot as CompanionSlotKey;
  ensureUserCompanionLoadout(db, user.id);
  let nextSlug: string | null = null;

  if (slug) {
    const item = companionCatalogAnyRow(db, slug);
    if (!item) {
      throw new AppError('That companion item does not exist.', 404);
    }
    if (item.slot_key !== slotKey) {
      throw new AppError('That cosmetic does not fit the selected slot.', 400);
    }
    if (!companionInventorySlugs(db, user.id).has(slug)) {
      throw new AppError('Unlock the cosmetic before equipping it.', 400);
    }
    nextSlug = slug;
  }

  const column = COMPANION_LOADOUT_COLUMNS[slotKey];
  db.prepare(`
    UPDATE user_companion_loadout
    SET ${column} = ?, updated_at = ?
    WHERE user_id = ?
  `).run(nextSlug, utcIso(), user.id);

  return buildCompanionPayload(db, user);
}

export function setCompanionItemActive(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
  active: boolean,
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (companionItemIsArchived(item)) {
    throw new AppError('Restore the archived cosmetic before changing its visibility.', 400);
  }

  db.prepare('UPDATE companion_catalog SET active = ?, updated_at = ? WHERE slug = ?').run(active ? 1 : 0, utcIso(), slug);
  recordAudit(actor.id, 'set_companion_item_active', 'companion_catalog', slug, { active: Boolean(active) });
  return buildCompanionAdminPayload(db);
}

export function reorderCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
  direction: string,
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (companionItemIsArchived(item)) {
    throw new AppError('Restore the archived cosmetic before changing its live order.', 400);
  }

  const normalizedDirection = String(direction ?? '').trim().toLowerCase();
  if (!['up', 'down'].includes(normalizedDirection)) {
    throw new AppError('Pick a reorder direction of up or down.', 400);
  }

  const orderedSlugs = companionCatalogRows(db, false)
    .filter((row) => row.slot_key === item.slot_key && !companionItemIsArchived(row))
    .map((row) => row.slug);
  const currentIndex = orderedSlugs.indexOf(slug);
  if (currentIndex < 0) return buildCompanionAdminPayload(db);

  const swapIndex = normalizedDirection === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= orderedSlugs.length) {
    return buildCompanionAdminPayload(db);
  }

  [orderedSlugs[currentIndex], orderedSlugs[swapIndex]] = [orderedSlugs[swapIndex] as string, orderedSlugs[currentIndex] as string];
  normalizeCompanionSlotOrder(db, item.slot_key, orderedSlugs);
  recordAudit(actor.id, 'reorder_companion_item', 'companion_catalog', slug, {
    slot: item.slot_key,
    direction: normalizedDirection,
    orderedSlugs,
  });
  return buildCompanionAdminPayload(db);
}

export function uploadCompanionBaseAsset(
  db: Database,
  actor: CompanionUserRow,
  assets: {
    bodyAsset: UploadedCompanionAsset;
    headAsset?: UploadedCompanionAsset | null;
  },
) {
  const bodyAssetPath = storeUploadedCompanionAsset(assets.bodyAsset, { group: 'base', stem: 'ghostling-base-body' });
  const headAssetPath = assets.headAsset?.data.length
    ? storeUploadedCompanionAsset(assets.headAsset, { group: 'base', stem: 'ghostling-base-head' })
    : null;
  db.prepare(`
    INSERT INTO companion_settings (singleton_key, base_asset_path, base_head_asset_path, updated_at)
    VALUES ('default', ?, ?, ?)
    ON CONFLICT(singleton_key) DO UPDATE SET
      base_asset_path = excluded.base_asset_path,
      base_head_asset_path = COALESCE(excluded.base_head_asset_path, companion_settings.base_head_asset_path),
      updated_at = excluded.updated_at
  `).run(bodyAssetPath, headAssetPath, utcIso());

  recordAudit(actor.id, 'upload_companion_base_asset', 'companion_settings', 'default', {
    bodyAssetPath,
    headAssetPath,
  });
  return buildCompanionAdminPayload(db);
}

export function updateCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
  input: {
    name: string;
    slug?: string | null;
    rarity: string;
    cost: number;
    description: string;
    metadataJson?: string | null;
  },
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }

  const normalizedName = String(input.name ?? '').trim();
  if (!normalizedName) {
    throw new AppError('A cosmetic name is required.', 400);
  }

  const nextSlug = slugify(input.slug || normalizedName);
  if (nextSlug !== slug && companionCatalogAnyRow(db, nextSlug)) {
    throw new AppError('That cosmetic slug already exists.', 409);
  }

  const normalizedRarity = normalizeCompanionRarity(input.rarity);
  if (!Number.isInteger(input.cost)) {
    throw new AppError('Companion cosmetic cost must be a whole number.', 400);
  }
  if (input.cost < 0) {
    throw new AppError('Companion cosmetic cost cannot be negative.', 400);
  }

  const renderMetadataJson = normalizeCompanionItemMetadataJson(input.metadataJson, {
    slot: item.slot_key,
    frontAssetPresent: Boolean(item.front_asset_path),
    backAssetPresent: Boolean(item.back_asset_path),
  });
  const nextUpdatedAt = utcIso();

  const transaction = db.transaction(() => {
    if (nextSlug !== slug) {
      db.prepare(`
        INSERT INTO companion_catalog (
          slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, render_metadata_json, active, sort_order, created_at, updated_at, archived_at, archived_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nextSlug,
        normalizedName,
        item.slot_key,
        normalizedRarity,
        input.cost,
        String(input.description ?? '').trim() || 'Custom uploaded companion cosmetic.',
        item.front_asset_path,
        item.back_asset_path,
        renderMetadataJson,
        item.active,
        item.sort_order,
        item.created_at,
        nextUpdatedAt,
        item.archived_at,
        item.archived_by_user_id,
      );
      db.prepare(`
        UPDATE user_companion_inventory
        SET item_slug = ?
        WHERE item_slug = ?
      `).run(nextSlug, slug);
      for (const column of Object.values(COMPANION_LOADOUT_COLUMNS)) {
        db.prepare(`
          UPDATE user_companion_loadout
          SET ${column} = ?, updated_at = ?
          WHERE ${column} = ?
        `).run(nextSlug, nextUpdatedAt, slug);
      }
      db.prepare('DELETE FROM companion_catalog WHERE slug = ?').run(slug);
      return;
    }

    db.prepare(`
      UPDATE companion_catalog
      SET name = ?, rarity = ?, cost = ?, description = ?, render_metadata_json = ?, updated_at = ?
      WHERE slug = ?
    `).run(
      normalizedName,
      normalizedRarity,
      input.cost,
      String(input.description ?? '').trim() || 'Custom uploaded companion cosmetic.',
      renderMetadataJson,
      nextUpdatedAt,
      slug,
    );
  });

  transaction();
  recordAudit(actor.id, 'update_companion_item', 'companion_catalog', nextSlug, {
    previousSlug: nextSlug !== slug ? slug : null,
    name: normalizedName,
    rarity: normalizedRarity,
    cost: input.cost,
    description: String(input.description ?? '').trim() || 'Custom uploaded companion cosmetic.',
    renderMetadataJson,
  });
  return buildCompanionAdminPayload(db);
}

export function archiveCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (companionItemIsArchived(item)) {
    throw new AppError('That companion cosmetic is already archived.', 400);
  }

  const archivedAt = utcIso();
  db.prepare(`
    UPDATE companion_catalog
    SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
    WHERE slug = ?
  `).run(archivedAt, actor.id, archivedAt, slug);

  recordAudit(actor.id, 'archive_companion_item', 'companion_catalog', slug, {
    archivedAt,
    active: Boolean(item.active),
  });
  return buildCompanionAdminPayload(db);
}

export function restoreCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (!companionItemIsArchived(item)) {
    throw new AppError('That companion cosmetic is not archived.', 400);
  }

  const restoredAt = utcIso();
  db.prepare(`
    UPDATE companion_catalog
    SET archived_at = NULL,
        archived_by_user_id = NULL,
        sort_order = ?,
        updated_at = ?
    WHERE slug = ?
  `).run(nextCompanionSortOrder(db, item.slot_key), restoredAt, slug);

  recordAudit(actor.id, 'restore_companion_item', 'companion_catalog', slug, {
    restoredAt,
    active: Boolean(item.active),
  });
  return buildCompanionAdminPayload(db);
}

type DeleteCompanionItemResult = {
  library: CompanionAdminData;
  warning: string | null;
};

function companionItemAssetPaths(item: Pick<CompanionCatalogRow, 'front_asset_path' | 'back_asset_path'>) {
  return [...new Set(
    [item.front_asset_path, item.back_asset_path]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )];
}

function companionCatalogReferencesAssetPath(
  db: Database,
  assetPath: string,
  deletingSlug: string,
) {
  const normalizedPath = normalizeCompanionAssetPath(assetPath);
  const row = db.prepare(`
    SELECT EXISTS(
      SELECT 1
      FROM companion_catalog
      WHERE slug != ?
        AND (front_asset_path = ? OR back_asset_path = ?)
    ) AS in_use,
    EXISTS(
      SELECT 1
      FROM companion_settings
      WHERE singleton_key = 'default'
        AND (base_asset_path = ? OR base_head_asset_path = ?)
    ) AS used_by_base
  `).get(deletingSlug, normalizedPath, normalizedPath, normalizedPath, normalizedPath) as {
    in_use: number;
    used_by_base: number;
  };
  return Boolean(row.in_use) || Boolean(row.used_by_base);
}

function unlinkCompanionUploadAsset(relativePath: string) {
  const normalizedPath = normalizeCompanionAssetPath(relativePath);
  if (!normalizedPath.startsWith('uploads/')) return null;

  const assetFile = companionAssetPath(normalizedPath);
  try {
    if (!fs.existsSync(assetFile)) return null;
    fs.rmSync(assetFile, { force: true });
    return normalizedPath;
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? `Uploaded cosmetic file "${normalizedPath}" could not be removed: ${error.message}`
        : `Uploaded cosmetic file "${normalizedPath}" could not be removed.`,
      500,
    );
  }
}

function purgeCompanionUploadAssets(
  db: Database,
  deletingSlug: string,
  assetPaths: string[],
) {
  const skippedPaths: string[] = [];
  const warnings: string[] = [];

  for (const assetPath of assetPaths) {
    try {
      const normalizedPath = normalizeCompanionAssetPath(assetPath);
      if (!normalizedPath.startsWith('uploads/')) continue;
      if (companionCatalogReferencesAssetPath(db, normalizedPath, deletingSlug)) {
        skippedPaths.push(normalizedPath);
        continue;
      }
      unlinkCompanionUploadAsset(normalizedPath);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Uploaded cosmetic file "${assetPath}" could not be removed.`);
    }
  }

  return { skippedPaths, warnings };
}

export function deleteCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
): DeleteCompanionItemResult {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (!companionItemIsArchived(item)) {
    throw new AppError('Archive the cosmetic before permanently deleting it.', 400);
  }

  const assetPaths = companionItemAssetPaths(item);
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM user_companion_inventory WHERE item_slug = ?) AS inventory_purged,
      (
        SELECT
          SUM(CASE WHEN hat_item_slug = ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN face_item_slug = ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN neck_item_slug = ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN body_item_slug = ? THEN 1 ELSE 0 END)
        FROM user_companion_loadout
      ) AS loadout_cleared
  `).get(slug, slug, slug, slug, slug) as {
    inventory_purged: number | null;
    loadout_cleared: number | null;
  };

  db.transaction(() => {
    db.prepare(`
      DELETE FROM companion_catalog
      WHERE slug = ?
    `).run(slug);
  })();

  const cleanup = purgeCompanionUploadAssets(db, slug, assetPaths);
  recordAudit(actor.id, 'delete_companion_item', 'companion_catalog', slug, {
    inventoryPurged: Number(counts.inventory_purged ?? 0),
    loadoutCleared: Number(counts.loadout_cleared ?? 0),
    assetPaths,
    skippedAssetPaths: cleanup.skippedPaths,
    cleanupWarnings: cleanup.warnings,
  });

  return {
    library: buildCompanionAdminPayload(db),
    warning: cleanup.warnings.length
      ? cleanup.warnings.join(' ')
      : null,
  };
}

export function createCompanionItem(
  db: Database,
  actor: CompanionUserRow,
  input: {
    name: string;
    slug?: string | null;
    slot: string;
    rarity: string;
    cost: number;
    description: string;
    metadataJson?: string | null;
    frontAsset?: UploadedCompanionAsset | null;
    backAsset?: UploadedCompanionAsset | null;
  },
) {
  const normalizedSlot = String(input.slot ?? '').trim().toLowerCase();
  if (!COMPANION_SLOT_ORDER.includes(normalizedSlot as CompanionSlotKey)) {
    throw new AppError('Pick a valid companion slot for the cosmetic.', 400);
  }

  const normalizedName = String(input.name ?? '').trim();
  if (!normalizedName) {
    throw new AppError('A cosmetic name is required.', 400);
  }

  const normalizedSlug = slugify(input.slug || normalizedName);
  if (companionCatalogAnyRow(db, normalizedSlug)) {
    throw new AppError('That cosmetic slug already exists.', 409);
  }

  const normalizedRarity = normalizeCompanionRarity(input.rarity);
  if (!Number.isInteger(input.cost)) {
    throw new AppError('Companion cosmetic cost must be a whole number.', 400);
  }
  if (input.cost < 0) {
    throw new AppError('Companion cosmetic cost cannot be negative.', 400);
  }

  if (!input.frontAsset && !input.backAsset) {
    throw new AppError('Upload at least one front or back asset image for new cosmetics.', 400);
  }

  const frontAssetPath = input.frontAsset?.data.length
    ? storeUploadedCompanionAsset(input.frontAsset, { group: 'items', stem: `${normalizedSlug}-front` })
    : null;
  const backAssetPath = input.backAsset?.data.length
    ? storeUploadedCompanionAsset(input.backAsset, { group: 'items', stem: `${normalizedSlug}-back` })
    : null;
  const renderMetadataJson = normalizeCompanionItemMetadataJson(input.metadataJson, {
    slot: normalizedSlot as CompanionSlotKey,
    frontAssetPresent: Boolean(frontAssetPath),
    backAssetPresent: Boolean(backAssetPath),
  });
  db.prepare(`
    INSERT INTO companion_catalog (
      slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, render_metadata_json, active, sort_order, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    normalizedSlug,
    normalizedName,
    normalizedSlot,
    normalizedRarity,
    input.cost,
    String(input.description ?? '').trim() || 'Custom uploaded companion cosmetic.',
    frontAssetPath,
    backAssetPath,
    renderMetadataJson,
    nextCompanionSortOrder(db, normalizedSlot as CompanionSlotKey),
    utcIso(),
    utcIso(),
  );

  recordAudit(actor.id, 'create_companion_item', 'companion_catalog', normalizedSlug, {
    name: normalizedName,
    slot: normalizedSlot,
    frontAssetPath,
    backAssetPath,
    renderMetadataJson,
  });
  return buildCompanionAdminPayload(db);
}

export function replaceCompanionItemAssets(
  db: Database,
  actor: CompanionUserRow,
  slug: string,
  assets: {
    frontAsset?: UploadedCompanionAsset | null;
    backAsset?: UploadedCompanionAsset | null;
    metadataJson?: string | null;
  },
) {
  const item = companionCatalogAnyRow(db, slug);
  if (!item) {
    throw new AppError('That companion cosmetic does not exist.', 404);
  }
  if (!assets.frontAsset && !assets.backAsset && !assets.metadataJson) {
    throw new AppError('Upload at least one asset file or metadata sidecar to replace.', 400);
  }

  const nextFrontAssetPath = assets.frontAsset?.data.length
    ? storeUploadedCompanionAsset(assets.frontAsset, { group: 'items', stem: `${slug}-front` })
    : item.front_asset_path;
  const nextBackAssetPath = assets.backAsset?.data.length
    ? storeUploadedCompanionAsset(assets.backAsset, { group: 'items', stem: `${slug}-back` })
    : item.back_asset_path;
  const renderMetadataJson = assets.metadataJson
    ? normalizeCompanionItemMetadataJson(assets.metadataJson, {
      slot: item.slot_key,
      frontAssetPresent: Boolean(nextFrontAssetPath),
      backAssetPresent: Boolean(nextBackAssetPath),
    })
    : item.render_metadata_json;

  db.prepare(`
    UPDATE companion_catalog
    SET front_asset_path = ?, back_asset_path = ?, render_metadata_json = ?, updated_at = ?
    WHERE slug = ?
  `).run(nextFrontAssetPath, nextBackAssetPath, renderMetadataJson, utcIso(), slug);

  recordAudit(actor.id, 'replace_companion_item_assets', 'companion_catalog', slug, {
    frontAssetPath: nextFrontAssetPath,
    backAssetPath: nextBackAssetPath,
    renderMetadataJson,
  });
  return buildCompanionAdminPayload(db);
}

export function importRepoCompanionItems(
  db: Database,
  actor: CompanionUserRow,
  items: RepoCompanionImportInput[],
) {
  if (!items.length) {
    throw new AppError('Choose at least one repo cosmetic to import.', 400);
  }

  const queuedSortOrders = new Map<CompanionSlotKey, number>();
  const importedSlugs: string[] = [];
  const seenSlugs = new Set<string>();

  for (const rawItem of items) {
    const normalizedName = String(rawItem.name ?? '').trim();
    if (!normalizedName) {
      throw new AppError('Every imported cosmetic needs a name.', 400);
    }

    const normalizedSlug = slugify(String(rawItem.slug ?? normalizedName));
    if (seenSlugs.has(normalizedSlug)) {
      throw new AppError('Each imported cosmetic slug must be unique.', 400);
    }
    if (companionCatalogAnyRow(db, normalizedSlug)) {
      throw new AppError(`The cosmetic slug '${normalizedSlug}' already exists.`, 409);
    }
    seenSlugs.add(normalizedSlug);

    const normalizedSlot = String(rawItem.slot ?? '').trim().toLowerCase();
    if (!COMPANION_SLOT_ORDER.includes(normalizedSlot as CompanionSlotKey)) {
      throw new AppError('Each repo cosmetic must target a valid Ghostling slot.', 400);
    }

    const normalizedRarity = normalizeCompanionRarity(String(rawItem.rarity ?? 'common'));
    const numericCost = Number(rawItem.cost ?? 0);
    if (!Number.isInteger(numericCost)) {
      throw new AppError('Repo cosmetic costs must be whole numbers.', 400);
    }
    if (numericCost < 0) {
      throw new AppError('Companion cosmetic cost cannot be negative.', 400);
    }

    const rawFrontAssetPath = String(rawItem.frontAssetPath ?? '').trim();
    let frontAssetPath: string | null = null;
    if (rawFrontAssetPath) {
      frontAssetPath = normalizeCompanionAssetPath(rawFrontAssetPath);
      if (!frontAssetPath.startsWith('repo/defaults/items/')) {
        throw new AppError('Repo imports must use assets from repo/defaults/items.', 400);
      }
      if (!companionFileExists(frontAssetPath)) {
        throw new AppError('Repo front asset file could not be found.', 404);
      }
    }

    const rawBackAssetPath = String(rawItem.backAssetPath ?? '').trim();
    let backAssetPath: string | null = null;
    if (rawBackAssetPath) {
      backAssetPath = normalizeCompanionAssetPath(rawBackAssetPath);
      if (!backAssetPath.startsWith('repo/defaults/items/')) {
        throw new AppError('Repo imports must use assets from repo/defaults/items.', 400);
      }
      if (!companionFileExists(backAssetPath)) {
        throw new AppError('Repo back asset file could not be found.', 404);
      }
    }
    if (!frontAssetPath && !backAssetPath) {
      throw new AppError('Repo imports need at least one front or back asset file.', 400);
    }

    const { metadataJson: renderMetadataJson } = repoMetadataJsonForImport(
      normalizedSlot as CompanionSlotKey,
      frontAssetPath,
      backAssetPath,
      rawItem.renderMetadataPath,
    );

    const slotKey = normalizedSlot as CompanionSlotKey;
    const sortOrder = queuedSortOrders.get(slotKey) ?? nextCompanionSortOrder(db, slotKey);
    queuedSortOrders.set(slotKey, sortOrder + 10);

    db.prepare(`
      INSERT INTO companion_catalog (
        slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, render_metadata_json, active, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizedSlug,
      normalizedName,
      slotKey,
      normalizedRarity,
      numericCost,
      String(rawItem.description ?? '').trim() || 'Imported repo Ghostling cosmetic.',
      frontAssetPath,
      backAssetPath,
      renderMetadataJson,
      rawItem.active === false ? 0 : 1,
      sortOrder,
      utcIso(),
      utcIso(),
    );
    importedSlugs.push(normalizedSlug);
  }

  recordAudit(actor.id, 'import_repo_companion_items', 'companion_catalog', importedSlugs.join(','), {
    slugs: importedSlugs,
  });
  return buildCompanionAdminPayload(db);
}

function companionFileExists(relativePath: string) {
  try {
    return fs.statSync(companionAssetPath(relativePath)).isFile();
  } catch {
    return false;
  }
}

export async function parseBaseUploadRequest(request: Request) {
  const formData = await readMultipartFormData(request);
  const bodyAsset = await uploadedCompanionAssetFromFormData(formData, 'bodyAsset')
    ?? await uploadedCompanionAssetFromFormData(formData, 'asset');
  if (!bodyAsset) {
    throw new AppError('Upload a Ghostling body asset file first.', 400);
  }
  return {
    bodyAsset,
    headAsset: await uploadedCompanionAssetFromFormData(formData, 'headAsset'),
  };
}

export async function parseCreateCompanionItemRequest(request: Request) {
  const formData = await readMultipartFormData(request);
  const costRaw = String(formData.get('cost') ?? '0').trim();
  const cost = Number(costRaw || '0');
  if (!Number.isInteger(cost)) {
    throw new AppError('Companion cosmetic cost must be a whole number.', 400);
  }

  const frontAsset = await uploadedCompanionAssetFromFormData(formData, 'frontAsset');
  const backAsset = await uploadedCompanionAssetFromFormData(formData, 'backAsset');
  if (!frontAsset && !backAsset) {
    throw new AppError('Upload at least one front or back asset image for new cosmetics.', 400);
  }

  return {
    name: String(formData.get('name') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim() || null,
    slot: String(formData.get('slot') ?? '').trim(),
    rarity: String(formData.get('rarity') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    cost,
    frontAsset,
    backAsset,
    metadataJson: await metadataTextFromFormData(formData),
  };
}

export async function parseReplaceCompanionAssetsRequest(request: Request) {
  const formData = await readMultipartFormData(request);
  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) {
    throw new AppError('Choose a cosmetic slug to replace assets for.', 400);
  }

  return {
    slug,
    frontAsset: await uploadedCompanionAssetFromFormData(formData, 'frontAsset'),
    backAsset: await uploadedCompanionAssetFromFormData(formData, 'backAsset'),
    metadataJson: await metadataTextFromFormData(formData),
  };
}
