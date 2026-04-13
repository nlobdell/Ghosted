import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import {
  cloneGhostlingSceneTuningSpec,
  createDefaultGhostlingSceneTuningSpec,
  loadGhostlingSceneTuningSpec,
  type GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';
import {
  SHARED_COMMONS_WORLD,
  ghostlingWorldPackageFromSpec,
  loadGhostlingWorldSpec,
  type GhostlingWorldId,
  type GhostlingWorldLayer,
  type GhostlingWorldPackageFile,
} from '@/lib/ghostling-world';
import type { AdminWorldData, AdminWorldLayerAsset, SceneWorldVariantRecord } from '@/lib/types';
import { recordAudit } from '@/lib/server/audit';
import { AppError, envText, slugify, utcIso } from '@/lib/server/core';

const WORLD_ALLOWED_ASSET_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const WORLD_PACKAGE_MIME_TYPES = new Set([
  'application/json',
  'text/json',
  'text/plain',
]);

const WORLD_ASSET_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const WORLD_ASSET_ROUTE_BASE = '/api/world-assets';

type SceneWorldAdminActor = {
  id: number;
  username: string;
  global_name?: string | null;
};

export type UploadedWorldAsset = {
  filename: string;
  contentType: string;
  data: Buffer;
};

type SceneWorldVariantRow = {
  world_id: GhostlingWorldId;
  draft_package_json: string | null;
  published_package_json: string | null;
  draft_tuning_json: string | null;
  published_tuning_json: string | null;
  draft_updated_at: string | null;
  published_at: string | null;
  draft_updated_by_user_id: number | null;
  published_by_user_id: number | null;
};

function actorDisplayName(actor: SceneWorldAdminActor) {
  return actor.global_name || actor.username;
}

function defaultDatabasePath() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'ghosted.db');
}

export function worldAssetDir() {
  const configured = envText('WORLD_ASSET_DIR');
  if (configured) return path.resolve(configured);

  const configuredDatabasePath = envText('DATABASE_PATH');
  if (configuredDatabasePath) {
    return path.join(path.dirname(path.resolve(configuredDatabasePath)), 'world-assets');
  }

  return path.join(path.dirname(defaultDatabasePath()), 'world-assets');
}

export function repoWorldAssetDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'public');
}

function fileExists(targetPath: string) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function resolveWorldStorageTarget(root: string, relativeParts: string[]) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...relativeParts);
  const relative = path.relative(resolvedRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError('World asset not found.', 404);
  }
  return target;
}

export function normalizeWorldAssetPath(value: string) {
  const raw = String(value ?? '').trim().replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
    throw new AppError('World asset not found.', 404);
  }

  const parts = raw.split('/').filter((part) => part && part !== '.');
  if (!parts.length || parts.some((part) => part === '..')) {
    throw new AppError('World asset not found.', 404);
  }

  return parts.join('/');
}

function normalizeWorldAssetRoutePath(value: string) {
  const normalized = String(value ?? '').trim();
  if (normalized.startsWith(`${WORLD_ASSET_ROUTE_BASE}/`)) {
    return normalizeWorldAssetPath(decodeURIComponent(normalized.slice(WORLD_ASSET_ROUTE_BASE.length + 1)));
  }
  if (normalized.startsWith('/worlds/')) {
    return normalizeWorldAssetPath(`repo${normalized}`);
  }
  return normalizeWorldAssetPath(normalized);
}

export function worldAssetUrl(relativePath: string | null | undefined) {
  if (!relativePath) return null;
  const normalized = normalizeWorldAssetRoutePath(relativePath);
  return `${WORLD_ASSET_ROUTE_BASE}/${normalized.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

export function worldAssetPath(relativePath: string) {
  const normalized = normalizeWorldAssetRoutePath(relativePath);
  const parts = normalized.split('/');
  if (parts[0] === 'repo') {
    return resolveWorldStorageTarget(repoWorldAssetDir(), parts.slice(1));
  }

  return resolveWorldStorageTarget(worldAssetDir(), parts);
}

export function worldAssetMimeType(relativePath: string) {
  const target = worldAssetPath(relativePath);
  const extension = path.extname(target).toLowerCase();
  return WORLD_ALLOWED_ASSET_MIME_TYPES[extension] ?? 'application/octet-stream';
}

function writeWorldAssetFile(relativePath: string, data: Buffer) {
  const normalized = normalizeWorldAssetPath(relativePath);
  if (normalized.startsWith('repo/')) {
    throw new AppError('Repo world assets are read-only.', 400);
  }

  const target = worldAssetPath(normalized);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return normalized;
}

function copyWorldAssetFile(sourceRelativePath: string, targetRelativePath: string) {
  const source = worldAssetPath(sourceRelativePath);
  if (!fileExists(source)) {
    throw new AppError(`World asset "${sourceRelativePath}" could not be found.`, 404);
  }

  const normalizedTarget = normalizeWorldAssetPath(targetRelativePath);
  const target = worldAssetPath(normalizedTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return normalizedTarget;
}

function worldContractPackage(worldId: GhostlingWorldId) {
  if (worldId === 'shared-commons') {
    const repoPackage = ghostlingWorldPackageFromSpec(SHARED_COMMONS_WORLD);
    return {
      ...repoPackage,
      layers: repoPackage.layers.map((layer) => ({
        ...layer,
        src: normalizeWorldAssetRoutePath(layer.src),
      })),
    } satisfies GhostlingWorldPackageFile;
  }

  throw new AppError(`Unsupported world "${worldId}".`, 404);
}

function defaultWorldTuning(worldId: GhostlingWorldId) {
  if (worldId === 'shared-commons') {
    return createDefaultGhostlingSceneTuningSpec();
  }

  throw new AppError(`Unsupported world "${worldId}".`, 404);
}

function parseWorldPackageJson(
  value: string | null | undefined,
  label: string,
) {
  if (!value) return null;
  try {
    return JSON.parse(value) as GhostlingWorldPackageFile;
  } catch {
    throw new AppError(`Stored ${label} world package is invalid JSON.`, 500);
  }
}

function parseWorldTuningJson(
  value: string | null | undefined,
  label: string,
) {
  if (!value) return null;
  try {
    return loadGhostlingSceneTuningSpec(JSON.parse(value));
  } catch {
    throw new AppError(`Stored ${label} world tuning is invalid JSON.`, 500);
  }
}

function layerKeySet(layers: GhostlingWorldLayer[]) {
  return new Set(layers.map((layer) => layer.key));
}

function worldLayerKeyMap(layers: GhostlingWorldLayer[]) {
  return new Map(layers.map((layer) => [layer.key, layer]));
}

function assertWorldLayerContract(
  worldId: GhostlingWorldId,
  layers: GhostlingWorldLayer[],
) {
  const expected = worldContractPackage(worldId).layers;
  const expectedKeys = layerKeySet(expected);
  const actualKeys = layerKeySet(layers);

  if (expectedKeys.size !== actualKeys.size) {
    throw new AppError('World package layer keys must match the shared-commons contract.', 400);
  }

  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) {
      throw new AppError(`World package is missing required layer "${key}".`, 400);
    }
  }
}

function assertWorldPackageContract(
  worldId: GhostlingWorldId,
  worldPackage: GhostlingWorldPackageFile,
) {
  if (worldPackage.kind !== 'ghostling-world') {
    throw new AppError('World package kind must be "ghostling-world".', 400);
  }
  if (worldPackage.schemaVersion !== 1) {
    throw new AppError('World package schemaVersion must be 1.', 400);
  }
  if (worldPackage.worldId !== worldId) {
    throw new AppError(`World package worldId must be "${worldId}".`, 400);
  }
  if (worldPackage.preset !== 'public-hero') {
    throw new AppError('World package preset must be "public-hero".', 400);
  }

  assertWorldLayerContract(worldId, worldPackage.layers);
  loadGhostlingWorldSpec(worldPackage);
}

function bindWorldPackageLayerSources(
  worldPackage: GhostlingWorldPackageFile,
  assetSrcByKey: Map<string, string>,
) {
  return {
    ...worldPackage,
    layers: worldPackage.layers.map((layer) => ({
      ...layer,
      src: assetSrcByKey.get(layer.key) ?? normalizeWorldAssetRoutePath(layer.src),
    })),
  } satisfies GhostlingWorldPackageFile;
}

function bindWorldPackageUrls(worldPackage: GhostlingWorldPackageFile) {
  return loadGhostlingWorldSpec({
    ...worldPackage,
    layers: worldPackage.layers.map((layer) => ({
      ...layer,
      src: worldAssetUrl(layer.src) ?? layer.src,
    })),
  });
}

function currentWorldAssetPathsByKey(worldPackage: GhostlingWorldPackageFile) {
  return new Map(worldPackage.layers.map((layer) => [
    layer.key,
    normalizeWorldAssetRoutePath(layer.src),
  ]));
}

function tuningSignature(tuning: GhostlingSceneTuningSpec) {
  return JSON.stringify(cloneGhostlingSceneTuningSpec(tuning));
}

function getSceneWorldVariantRow(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  return db.prepare(`
    SELECT
      world_id,
      draft_package_json,
      published_package_json,
      draft_tuning_json,
      published_tuning_json,
      draft_updated_at,
      published_at,
      draft_updated_by_user_id,
      published_by_user_id
    FROM scene_world_variants
    WHERE world_id = ?
    LIMIT 1
  `).get(worldId) as SceneWorldVariantRow | undefined;
}

function saveSceneWorldVariantRow(
  db: Database.Database,
  record: SceneWorldVariantRecord,
) {
  db.prepare(`
    INSERT INTO scene_world_variants (
      world_id,
      draft_package_json,
      published_package_json,
      draft_tuning_json,
      published_tuning_json,
      draft_updated_at,
      published_at,
      draft_updated_by_user_id,
      published_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(world_id) DO UPDATE SET
      draft_package_json = excluded.draft_package_json,
      published_package_json = excluded.published_package_json,
      draft_tuning_json = excluded.draft_tuning_json,
      published_tuning_json = excluded.published_tuning_json,
      draft_updated_at = excluded.draft_updated_at,
      published_at = excluded.published_at,
      draft_updated_by_user_id = excluded.draft_updated_by_user_id,
      published_by_user_id = excluded.published_by_user_id
  `).run(
    record.worldId,
    record.draftPackageJson ?? null,
    record.publishedPackageJson ?? null,
    record.draftTuningJson ?? null,
    record.publishedTuningJson ?? null,
    record.draftUpdatedAt ?? null,
    record.publishedAt ?? null,
    record.draftUpdatedByUserId ?? null,
    record.publishedByUserId ?? null,
  );
}

export function getSceneWorldVariantRecord(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  const row = getSceneWorldVariantRow(db, worldId);
  if (!row) return null;

  return {
    worldId: row.world_id,
    draftPackageJson: row.draft_package_json,
    publishedPackageJson: row.published_package_json,
    draftTuningJson: row.draft_tuning_json,
    publishedTuningJson: row.published_tuning_json,
    draftUpdatedAt: row.draft_updated_at,
    publishedAt: row.published_at,
    draftUpdatedByUserId: row.draft_updated_by_user_id,
    publishedByUserId: row.published_by_user_id,
  } satisfies SceneWorldVariantRecord;
}

function publishedWorldPackageInternal(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  const record = getSceneWorldVariantRecord(db, worldId);
  return parseWorldPackageJson(record?.publishedPackageJson, 'published') ?? worldContractPackage(worldId);
}

function draftWorldPackageInternal(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  const record = getSceneWorldVariantRecord(db, worldId);
  return parseWorldPackageJson(record?.draftPackageJson, 'draft')
    ?? publishedWorldPackageInternal(db, worldId);
}

function publishedWorldTuningInternal(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  const record = getSceneWorldVariantRecord(db, worldId);
  return parseWorldTuningJson(record?.publishedTuningJson, 'published')
    ?? defaultWorldTuning(worldId);
}

function draftWorldTuningInternal(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  const record = getSceneWorldVariantRecord(db, worldId);
  return parseWorldTuningJson(record?.draftTuningJson, 'draft')
    ?? publishedWorldTuningInternal(db, worldId);
}

function worldPackageSignature(worldPackage: GhostlingWorldPackageFile) {
  return JSON.stringify(worldPackage);
}

export function resolvePublishedGhostlingWorld(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  return bindWorldPackageUrls(publishedWorldPackageInternal(db, worldId));
}

export function resolveDraftGhostlingWorld(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  return bindWorldPackageUrls(draftWorldPackageInternal(db, worldId));
}

export function resolvePublishedGhostlingWorldTuning(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  return cloneGhostlingSceneTuningSpec(publishedWorldTuningInternal(db, worldId));
}

export function resolveDraftGhostlingWorldTuning(
  db: Database.Database,
  worldId: GhostlingWorldId,
) {
  return cloneGhostlingSceneTuningSpec(draftWorldTuningInternal(db, worldId));
}

export function buildAdminWorldPayload(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId = 'shared-commons',
): AdminWorldData {
  const record = getSceneWorldVariantRecord(db, worldId);
  const publishedInternal = publishedWorldPackageInternal(db, worldId);
  const draftInternal = draftWorldPackageInternal(db, worldId);
  const publishedTuning = resolvePublishedGhostlingWorldTuning(db, worldId);
  const draftTuning = resolveDraftGhostlingWorldTuning(db, worldId);
  const publishedWorld = bindWorldPackageUrls(publishedInternal);
  const draftWorld = bindWorldPackageUrls(draftInternal);
  const publishedLayerMap = currentWorldAssetPathsByKey(publishedInternal);
  const draftLayerMap = currentWorldAssetPathsByKey(draftInternal);
  const hasDraft = worldPackageSignature(draftInternal) !== worldPackageSignature(publishedInternal)
    || tuningSignature(draftTuning) !== tuningSignature(publishedTuning);
  const draftLayerMapForUi = worldLayerKeyMap(draftWorld.layers);

  const layers: AdminWorldLayerAsset[] = draftInternal.layers.map((layer) => {
    const liveSrc = publishedWorld.layers.find((entry) => entry.key === layer.key)?.src
      ?? (worldAssetUrl(layer.src) ?? layer.src);
    const draftSrc = draftLayerMapForUi.get(layer.key)?.src ?? (worldAssetUrl(layer.src) ?? layer.src);
    return {
      key: layer.key,
      zIndex: layer.zIndex,
      liveSrc,
      draftSrc,
      hasDraftOverride: (draftLayerMap.get(layer.key) ?? null) !== (publishedLayerMap.get(layer.key) ?? null),
    };
  });

  return {
    actor: { displayName: actorDisplayName(actor) },
    world: {
      id: worldId,
      preset: draftWorld.preset,
      storageRoot: worldAssetDir(),
      repoAssetRoot: repoWorldAssetDir(),
      hasDraft,
      hasPublishedVariant: Boolean(record?.publishedPackageJson || record?.publishedTuningJson),
      draftUpdatedAt: record?.draftUpdatedAt ?? null,
      publishedAt: record?.publishedAt ?? null,
    },
    publishedWorld,
    draftWorld,
    publishedTuning,
    draftTuning,
    layers,
  };
}

export async function readMultipartWorldFormData(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new AppError('Expected multipart/form-data for world uploads.', 400);
  }

  try {
    return await request.formData();
  } catch {
    throw new AppError('Expected multipart/form-data for world uploads.', 400);
  }
}

export async function uploadedWorldAssetFromFormData(formData: FormData, fieldName: string) {
  const entry = formData.get(fieldName);
  if (!(entry instanceof File)) return null;
  const filename = path.basename(entry.name || '');
  const data = Buffer.from(await entry.arrayBuffer());
  return {
    filename,
    contentType: entry.type || 'application/octet-stream',
    data,
  } satisfies UploadedWorldAsset;
}

function storeUploadedWorldAsset(
  upload: UploadedWorldAsset,
  options: { worldId: GhostlingWorldId; layerKey: string },
) {
  const filename = path.basename(upload.filename || '');
  const extension = path.extname(filename).toLowerCase();
  if (!(extension in WORLD_ALLOWED_ASSET_MIME_TYPES)) {
    throw new AppError('Upload a PNG, SVG, GIF, WEBP, JPG, or JPEG world layer asset.', 400);
  }
  if (!upload.data.length) {
    throw new AppError('Uploaded world asset was empty.', 400);
  }
  if (upload.data.length > WORLD_ASSET_MAX_UPLOAD_BYTES) {
    throw new AppError('World asset uploads are capped at 8 MB.', 400);
  }

  const safeStem = slugify(options.layerKey || path.parse(filename).name || 'world-layer');
  const uniqueName = `${safeStem}-${Math.random().toString(16).slice(2, 10)}${extension}`;
  return writeWorldAssetFile(`worlds/${options.worldId}/draft/${uniqueName}`, upload.data);
}

function parseUploadedWorldPackageText(upload: UploadedWorldAsset) {
  if (!WORLD_PACKAGE_MIME_TYPES.has(upload.contentType) && path.extname(upload.filename).toLowerCase() !== '.json') {
    throw new AppError('Upload a JSON world package.', 400);
  }
  if (!upload.data.length) {
    throw new AppError('Uploaded world package was empty.', 400);
  }
  if (upload.data.length > WORLD_ASSET_MAX_UPLOAD_BYTES) {
    throw new AppError('World package uploads are capped at 8 MB.', 400);
  }
  return upload.data.toString('utf8');
}

function mergedDraftWorldPackageFromUpload(
  db: Database.Database,
  worldId: GhostlingWorldId,
  uploadedPackageText: string,
) {
  let uploadedPackage: GhostlingWorldPackageFile;
  try {
    uploadedPackage = JSON.parse(uploadedPackageText) as GhostlingWorldPackageFile;
  } catch {
    throw new AppError('World package must be valid JSON.', 400);
  }

  assertWorldPackageContract(worldId, uploadedPackage);
  const currentDraftPackage = draftWorldPackageInternal(db, worldId);
  const assetSrcByKey = currentWorldAssetPathsByKey(currentDraftPackage);
  return bindWorldPackageLayerSources(uploadedPackage, assetSrcByKey);
}

export function stageWorldLayerAssetUpload(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId,
  layerKey: string,
  upload: UploadedWorldAsset,
) {
  const currentDraftPackage = draftWorldPackageInternal(db, worldId);
  const contractLayer = currentDraftPackage.layers.find((layer) => layer.key === layerKey);
  if (!contractLayer) {
    throw new AppError(`Unknown world layer "${layerKey}".`, 400);
  }

  const storedAssetPath = storeUploadedWorldAsset(upload, { worldId, layerKey });
  const nextDraftPackage = {
    ...currentDraftPackage,
    layers: currentDraftPackage.layers.map((layer) => (
      layer.key === layerKey
        ? { ...layer, src: storedAssetPath }
        : layer
    )),
  } satisfies GhostlingWorldPackageFile;
  const currentRecord = getSceneWorldVariantRecord(db, worldId);
  const draftUpdatedAt = utcIso();

  saveSceneWorldVariantRow(db, {
    worldId,
    draftPackageJson: JSON.stringify(nextDraftPackage),
    publishedPackageJson: currentRecord?.publishedPackageJson ?? null,
    draftTuningJson: currentRecord?.draftTuningJson ?? null,
    publishedTuningJson: currentRecord?.publishedTuningJson ?? null,
    draftUpdatedAt,
    publishedAt: currentRecord?.publishedAt ?? null,
    draftUpdatedByUserId: actor.id,
    publishedByUserId: currentRecord?.publishedByUserId ?? null,
  });

  recordAudit(actor.id, 'stage_world_layer_asset', 'scene_world', worldId, {
    layerKey,
    assetPath: storedAssetPath,
  });

  return buildAdminWorldPayload(db, actor, worldId);
}

export function replaceWorldDraftPackage(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId,
  packageText: string,
) {
  const nextDraftPackage = mergedDraftWorldPackageFromUpload(db, worldId, packageText);
  const currentRecord = getSceneWorldVariantRecord(db, worldId);
  const draftUpdatedAt = utcIso();

  saveSceneWorldVariantRow(db, {
    worldId,
    draftPackageJson: JSON.stringify(nextDraftPackage),
    publishedPackageJson: currentRecord?.publishedPackageJson ?? null,
    draftTuningJson: currentRecord?.draftTuningJson ?? null,
    publishedTuningJson: currentRecord?.publishedTuningJson ?? null,
    draftUpdatedAt,
    publishedAt: currentRecord?.publishedAt ?? null,
    draftUpdatedByUserId: actor.id,
    publishedByUserId: currentRecord?.publishedByUserId ?? null,
  });

  recordAudit(actor.id, 'replace_world_draft_package', 'scene_world', worldId, {
    layerKeys: nextDraftPackage.layers.map((layer) => layer.key),
  });

  return buildAdminWorldPayload(db, actor, worldId);
}

export function replaceWorldDraftTuning(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId,
  tuning: GhostlingSceneTuningSpec,
) {
  const nextDraftTuning = cloneGhostlingSceneTuningSpec(loadGhostlingSceneTuningSpec(tuning));
  const currentRecord = getSceneWorldVariantRecord(db, worldId);
  const draftUpdatedAt = utcIso();

  saveSceneWorldVariantRow(db, {
    worldId,
    draftPackageJson: currentRecord?.draftPackageJson ?? null,
    publishedPackageJson: currentRecord?.publishedPackageJson ?? null,
    draftTuningJson: JSON.stringify(nextDraftTuning),
    publishedTuningJson: currentRecord?.publishedTuningJson ?? null,
    draftUpdatedAt,
    publishedAt: currentRecord?.publishedAt ?? null,
    draftUpdatedByUserId: actor.id,
    publishedByUserId: currentRecord?.publishedByUserId ?? null,
  });

  recordAudit(actor.id, 'replace_world_draft_tuning', 'scene_world', worldId, {
    maxVisible: {
      mobile: nextDraftTuning.buckets.mobile.maxVisible,
      tablet: nextDraftTuning.buckets.tablet.maxVisible,
      desktop: nextDraftTuning.buckets.desktop.maxVisible,
    },
  });

  return buildAdminWorldPayload(db, actor, worldId);
}

function publishedPackageFromDraft(
  worldId: GhostlingWorldId,
  draftPackage: GhostlingWorldPackageFile,
) {
  return {
    ...draftPackage,
    layers: draftPackage.layers.map((layer) => {
      const sourceAssetPath = normalizeWorldAssetRoutePath(layer.src);
      const sourceFile = worldAssetPath(sourceAssetPath);
      const extension = path.extname(sourceFile).toLowerCase() || '.png';
      const publishedRelativePath = normalizeWorldAssetPath(`worlds/${worldId}/published/${layer.key}${extension}`);
      copyWorldAssetFile(sourceAssetPath, publishedRelativePath);
      return {
        ...layer,
        src: publishedRelativePath,
      };
    }),
  } satisfies GhostlingWorldPackageFile;
}

export function publishWorldDraft(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId,
  options?: {
    onPublish?: () => void;
  },
) {
  const currentPublishedPackage = publishedWorldPackageInternal(db, worldId);
  const currentDraftPackage = draftWorldPackageInternal(db, worldId);
  const currentPublishedTuning = publishedWorldTuningInternal(db, worldId);
  const currentDraftTuning = draftWorldTuningInternal(db, worldId);
  const hasPackageDraft = worldPackageSignature(currentDraftPackage) !== worldPackageSignature(currentPublishedPackage);
  const hasTuningDraft = tuningSignature(currentDraftTuning) !== tuningSignature(currentPublishedTuning);

  if (!hasPackageDraft && !hasTuningDraft) {
    throw new AppError('Stage a draft world or tuning before publishing.', 400);
  }

  const publishedPackage = publishedPackageFromDraft(worldId, currentDraftPackage);
  const publishedAt = utcIso();

  saveSceneWorldVariantRow(db, {
    worldId,
    draftPackageJson: JSON.stringify(publishedPackage),
    publishedPackageJson: JSON.stringify(publishedPackage),
    draftTuningJson: JSON.stringify(currentDraftTuning),
    publishedTuningJson: JSON.stringify(currentDraftTuning),
    draftUpdatedAt: publishedAt,
    publishedAt,
    draftUpdatedByUserId: actor.id,
    publishedByUserId: actor.id,
  });

  recordAudit(actor.id, 'publish_world_draft', 'scene_world', worldId, {
    layerKeys: publishedPackage.layers.map((layer) => layer.key),
    maxVisible: {
      mobile: currentDraftTuning.buckets.mobile.maxVisible,
      tablet: currentDraftTuning.buckets.tablet.maxVisible,
      desktop: currentDraftTuning.buckets.desktop.maxVisible,
    },
  });

  options?.onPublish?.();

  return buildAdminWorldPayload(db, actor, worldId);
}

export function discardWorldDraft(
  db: Database.Database,
  actor: SceneWorldAdminActor,
  worldId: GhostlingWorldId,
) {
  const currentRecord = getSceneWorldVariantRecord(db, worldId);
  const nextDraftPackageJson = currentRecord?.publishedPackageJson ?? null;
  const nextDraftTuningJson = currentRecord?.publishedTuningJson ?? null;

  saveSceneWorldVariantRow(db, {
    worldId,
    draftPackageJson: nextDraftPackageJson,
    publishedPackageJson: currentRecord?.publishedPackageJson ?? null,
    draftTuningJson: nextDraftTuningJson,
    publishedTuningJson: currentRecord?.publishedTuningJson ?? null,
    draftUpdatedAt: null,
    publishedAt: currentRecord?.publishedAt ?? null,
    draftUpdatedByUserId: null,
    publishedByUserId: currentRecord?.publishedByUserId ?? null,
  });

  fs.rmSync(path.join(worldAssetDir(), 'worlds', worldId, 'draft'), {
    recursive: true,
    force: true,
  });

  recordAudit(actor.id, 'discard_world_draft', 'scene_world', worldId);

  return buildAdminWorldPayload(db, actor, worldId);
}

export async function parseStageWorldLayerAssetRequest(request: Request) {
  const formData = await readMultipartWorldFormData(request);
  const worldId = String(formData.get('worldId') ?? '').trim() as GhostlingWorldId;
  const layerKey = String(formData.get('layerKey') ?? '').trim();
  const asset = await uploadedWorldAssetFromFormData(formData, 'asset');
  if (!worldId) {
    throw new AppError('A worldId is required.', 400);
  }
  if (!layerKey) {
    throw new AppError('A layerKey is required.', 400);
  }
  if (!asset) {
    throw new AppError('Upload a world layer asset file first.', 400);
  }

  return {
    worldId,
    layerKey,
    asset,
  };
}

export async function parseReplaceWorldDraftPackageRequest(request: Request) {
  const formData = await readMultipartWorldFormData(request);
  const worldId = String(formData.get('worldId') ?? '').trim() as GhostlingWorldId;
  const packageFile = await uploadedWorldAssetFromFormData(formData, 'package');
  if (!worldId) {
    throw new AppError('A worldId is required.', 400);
  }
  if (!packageFile) {
    throw new AppError('Upload a world package JSON file first.', 400);
  }

  return {
    worldId,
    packageText: parseUploadedWorldPackageText(packageFile),
  };
}
