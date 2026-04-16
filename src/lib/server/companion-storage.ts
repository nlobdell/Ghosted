import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import type {
  CompanionAnimationFrame,
  CompanionItemRenderMetadata,
  CompanionLayerAnimation,
  CompanionMotionAccent,
  CompanionMotionChannel,
  CompanionRepoImportCandidate,
  CompanionRenderManifest,
  CompanionRenderPoint,
  CompanionRenderRect,
  CompanionRenderSlice,
  CompanionSceneFacingFlipMode,
  CompanionSlotKey,
} from '@/lib/types';
import { resolveStageShadowRect } from '@/lib/companion-motion';
import { AppError, envText, humanizeIdentifier, slugify } from '@/lib/server/core';
import {
  COMPANION_DEFAULT_BASE_ASSET_PATH,
  COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH,
  ensureDefaultCompanionBase,
} from '@/lib/server/companion-schema';

export {
  COMPANION_DEFAULT_BASE_ASSET_PATH,
  COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH,
} from '@/lib/server/companion-schema';

export const COMPANION_SLOT_ORDER = ['hat', 'face', 'neck', 'body'] as const satisfies readonly CompanionSlotKey[];

export const COMPANION_SLOT_LABELS: Record<CompanionSlotKey, string> = {
  hat: 'Hat',
  face: 'Face',
  neck: 'Neck',
  body: 'Body',
};

export const COMPANION_LOADOUT_COLUMNS: Record<CompanionSlotKey, string> = {
  hat: 'hat_item_slug',
  face: 'face_item_slug',
  neck: 'neck_item_slug',
  body: 'body_item_slug',
};

export const COMPANION_CANVAS_SIZE = 32;
export const COMPANION_STAGE_CANVAS_SIZE = 70;
export const COMPANION_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const COMPANION_DEFAULT_SHADOW_OPACITY = 0.2;

const COMPANION_ALLOWED_ASSET_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const COMPANION_DEFAULT_SLOT_GROUPS: Partial<Record<CompanionSlotKey, string>> = {
  hat: 'head',
  face: 'head',
  neck: 'body',
  body: 'body',
};

export const COMPANION_DEFAULT_SLOT_ANCHORS: Partial<Record<CompanionSlotKey, CompanionRenderPoint>> = {
  hat: { x: 105, y: 72 },
  face: { x: 105, y: 97 },
  neck: { x: 105, y: 137 },
  body: { x: 105, y: 164 },
};

type Rect = CompanionRenderRect;

type CompanionRigPart = {
  key: string;
  motionGroup: string | null;
  source: Rect;
  target: Rect;
};

type CompanionRigLayer = {
  key: string;
  role: string;
  relativePath: string;
  motionGroup: string | null;
  zIndex: number;
};

export type CompanionRig = {
  width: number;
  height: number;
  parts: CompanionRigPart[];
  layers: CompanionRigLayer[];
  slotGroups: Partial<Record<CompanionSlotKey, string>>;
  slotAnchors: Partial<Record<CompanionSlotKey, CompanionRenderPoint>>;
  motionChannels: Record<string, CompanionMotionChannel>;
  motionAccents: CompanionMotionAccent[];
};

export type CompanionAnimation = CompanionLayerAnimation & {
  sheetWidth: number;
  sheetHeight: number;
  frames: CompanionAnimationFrame[];
};

export type CompanionManifestLayer = {
  key: string;
  role: string;
  relativePath: string;
  zIndex: number;
  sceneFacingFlip: CompanionSceneFacingFlipMode;
  slot: CompanionSlotKey | null;
  motionGroup: string | null;
  slices: CompanionRenderSlice[];
};

export type CompanionBaseConfig = {
  bodyAssetPath: string;
  bodyAssetUrl: string | null;
  headAssetPath: string | null;
  headAssetUrl: string | null;
  previewAssetPath: string;
  previewAssetUrl: string | null;
  renderUrl: string;
  animatedRenderUrl: string;
  rig: CompanionRig;
  animation: CompanionAnimation;
  layers: CompanionManifestLayer[];
};

export type UploadedCompanionAsset = {
  filename: string;
  contentType: string;
  data: Buffer;
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
};

type CompanionSettingsRow = {
  base_asset_path: string | null;
  base_head_asset_path: string | null;
};

function defaultDatabasePath() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'ghosted.db');
}

function fileExists(targetPath: string) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function resolveCompanionStorageTarget(root: string, relativeParts: string[]) {
  const resolvedRoot = path.resolve(/*turbopackIgnore: true*/ root);
  const target = path.resolve(/*turbopackIgnore: true*/ resolvedRoot, ...relativeParts);
  const relative = path.relative(/*turbopackIgnore: true*/ resolvedRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError('Companion asset not found.', 404);
  }
  return target;
}

function parseSvgLength(value: string | null | undefined) {
  if (!value) return null;
  const match = /^\s*([0-9]+(?:\.[0-9]+)?)/.exec(value);
  if (!match) return null;
  return Math.max(1, Math.round(Number.parseFloat(match[1] ?? '0')));
}

function normalizeRect(value: unknown, fallbackWidth: number, fallbackHeight: number): Rect | null {
  if (!value || typeof value !== 'object') return null;
  const shape = value as Record<string, unknown>;
  const x = Number(shape.x ?? 0);
  const y = Number(shape.y ?? 0);
  const width = Number(shape.w ?? shape.width ?? fallbackWidth);
  const height = Number(shape.h ?? shape.height ?? fallbackHeight);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;
  return {
    x: Math.trunc(x),
    y: Math.trunc(y),
    width: Math.trunc(width),
    height: Math.trunc(height),
  };
}

function normalizePoint(value: unknown): CompanionRenderPoint | null {
  if (!value || typeof value !== 'object') return null;
  const shape = value as Record<string, unknown>;
  const x = Number(shape.x ?? 0);
  const y = Number(shape.y ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.trunc(x),
    y: Math.trunc(y),
  };
}

function pointWithinRect(point: CompanionRenderPoint, rect: Rect) {
  return point.x >= rect.x
    && point.y >= rect.y
    && point.x < rect.x + rect.width
    && point.y < rect.y + rect.height;
}

function rectWithinRect(rect: Rect, bounds: Rect) {
  return rect.x >= bounds.x
    && rect.y >= bounds.y
    && rect.x + rect.width <= bounds.x + bounds.width
    && rect.y + rect.height <= bounds.y + bounds.height;
}

function canonicalizeRect(rect: Rect): CompanionRenderRect {
  return {
    x: Math.trunc(rect.x),
    y: Math.trunc(rect.y),
    width: Math.trunc(rect.width),
    height: Math.trunc(rect.height),
  };
}

function canonicalizePoint(point: CompanionRenderPoint): CompanionRenderPoint {
  return {
    x: Math.trunc(point.x),
    y: Math.trunc(point.y),
  };
}

function defaultMotionChannels(): Record<string, CompanionMotionChannel> {
  return {
    root: {
      offsetX: { amplitude: 0.16, durationMs: 5200, phase: 0.49 },
      offsetY: { amplitude: 0.26, durationMs: 4100, phase: 0.11 },
    },
    body: {
      offsetX: { amplitude: 0.12, durationMs: 3600, phase: 0.2 },
      offsetY: { amplitude: 0.46, durationMs: 2860, phase: 0.31 },
    },
    head: {
      offsetX: { amplitude: 0.3, durationMs: 2480, phase: 0.41 },
      offsetY: { amplitude: 0.92, durationMs: 1820, phase: 0.72 },
    },
  };
}

function defaultMotionAccents(): CompanionMotionAccent[] {
  return [
    {
      key: 'head-tilt',
      groups: ['head'],
      intervalMsMin: 3600,
      intervalMsMax: 6200,
      durationMs: 1040,
      overrides: {
        head: {
          rotateDeg: { amplitude: 4.2, durationMs: 1040, phase: 0.06 },
          offsetY: { amplitude: 0.28, durationMs: 1040, phase: 0.54 },
          scaleY: { amplitude: 0.018, durationMs: 1040, phase: 0.24 },
        },
      },
    },
    {
      key: 'spirit-pulse',
      groups: ['body', 'head'],
      intervalMsMin: 5200,
      intervalMsMax: 8600,
      durationMs: 1320,
      overrides: {
        body: {
          offsetY: { amplitude: 0.22, durationMs: 1320, phase: 0.28 },
          scaleX: { amplitude: 0.012, durationMs: 1320, phase: 0.66 },
          scaleY: { amplitude: 0.026, durationMs: 1320, phase: 0.18 },
        },
        head: {
          offsetY: { amplitude: 0.34, durationMs: 1320, phase: 0.32 },
          rotateDeg: { amplitude: 2.1, durationMs: 1320, phase: 0.08 },
          scaleX: { amplitude: 0.018, durationMs: 1320, phase: 0.52 },
          scaleY: { amplitude: 0.028, durationMs: 1320, phase: 0.16 },
        },
      },
    },
  ];
}

function normalizeMotionWave(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const shape = value as Record<string, unknown>;
  const amplitude = Number(shape.amplitude ?? 0);
  const durationMs = Number(shape.durationMs ?? 1000);
  const phase = Number(shape.phase ?? 0);
  if (!Number.isFinite(amplitude) || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(phase)) {
    return null;
  }

  return {
    amplitude,
    durationMs: Math.max(1, Math.trunc(durationMs)),
    phase,
  };
}

function normalizeMotionChannel(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const channel = value as Record<string, unknown>;
  const normalized: CompanionMotionChannel = {};

  for (const axisKey of ['offsetX', 'offsetY', 'rotateDeg', 'scaleX', 'scaleY'] as const) {
    const wave = normalizeMotionWave(channel[axisKey]);
    if (wave) normalized[axisKey] = wave;
  }

  if (normalized.offsetX || normalized.offsetY || normalized.rotateDeg || normalized.scaleX || normalized.scaleY) {
    return normalized;
  }
  return null;
}

function normalizeMotionAccent(value: unknown, fallbackKey: string) {
  if (!value || typeof value !== 'object') return null;
  const accent = value as Record<string, unknown>;
  const groups = Array.isArray(accent.groups)
    ? accent.groups.map((group) => String(group ?? '').trim()).filter(Boolean)
    : [];
  if (!groups.length) return null;

  const intervalMsMin = Math.max(1, Math.trunc(Number(accent.intervalMsMin ?? 0) || 0));
  const intervalMsMax = Math.max(intervalMsMin, Math.trunc(Number(accent.intervalMsMax ?? intervalMsMin) || intervalMsMin));
  const durationMs = Math.max(1, Math.trunc(Number(accent.durationMs ?? 0) || 0));
  const overrides: Record<string, CompanionMotionChannel> = {};

  if (accent.overrides && typeof accent.overrides === 'object') {
    for (const [groupKey, channelValue] of Object.entries(accent.overrides as Record<string, unknown>)) {
      const normalizedChannel = normalizeMotionChannel(channelValue);
      if (normalizedChannel) overrides[String(groupKey)] = normalizedChannel;
    }
  }

  if (!Object.keys(overrides).length) return null;

  return {
    key: String(accent.key ?? fallbackKey),
    groups,
    intervalMsMin,
    intervalMsMax,
    durationMs,
    overrides,
  } satisfies CompanionMotionAccent;
}

export function companionAssetDir() {
  const configured = envText('COMPANION_ASSET_DIR');
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);

  const configuredDatabasePath = envText('DATABASE_PATH');
  if (configuredDatabasePath) {
    return path.join(
      path.dirname(path.resolve(/*turbopackIgnore: true*/ configuredDatabasePath)),
      'companion-assets',
    );
  }

  return path.join(path.dirname(defaultDatabasePath()), 'companion-assets');
}

export function legacyCompanionAssetDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'companion-assets');
}

export function repoCompanionAssetDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'assets', 'companion');
}

export function normalizeCompanionAssetPath(value: string) {
  const raw = String(value ?? '').trim().replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
    throw new AppError('Invalid companion asset path.', 400);
  }

  const parts = raw.split('/').filter((part) => part && part !== '.');
  if (!parts.length || parts.some((part) => part === '..')) {
    throw new AppError('Invalid companion asset path.', 400);
  }

  return parts.join('/');
}

function companionRepoDefaultRelativePath(relativePath: string) {
  const normalized = normalizeCompanionAssetPath(relativePath);
  if (normalized.startsWith('repo/') || normalized.startsWith('uploads/')) return null;
  if (!normalized.startsWith('defaults/')) return null;
  return `repo/${normalized}`;
}

export function companionAssetPath(relativePath: string) {
  const normalized = normalizeCompanionAssetPath(relativePath);
  const repoFallback = companionRepoDefaultRelativePath(normalized);
  if (repoFallback) {
    const repoRoot = repoCompanionAssetDir();
    const repoTarget = resolveCompanionStorageTarget(repoRoot, repoFallback.split('/').slice(1));
    if (fileExists(repoTarget)) return repoTarget;
  }

  const parts = normalized.split('/');
  if (!parts.length) throw new AppError('Companion asset not found.', 404);

  if (parts[0] === 'repo') {
    return resolveCompanionStorageTarget(repoCompanionAssetDir(), parts.slice(1));
  }

  const primaryTarget = resolveCompanionStorageTarget(companionAssetDir(), parts);
  if (fileExists(primaryTarget)) return primaryTarget;

  const legacyRoot = legacyCompanionAssetDir();
  if (
    path.resolve(/*turbopackIgnore: true*/ legacyRoot)
    !== path.resolve(/*turbopackIgnore: true*/ companionAssetDir())
  ) {
    const legacyTarget = resolveCompanionStorageTarget(legacyRoot, parts);
    if (fileExists(legacyTarget)) return legacyTarget;
  }

  return primaryTarget;
}

export function writeCompanionAssetFile(relativePath: string, data: Buffer) {
  const normalized = normalizeCompanionAssetPath(relativePath);
  if (normalized.startsWith('repo/')) {
    throw new AppError('Repo companion assets are read-only.', 400);
  }

  const target = resolveCompanionStorageTarget(companionAssetDir(), normalized.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return normalized;
}

export function companionAssetUrl(relativePath: string | null | undefined) {
  if (!relativePath) return null;
  const normalized = normalizeCompanionAssetPath(relativePath);
  return `/api/companion/assets/${normalized.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

export function companionAssetMimeType(relativePath: string | null | undefined) {
  if (!relativePath) return 'application/octet-stream';

  const target = companionAssetPath(relativePath);
  const extension = path.extname(target).toLowerCase();
  return COMPANION_ALLOWED_ASSET_MIME_TYPES[extension] ?? 'application/octet-stream';
}

export function companionAssetDataUri(relativePath: string | null | undefined) {
  if (!relativePath) return null;

  const target = companionAssetPath(relativePath);
  if (!fileExists(target)) return null;

  const encoded = fs.readFileSync(target).toString('base64');
  return `data:${companionAssetMimeType(relativePath)};base64,${encoded}`;
}

function companionSettingsRow(db: Database) {
  ensureDefaultCompanionBase(db);
  return db.prepare(`
    SELECT base_asset_path, base_head_asset_path
    FROM companion_settings
    WHERE singleton_key = 'default'
  `).get() as CompanionSettingsRow | undefined;
}

function resolveConfiguredCompanionAssetPath(
  value: string | null | undefined,
  fallbackPath: string | null,
) {
  const candidate = String(value ?? '').trim();
  if (candidate) {
    try {
      if (fileExists(companionAssetPath(candidate))) return candidate;
    } catch {
      // Fall through to the fallback path.
    }
  }
  return fallbackPath;
}

type CompanionRigAssetState = {
  animation: CompanionAnimation;
  rig: CompanionRig;
};

type CompanionItemRenderMetadataValidationOptions = {
  expectedSlot?: CompanionSlotKey | null;
  frontAssetPresent?: boolean;
  backAssetPresent?: boolean;
};

type CompanionItemRenderMetadataValidationResult = {
  metadata: CompanionItemRenderMetadata | null;
  errors: string[];
};

const COMPANION_SCENE_FACING_FLIP_MODES = ['allow', 'ignore', 'invert'] as const satisfies readonly CompanionSceneFacingFlipMode[];

function normalizeSceneFacingFlip(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return COMPANION_SCENE_FACING_FLIP_MODES.includes(normalized as CompanionSceneFacingFlipMode)
    ? normalized as CompanionSceneFacingFlipMode
    : null;
}

function validateCompanionItemRenderMetadataObject(
  value: unknown,
  options: CompanionItemRenderMetadataValidationOptions = {},
): CompanionItemRenderMetadataValidationResult {
  if (!value || typeof value !== 'object') {
    return { metadata: null, errors: ['Ghostling metadata must be a JSON object.'] };
  }

  const shape = value as Record<string, unknown>;
  const errors: string[] = [];

  if (shape.kind !== 'ghostling-cosmetic') {
    errors.push('Ghostling metadata kind must be "ghostling-cosmetic".');
  }
  if (Number(shape.schemaVersion ?? 0) !== 1) {
    errors.push('Ghostling metadata schemaVersion must be 1.');
  }

  const rawSlot = String(shape.slot ?? '').trim().toLowerCase();
  if (!COMPANION_SLOT_ORDER.includes(rawSlot as CompanionSlotKey)) {
    errors.push('Ghostling metadata must declare a valid slot.');
  }
  if (options.expectedSlot && rawSlot && rawSlot !== options.expectedSlot) {
    errors.push(`Ghostling metadata slot "${rawSlot}" does not match the selected "${options.expectedSlot}" slot.`);
  }

  const sceneFacingFlip = normalizeSceneFacingFlip(shape.sceneFacingFlip);
  if (shape.sceneFacingFlip !== undefined && !sceneFacingFlip) {
    errors.push('Ghostling metadata sceneFacingFlip must be "allow", "ignore", or "invert".');
  }

  const canvasShape = shape.canvas && typeof shape.canvas === 'object' ? shape.canvas as Record<string, unknown> : {};
  const canvasWidth = Number(canvasShape.width ?? 0);
  const canvasHeight = Number(canvasShape.height ?? 0);
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
    errors.push('Ghostling metadata canvas must include positive width and height.');
  }

  const canvasRect: Rect | null = Number.isFinite(canvasWidth) && Number.isFinite(canvasHeight) && canvasWidth > 0 && canvasHeight > 0
    ? { x: 0, y: 0, width: Math.trunc(canvasWidth), height: Math.trunc(canvasHeight) }
    : null;
  const baseRect = normalizeRect(shape.baseRect, 0, 0);
  if (!baseRect) {
    errors.push('Ghostling metadata baseRect must include valid x, y, width, and height values.');
  } else if (!canvasRect || !rectWithinRect(baseRect, canvasRect)) {
    errors.push('Ghostling metadata baseRect must stay inside the declared canvas.');
  }

  const mount = normalizePoint(shape.mount);
  if (!mount) {
    errors.push('Ghostling metadata mount must include valid x and y coordinates.');
  } else if (!canvasRect || !pointWithinRect(mount, canvasRect)) {
    errors.push('Ghostling metadata mount must stay inside the declared canvas.');
  }

  const piecesShape = shape.pieces && typeof shape.pieces === 'object' ? shape.pieces as Record<string, unknown> : {};
  const frontPieceShape = piecesShape.front && typeof piecesShape.front === 'object' ? piecesShape.front as Record<string, unknown> : null;
  const backPieceShape = piecesShape.back && typeof piecesShape.back === 'object' ? piecesShape.back as Record<string, unknown> : null;
  const frontDocRect = frontPieceShape ? normalizeRect(frontPieceShape.docRect, 0, 0) : null;
  const backDocRect = backPieceShape ? normalizeRect(backPieceShape.docRect, 0, 0) : null;

  if (frontPieceShape && !frontDocRect) {
    errors.push('Ghostling metadata front piece must include a valid docRect.');
  } else if (frontDocRect && (!canvasRect || !rectWithinRect(frontDocRect, canvasRect))) {
    errors.push('Ghostling metadata front piece docRect must stay inside the declared canvas.');
  }
  if (backPieceShape && !backDocRect) {
    errors.push('Ghostling metadata back piece must include a valid docRect.');
  } else if (backDocRect && (!canvasRect || !rectWithinRect(backDocRect, canvasRect))) {
    errors.push('Ghostling metadata back piece docRect must stay inside the declared canvas.');
  }

  if (frontDocRect && options.frontAssetPresent === false) {
    errors.push('Ghostling metadata cannot declare a front piece without a matching front asset.');
  }
  if (backDocRect && options.backAssetPresent === false) {
    errors.push('Ghostling metadata cannot declare a back piece without a matching back asset.');
  }

  if (errors.length > 0 || !canvasRect || !baseRect || !mount || !COMPANION_SLOT_ORDER.includes(rawSlot as CompanionSlotKey)) {
    return { metadata: null, errors };
  }

  const metadata: CompanionItemRenderMetadata = {
    kind: 'ghostling-cosmetic',
    schemaVersion: 1,
    slot: rawSlot as CompanionSlotKey,
    sceneFacingFlip: sceneFacingFlip ?? 'allow',
    canvas: {
      width: canvasRect.width,
      height: canvasRect.height,
    },
    baseRect: canonicalizeRect(baseRect),
    mount: canonicalizePoint(mount),
    pieces: {},
  };

  if (frontDocRect) {
    metadata.pieces.front = { docRect: canonicalizeRect(frontDocRect) };
  }
  if (backDocRect) {
    metadata.pieces.back = { docRect: canonicalizeRect(backDocRect) };
  }

  return {
    metadata,
    errors,
  };
}

export function parseCompanionItemRenderMetadata(
  raw: string | null | undefined,
  options: CompanionItemRenderMetadataValidationOptions = {},
) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError('Ghostling metadata must be valid JSON.', 400);
  }

  const result = validateCompanionItemRenderMetadataObject(parsed, options);
  if (result.errors.length > 0 || !result.metadata) {
    throw new AppError(result.errors[0] ?? 'Ghostling metadata was invalid.', 400);
  }
  return result.metadata;
}

function tryParseCompanionItemRenderMetadata(
  raw: string | null | undefined,
  options: CompanionItemRenderMetadataValidationOptions = {},
) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return {
      metadata: null,
      errors: [],
    } satisfies CompanionItemRenderMetadataValidationResult;
  }

  try {
    const parsed = JSON.parse(value);
    return validateCompanionItemRenderMetadataObject(parsed, options);
  } catch {
    return {
      metadata: null,
      errors: ['Ghostling metadata must be valid JSON.'],
    } satisfies CompanionItemRenderMetadataValidationResult;
  }
}

export function companionStoredItemRenderMetadata(
  value: string | null | undefined,
  slot: CompanionSlotKey,
  frontAssetPath: string | null | undefined,
  backAssetPath: string | null | undefined,
) {
  return tryParseCompanionItemRenderMetadata(value, {
    expectedSlot: slot,
    frontAssetPresent: Boolean(frontAssetPath),
    backAssetPresent: Boolean(backAssetPath),
  }).metadata;
}

function companionItemRenderMetadataFromRow(
  row: Pick<CompanionCatalogRow, 'render_metadata_json' | 'slot_key' | 'front_asset_path' | 'back_asset_path'>,
) {
  return companionStoredItemRenderMetadata(
    row.render_metadata_json,
    row.slot_key,
    row.front_asset_path,
    row.back_asset_path,
  );
}

function companionRigAssetState(relativePath: string) {
  const animation = companionAssetAnimation(relativePath);
  const [sourceWidth, sourceHeight] = companionAnimationSourceDimensions(animation);
  return {
    animation,
    rig: companionAssetRig(relativePath, sourceWidth, sourceHeight),
  } satisfies CompanionRigAssetState;
}

function companionBaseLayerKind(
  layer: Pick<CompanionRigLayer, 'key' | 'role' | 'relativePath'>,
  bodyAssetPath: string,
  headAssetPath: string | null,
): 'body' | 'head' | null {
  const label = `${layer.key} ${layer.role} ${path.parse(layer.relativePath).name}`.toLowerCase();
  if (label.includes('head') || (headAssetPath && layer.relativePath === headAssetPath) || layer.relativePath === COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH) {
    return 'head';
  }
  if (label.includes('body') || layer.relativePath === bodyAssetPath || layer.relativePath === COMPANION_DEFAULT_BASE_ASSET_PATH) {
    return 'body';
  }
  return null;
}

function companionRigLayerToManifestLayer(
  layer: CompanionRigLayer,
  relativePath: string,
) {
  return {
    key: layer.key,
    role: layer.role,
    slot: null,
    relativePath,
    zIndex: layer.zIndex,
    sceneFacingFlip: 'allow',
    motionGroup: layer.motionGroup,
    slices: [],
  } satisfies CompanionManifestLayer;
}

function fallbackBaseRigLayer(
  kind: 'body' | 'head',
  fallbackRig: CompanionRig,
  relativePath: string,
) {
  const fallbackLayer = fallbackRig.layers.find((layer) => companionBaseLayerKind(layer, COMPANION_DEFAULT_BASE_ASSET_PATH, COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH) === kind);
  if (fallbackLayer) {
    return companionRigLayerToManifestLayer(fallbackLayer, relativePath);
  }

  return {
    key: kind === 'body' ? 'base-body' : 'base-head',
    role: kind === 'body' ? 'base-body' : 'base-head',
    slot: null,
    relativePath,
    zIndex: kind === 'body' ? 20 : 35,
    sceneFacingFlip: 'allow',
    motionGroup: kind,
    slices: [],
  } satisfies CompanionManifestLayer;
}

export function companionBaseAssetPath(db: Database) {
  const row = companionSettingsRow(db);
  const value = String(row?.base_asset_path ?? '').trim();
  if (value) {
    try {
      if (fileExists(companionAssetPath(value))) return value;
    } catch {
      // Fall through to the default base asset path.
    }
  }
  return COMPANION_DEFAULT_BASE_ASSET_PATH;
}

export function resolveCompanionBaseConfig(db: Database): CompanionBaseConfig {
  const row = companionSettingsRow(db);
  const bodyAssetPath = resolveConfiguredCompanionAssetPath(row?.base_asset_path, COMPANION_DEFAULT_BASE_ASSET_PATH) ?? COMPANION_DEFAULT_BASE_ASSET_PATH;
  const explicitHeadAssetPath = resolveConfiguredCompanionAssetPath(row?.base_head_asset_path, null);
  const currentBase = companionRigAssetState(bodyAssetPath);
  const fallbackBase = companionRigAssetState(COMPANION_DEFAULT_BASE_ASSET_PATH);
  const rigSource = currentBase.rig.layers.length > 0 ? currentBase : fallbackBase;
  const sourceLayers = rigSource.rig.layers.length > 0 ? rigSource.rig.layers : fallbackBase.rig.layers;
  const resolvedLayers = sourceLayers.map((layer) => {
    const kind = companionBaseLayerKind(layer, bodyAssetPath, explicitHeadAssetPath);
    if (kind === 'body') {
      return companionRigLayerToManifestLayer(layer, bodyAssetPath);
    }
    if (kind === 'head') {
      return companionRigLayerToManifestLayer(layer, explicitHeadAssetPath ?? layer.relativePath);
    }
    return companionRigLayerToManifestLayer(layer, layer.relativePath);
  });

  if (!resolvedLayers.some((layer) => companionBaseLayerKind(layer, bodyAssetPath, explicitHeadAssetPath) === 'body')) {
    resolvedLayers.push(fallbackBaseRigLayer('body', fallbackBase.rig, bodyAssetPath));
  }

  const fallbackHeadAssetPath = explicitHeadAssetPath
    ?? fallbackBase.rig.layers.find((layer) => companionBaseLayerKind(layer, COMPANION_DEFAULT_BASE_ASSET_PATH, COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH) === 'head')?.relativePath
    ?? COMPANION_DEFAULT_BASE_HEAD_ASSET_PATH;
  if (
    fallbackHeadAssetPath
    && !resolvedLayers.some((layer) => companionBaseLayerKind(layer, bodyAssetPath, explicitHeadAssetPath) === 'head')
  ) {
    resolvedLayers.push(fallbackBaseRigLayer('head', fallbackBase.rig, fallbackHeadAssetPath));
  }

  resolvedLayers.sort((left, right) => left.zIndex - right.zIndex || left.key.localeCompare(right.key));
  const headAssetPath = resolvedLayers.find((layer) => companionBaseLayerKind(layer, bodyAssetPath, explicitHeadAssetPath) === 'head')?.relativePath ?? null;

  return {
    bodyAssetPath,
    bodyAssetUrl: companionAssetUrl(bodyAssetPath),
    headAssetPath,
    headAssetUrl: companionAssetUrl(headAssetPath),
    previewAssetPath: bodyAssetPath,
    previewAssetUrl: companionAssetUrl(bodyAssetPath),
    renderUrl: '/api/companion/render?base=1',
    animatedRenderUrl: '/api/companion/render-animated?base=1',
    rig: rigSource.rig,
    animation: currentBase.animation,
    layers: resolvedLayers,
  };
}

export function companionBaseHeadAssetPath(db: Database) {
  return resolveCompanionBaseConfig(db).headAssetPath;
}

function companionCatalogRows(db: Database) {
  return db.prepare(`
    SELECT slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, render_metadata_json, active, sort_order, created_at
    FROM companion_catalog
    ORDER BY slot_key ASC, sort_order ASC, name ASC
  `).all() as CompanionCatalogRow[];
}

export function companionAssetDimensions(relativePath: string | null | undefined): [number, number] {
  if (!relativePath) return [COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE];

  const target = companionAssetPath(relativePath);
  if (!fileExists(target)) return [COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE];

  const suffix = path.extname(target).toLowerCase();

  try {
    if (suffix === '.png') {
      const header = fs.readFileSync(target).subarray(0, 24);
      if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && header.length >= 24) {
        return [Math.max(1, header.readUInt32BE(16)), Math.max(1, header.readUInt32BE(20))];
      }
    }

    if (suffix === '.gif') {
      const header = fs.readFileSync(target).subarray(0, 10);
      const marker = header.subarray(0, 6).toString('ascii');
      if ((marker === 'GIF87a' || marker === 'GIF89a') && header.length >= 10) {
        return [Math.max(1, header.readUInt16LE(6)), Math.max(1, header.readUInt16LE(8))];
      }
    }

    if (suffix === '.jpg' || suffix === '.jpeg') {
      const buffer = fs.readFileSync(target);
      if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
          if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
          }

          let markerOffset = offset + 1;
          while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) markerOffset += 1;
          if (markerOffset >= buffer.length) break;
          const marker = buffer[markerOffset] ?? 0;
          offset = markerOffset + 1;
          if (marker === 0xd8 || marker === 0xd9) continue;
          if (offset + 2 > buffer.length) break;
          const segmentLength = buffer.readUInt16BE(offset);
          offset += 2;
          if (segmentLength < 2 || offset + segmentLength - 2 > buffer.length) break;
          if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            if (offset + 5 <= buffer.length) {
              return [Math.max(1, buffer.readUInt16BE(offset + 3)), Math.max(1, buffer.readUInt16BE(offset + 1))];
            }
            break;
          }
          offset += segmentLength - 2;
        }
      }
    }

    if (suffix === '.webp') {
      const header = fs.readFileSync(target).subarray(0, 64);
      if (header.length >= 30 && header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') {
        const chunk = header.subarray(12, 16).toString('ascii');
        if (chunk === 'VP8X') {
          const width = 1 + header.readUIntLE(24, 3);
          const height = 1 + header.readUIntLE(27, 3);
          return [Math.max(1, width), Math.max(1, height)];
        }
        if (chunk === 'VP8 ' && header.length >= 30 && header.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
          return [Math.max(1, header.readUInt16LE(26) & 0x3fff), Math.max(1, header.readUInt16LE(28) & 0x3fff)];
        }
        if (chunk === 'VP8L' && header.length >= 25) {
          const bits = header.readUInt32LE(21);
          return [Math.max(1, (bits & 0x3fff) + 1), Math.max(1, ((bits >> 14) & 0x3fff) + 1)];
        }
      }
    }

    if (suffix === '.svg') {
      const svg = fs.readFileSync(target, 'utf8');
      const widthMatch = /\bwidth\s*=\s*['"]([^'"]+)['"]/i.exec(svg);
      const heightMatch = /\bheight\s*=\s*['"]([^'"]+)['"]/i.exec(svg);
      const width = parseSvgLength(widthMatch?.[1]);
      const height = parseSvgLength(heightMatch?.[1]);
      if (width && height) return [width, height];

      const viewBoxMatch = /\bviewBox\s*=\s*['"]([^'"]+)['"]/i.exec(svg);
      if (viewBoxMatch?.[1]) {
        const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
        if (parts.length === 4) {
          const parsedWidth = Math.max(1, Math.round(Number.parseFloat(parts[2] ?? '0')));
          const parsedHeight = Math.max(1, Math.round(Number.parseFloat(parts[3] ?? '0')));
          if (Number.isFinite(parsedWidth) && Number.isFinite(parsedHeight)) {
            return [parsedWidth, parsedHeight];
          }
        }
      }
    }
  } catch {
    return [COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE];
  }

  return [COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE];
}

function defaultCompanionAnimation(assetWidth: number, assetHeight: number): CompanionAnimation {
  return {
    mode: 'static',
    fps: 0,
    frameCount: 1,
    frameWidth: assetWidth,
    frameHeight: assetHeight,
    loop: true,
    sheetWidth: assetWidth,
    sheetHeight: assetHeight,
    frames: [{
      x: 0,
      y: 0,
      width: assetWidth,
      height: assetHeight,
      durationMs: 1000,
      offsetX: 0,
      offsetY: 0,
      sourceWidth: assetWidth,
      sourceHeight: assetHeight,
    }],
  };
}

function normalizeAnimationFrame(entry: Record<string, unknown>, defaultDurationMs: number): CompanionAnimationFrame | null {
  const frameBox = entry.frame && typeof entry.frame === 'object' ? entry.frame as Record<string, unknown> : entry;
  const x = Number(frameBox.x ?? 0);
  const y = Number(frameBox.y ?? 0);
  const width = Number(frameBox.w ?? frameBox.width ?? COMPANION_CANVAS_SIZE);
  const height = Number(frameBox.h ?? frameBox.height ?? COMPANION_CANVAS_SIZE);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;

  const spriteSource = entry.spriteSourceSize && typeof entry.spriteSourceSize === 'object'
    ? entry.spriteSourceSize as Record<string, unknown>
    : {};
  const sourceSize = entry.sourceSize && typeof entry.sourceSize === 'object'
    ? entry.sourceSize as Record<string, unknown>
    : {};
  const offsetX = Number(spriteSource.x ?? entry.offsetX ?? 0);
  const offsetY = Number(spriteSource.y ?? entry.offsetY ?? 0);
  const sourceWidth = Number(sourceSize.w ?? sourceSize.width ?? entry.sourceWidth ?? width);
  const sourceHeight = Number(sourceSize.h ?? sourceSize.height ?? entry.sourceHeight ?? height);
  const durationMs = Number(entry.duration ?? entry.durationMs ?? defaultDurationMs);

  if (![offsetX, offsetY, sourceWidth, sourceHeight, durationMs].every(Number.isFinite)) return null;

  return {
    x: Math.trunc(x),
    y: Math.trunc(y),
    width: Math.trunc(width),
    height: Math.trunc(height),
    durationMs: Math.max(1, Math.trunc(durationMs)),
    offsetX: Math.max(0, Math.trunc(offsetX)),
    offsetY: Math.max(0, Math.trunc(offsetY)),
    sourceWidth: Math.max(Math.trunc(width), Math.trunc(sourceWidth)),
    sourceHeight: Math.max(Math.trunc(height), Math.trunc(sourceHeight)),
  };
}

export function companionAssetAnimation(relativePath: string | null | undefined): CompanionAnimation {
  const [assetWidth, assetHeight] = companionAssetDimensions(relativePath);
  const fallback = defaultCompanionAnimation(assetWidth, assetHeight);
  if (!relativePath) return fallback;

  const target = companionAssetPath(relativePath);
  const sidecarCandidates = [
    `${target}.animation.json`,
    target.replace(/\.[^.]+$/, '.json'),
    `${target}.json`,
  ];
  const sidecar = sidecarCandidates.find((candidate) => fileExists(candidate));
  if (!sidecar) return fallback;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as Record<string, unknown>;
  } catch {
    return fallback;
  }

  const framesPayload = payload.frames;
  const frameEntries = Array.isArray(framesPayload)
    ? framesPayload
    : framesPayload && typeof framesPayload === 'object'
      ? Object.values(framesPayload as Record<string, unknown>)
      : [];
  let normalizedFrames = frameEntries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => normalizeAnimationFrame(entry, 100))
    .filter((frame): frame is CompanionAnimationFrame => Boolean(frame));

  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta as Record<string, unknown> : {};
  const metaSize = meta.size && typeof meta.size === 'object' ? meta.size as Record<string, unknown> : {};

  if (normalizedFrames.length === 1) {
    const firstFrame = normalizedFrames[0];
    const metaWidth = Number(metaSize.w ?? metaSize.width ?? firstFrame.width);
    const metaHeight = Number(metaSize.h ?? metaSize.height ?? firstFrame.height);
    if (
      Number.isFinite(metaWidth)
      && Number.isFinite(metaHeight)
      && firstFrame.x === 0
      && firstFrame.y === 0
      && firstFrame.width === Math.trunc(metaWidth)
      && firstFrame.height === Math.trunc(metaHeight)
    ) {
      if (metaWidth > metaHeight && metaHeight > 0 && metaWidth % metaHeight === 0) {
        const frameSize = Math.trunc(metaHeight);
        const frameCount = Math.trunc(metaWidth / metaHeight);
        normalizedFrames = Array.from({ length: frameCount }, (_, index) => ({
          x: frameSize * index,
          y: 0,
          width: frameSize,
          height: frameSize,
          durationMs: firstFrame.durationMs,
          offsetX: 0,
          offsetY: 0,
          sourceWidth: frameSize,
          sourceHeight: frameSize,
        }));
      } else if (metaHeight > metaWidth && metaWidth > 0 && metaHeight % metaWidth === 0) {
        const frameSize = Math.trunc(metaWidth);
        const frameCount = Math.trunc(metaHeight / metaWidth);
        normalizedFrames = Array.from({ length: frameCount }, (_, index) => ({
          x: 0,
          y: frameSize * index,
          width: frameSize,
          height: frameSize,
          durationMs: firstFrame.durationMs,
          offsetX: 0,
          offsetY: 0,
          sourceWidth: frameSize,
          sourceHeight: frameSize,
        }));
      }
    }
  }

  if (normalizedFrames.length) {
    const totalDurationMs = normalizedFrames.reduce((sum, frame) => sum + frame.durationMs, 0);
    const averageDurationMs = Math.max(1, Math.round(totalDurationMs / normalizedFrames.length));
    const frameWidth = Math.max(...normalizedFrames.map((frame) => frame.sourceWidth ?? frame.width));
    const frameHeight = Math.max(...normalizedFrames.map((frame) => frame.sourceHeight ?? frame.height));
    const sheetWidth = Number(metaSize.w ?? metaSize.width ?? payload.sheetWidth ?? frameWidth);
    const sheetHeight = Number(metaSize.h ?? metaSize.height ?? payload.sheetHeight ?? frameHeight);

    return {
      mode: 'spritesheet',
      fps: Math.max(1, Math.round(1000 / averageDurationMs)),
      frameCount: normalizedFrames.length,
      frameWidth,
      frameHeight,
      loop: true,
      sheetWidth: Math.max(frameWidth, Number.isFinite(sheetWidth) ? Math.trunc(sheetWidth) : frameWidth),
      sheetHeight: Math.max(frameHeight, Number.isFinite(sheetHeight) ? Math.trunc(sheetHeight) : frameHeight),
      frames: normalizedFrames,
    };
  }

  const frameCount = Number(payload.frameCount ?? payload.frames ?? 1);
  const fps = Number(payload.fps ?? 8);
  const frameWidth = Number(payload.frameWidth ?? payload.width ?? COMPANION_CANVAS_SIZE);
  const frameHeight = Number(payload.frameHeight ?? payload.height ?? COMPANION_CANVAS_SIZE);
  const sheetWidth = Number(payload.sheetWidth ?? frameWidth);
  const sheetHeight = Number(payload.sheetHeight ?? frameHeight);
  const mode = String(payload.mode ?? (frameCount > 1 ? 'spritesheet' : 'static')).trim().toLowerCase();
  if (![frameCount, fps, frameWidth, frameHeight, sheetWidth, sheetHeight].every(Number.isFinite)) return fallback;
  if (mode !== 'spritesheet' || frameCount <= 1) return fallback;

  return {
    mode: 'spritesheet',
    fps: Math.max(1, Math.trunc(fps)),
    frameCount: Math.max(1, Math.trunc(frameCount)),
    frameWidth: Math.max(1, Math.trunc(frameWidth)),
    frameHeight: Math.max(1, Math.trunc(frameHeight)),
    loop: Boolean(payload.loop ?? true),
    sheetWidth: Math.max(Math.trunc(frameWidth), Math.trunc(sheetWidth)),
    sheetHeight: Math.max(Math.trunc(frameHeight), Math.trunc(sheetHeight)),
    frames: Array.from({ length: Math.max(1, Math.trunc(frameCount)) }, (_, index) => ({
      x: Math.trunc(frameWidth) * index,
      y: 0,
      width: Math.trunc(frameWidth),
      height: Math.trunc(frameHeight),
      durationMs: Math.max(1, Math.round(1000 / Math.max(1, fps))),
      offsetX: 0,
      offsetY: 0,
      sourceWidth: Math.trunc(frameWidth),
      sourceHeight: Math.trunc(frameHeight),
    })),
  };
}

export function companionAnimationSourceDimensions(animation: CompanionAnimation): [number, number] {
  if (!animation.frames.length) return [COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE];
  const width = Math.max(...animation.frames.map((frame) => frame.sourceWidth ?? frame.width));
  const height = Math.max(...animation.frames.map((frame) => frame.sourceHeight ?? frame.height));
  return [Math.max(1, width), Math.max(1, height)];
}

export function companionAssetRig(
  relativePath: string | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
): CompanionRig {
  const fallback: CompanionRig = {
    width: Math.max(1, Math.trunc(sourceWidth)),
    height: Math.max(1, Math.trunc(sourceHeight)),
    parts: [],
    layers: [],
    slotGroups: { ...COMPANION_DEFAULT_SLOT_GROUPS },
    slotAnchors: { ...COMPANION_DEFAULT_SLOT_ANCHORS },
    motionChannels: defaultMotionChannels(),
    motionAccents: defaultMotionAccents(),
  };

  if (!relativePath) return fallback;
  const target = companionAssetPath(relativePath);
  const sidecarCandidates = [`${target}.rig.json`, target.replace(/\.[^.]+$/, '.rig.json')];
  const sidecar = sidecarCandidates.find((candidate) => fileExists(candidate));
  if (!sidecar) return fallback;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as Record<string, unknown>;
  } catch {
    return fallback;
  }

  const parts = Array.isArray(payload.parts)
    ? payload.parts
      .filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === 'object')
      .map((part, index) => {
        const source = normalizeRect(part.source, fallback.width, fallback.height);
        const targetRect = normalizeRect(part.target, fallback.width, fallback.height);
        if (!source || !targetRect) return null;
        return {
          key: String(part.key ?? `part-${index + 1}`),
          motionGroup: String(part.motionGroup ?? '').trim() || null,
          source,
          target: targetRect,
        };
      })
      .filter((part): part is CompanionRigPart => Boolean(part))
    : [];

  const layers = Array.isArray(payload.layers)
    ? payload.layers
      .filter((layer): layer is Record<string, unknown> => Boolean(layer) && typeof layer === 'object')
      .map((layer, index) => {
        const rawPath = layer.relativePath ?? layer.assetPath ?? layer.path;
        if (!rawPath) return null;
        try {
          return {
            key: String(layer.key ?? `layer-${index + 1}`),
            role: String(layer.role ?? layer.key ?? `base-layer-${index + 1}`),
            relativePath: normalizeCompanionAssetPath(String(rawPath)),
            motionGroup: String(layer.motionGroup ?? '').trim() || null,
            zIndex: Math.trunc(Number(layer.zIndex ?? 20)),
          };
        } catch {
          return null;
        }
      })
      .filter((layer): layer is CompanionRigLayer => Boolean(layer))
    : [];

  const motionChannels = defaultMotionChannels();
  if (payload.motionChannels && typeof payload.motionChannels === 'object') {
    for (const [channelKey, channelValue] of Object.entries(payload.motionChannels as Record<string, unknown>)) {
      const normalized = normalizeMotionChannel(channelValue);
      if (normalized) {
        motionChannels[String(channelKey)] = normalized;
      }
    }
  }

  const rawMotionAccents = payload.motionAccents ?? payload.accents;
  const motionAccents = Array.isArray(rawMotionAccents)
    ? rawMotionAccents
      .map((accent, index) => normalizeMotionAccent(accent, `accent-${index + 1}`))
      .filter((accent): accent is CompanionMotionAccent => Boolean(accent))
    : fallback.motionAccents;

  const slotGroups: Partial<Record<CompanionSlotKey, string>> = { ...COMPANION_DEFAULT_SLOT_GROUPS };
  if (payload.slotGroups && typeof payload.slotGroups === 'object') {
    for (const [slotKey, group] of Object.entries(payload.slotGroups as Record<string, unknown>)) {
      if (COMPANION_SLOT_ORDER.includes(slotKey as CompanionSlotKey) && group) {
        slotGroups[slotKey as CompanionSlotKey] = String(group);
      }
    }
  }

  const slotAnchors: Partial<Record<CompanionSlotKey, CompanionRenderPoint>> = { ...COMPANION_DEFAULT_SLOT_ANCHORS };
  if (payload.slotAnchors && typeof payload.slotAnchors === 'object') {
    for (const [slotKey, point] of Object.entries(payload.slotAnchors as Record<string, unknown>)) {
      if (!COMPANION_SLOT_ORDER.includes(slotKey as CompanionSlotKey)) continue;
      const normalizedPoint = normalizePoint(point);
      if (normalizedPoint) {
        slotAnchors[slotKey as CompanionSlotKey] = normalizedPoint;
      }
    }
  }

  const width = Number(payload.width ?? fallback.width);
  const height = Number(payload.height ?? fallback.height);
  return {
    width: Number.isFinite(width) ? Math.max(1, Math.trunc(width)) : fallback.width,
    height: Number.isFinite(height) ? Math.max(1, Math.trunc(height)) : fallback.height,
    parts,
    layers,
    slotGroups,
    slotAnchors,
    motionChannels,
    motionAccents,
  };
}

type CompanionResolvedScene = {
  width: number;
  height: number;
  layers: CompanionManifestLayer[];
  baseConfig: CompanionBaseConfig;
};

type CompanionSceneCanvas = {
  width: number;
  height: number;
  roundToPixels?: boolean;
};

function roundRectToPixels(rect: Rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  } satisfies Rect;
}

function fullLayerSlice(
  relativePath: string,
  key: string,
  targetRect: Rect | undefined,
  motionGroup: string | null = null,
  canvas: CompanionSceneCanvas = {
    width: COMPANION_CANVAS_SIZE,
    height: COMPANION_CANVAS_SIZE,
    roundToPixels: false,
  },
): CompanionRenderSlice {
  const animation = companionAssetAnimation(relativePath);
  const [sourceWidth, sourceHeight] = companionAnimationSourceDimensions(animation);
  const resolvedTarget = targetRect ?? {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  } satisfies Rect;
  const normalizedTarget = canvas.roundToPixels ? roundRectToPixels(resolvedTarget) : resolvedTarget;
  return {
    key,
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
    targetX: normalizedTarget.x,
    targetY: normalizedTarget.y,
    targetWidth: normalizedTarget.width,
    targetHeight: normalizedTarget.height,
    motionGroup,
  };
}

function resolveSlotAnchor(
  rig: CompanionRig,
  slot: CompanionSlotKey,
  metadata: CompanionItemRenderMetadata,
) {
  const slotAnchor = rig.slotAnchors[slot] ?? COMPANION_DEFAULT_SLOT_ANCHORS[slot] ?? { x: rig.width / 2, y: rig.height / 2 };
  return {
    x: metadata.baseRect.x + ((slotAnchor.x / Math.max(1, rig.width)) * metadata.baseRect.width),
    y: metadata.baseRect.y + ((slotAnchor.y / Math.max(1, rig.height)) * metadata.baseRect.height),
  };
}

function normalizeDocRectToCanvas(
  docRect: Rect,
  metadata: CompanionItemRenderMetadata,
  canvas: CompanionSceneCanvas,
) {
  const normalized = {
    x: ((docRect.x - metadata.baseRect.x) / Math.max(1, metadata.baseRect.width)) * canvas.width,
    y: ((docRect.y - metadata.baseRect.y) / Math.max(1, metadata.baseRect.height)) * canvas.height,
    width: (docRect.width / Math.max(1, metadata.baseRect.width)) * canvas.width,
    height: (docRect.height / Math.max(1, metadata.baseRect.height)) * canvas.height,
  } satisfies Rect;
  return canvas.roundToPixels ? roundRectToPixels(normalized) : normalized;
}

function metadataLayerSlices(
  row: CompanionCatalogRow,
  side: 'front' | 'back',
  slot: CompanionSlotKey,
  rig: CompanionRig,
  canvas: CompanionSceneCanvas,
): CompanionRenderSlice[] {
  const metadata = companionItemRenderMetadataFromRow(row);
  if (!metadata) return [];

  const piece = side === 'front' ? metadata.pieces.front : metadata.pieces.back;
  if (!piece) return [];

  const slotAnchorDoc = resolveSlotAnchor(rig, slot, metadata);
  const targetDocRect = {
    x: piece.docRect.x + (slotAnchorDoc.x - metadata.mount.x),
    y: piece.docRect.y + (slotAnchorDoc.y - metadata.mount.y),
    width: piece.docRect.width,
    height: piece.docRect.height,
  } satisfies Rect;
  const normalizedTarget = normalizeDocRectToCanvas(targetDocRect, metadata, canvas);
  const slotMotionGroup = rig.slotGroups[slot] ?? null;

  return [{
    key: `${row.slug}-${side}`,
    sourceX: 0,
    sourceY: 0,
    sourceWidth: piece.docRect.width,
    sourceHeight: piece.docRect.height,
    targetX: normalizedTarget.x,
    targetY: normalizedTarget.y,
    targetWidth: normalizedTarget.width,
    targetHeight: normalizedTarget.height,
    motionGroup: slotMotionGroup,
  }];
}

function sceneBoundsFromLayers(layers: CompanionManifestLayer[], canvas: CompanionSceneCanvas) {
  let minX = 0;
  let minY = 0;
  let maxX = canvas.width;
  let maxY = canvas.height;

  for (const layer of layers) {
    for (const slice of layer.slices) {
      minX = Math.min(minX, slice.targetX);
      minY = Math.min(minY, slice.targetY);
      maxX = Math.max(maxX, slice.targetX + slice.targetWidth);
      maxY = Math.max(maxY, slice.targetY + slice.targetHeight);
    }
  }

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function normalizeSceneLayers(layers: CompanionManifestLayer[], canvas: CompanionSceneCanvas) {
  const bounds = sceneBoundsFromLayers(layers, canvas);
  if (bounds.minX === 0 && bounds.minY === 0) {
    return {
      width: bounds.width,
      height: bounds.height,
      layers,
    };
  }

  return {
    width: bounds.width,
    height: bounds.height,
    layers: layers.map((layer) => ({
      ...layer,
      slices: layer.slices.map((slice) => ({
        ...slice,
        targetX: slice.targetX - bounds.minX,
        targetY: slice.targetY - bounds.minY,
      })),
    })),
  };
}

function companionItemLayer(
  row: CompanionCatalogRow,
  side: 'front' | 'back',
  zIndex: number,
  baseConfig: CompanionBaseConfig,
  canvas: CompanionSceneCanvas,
): CompanionManifestLayer | null {
  const relativePath = side === 'front' ? row.front_asset_path : row.back_asset_path;
  if (!relativePath) return null;

  const metadata = companionItemRenderMetadataFromRow(row);
  const metadataSlices = metadataLayerSlices(row, side, row.slot_key, baseConfig.rig, canvas);
  return {
    key: `${row.slot_key}-${side}`,
    role: `${row.slot_key}-${side}`,
    slot: row.slot_key,
    relativePath,
    zIndex,
    sceneFacingFlip: metadata?.sceneFacingFlip ?? 'allow',
    motionGroup: null,
    slices: metadataSlices.length
      ? metadataSlices
      : [fullLayerSlice(relativePath, `${row.slug}-${side}`, undefined, baseConfig.rig.slotGroups[row.slot_key] ?? null, canvas)],
  };
}

export function resolveCompanionLayerScene(
  db: Database,
  loadout: Record<CompanionSlotKey, string | null>,
  canvas: CompanionSceneCanvas = {
    width: COMPANION_CANVAS_SIZE,
    height: COMPANION_CANVAS_SIZE,
    roundToPixels: false,
  },
): CompanionResolvedScene {
  const layers: CompanionManifestLayer[] = [];
  const catalog = new Map(companionCatalogRows(db).map((row) => [row.slug, row]));
  const baseConfig = resolveCompanionBaseConfig(db);

  const slotZIndices: Record<CompanionSlotKey, { front: number; back: number }> = {
    hat: { back: 34, front: 55 },
    face: { back: 34, front: 45 },
    neck: { back: 28, front: 30 },
    body: { back: 10, front: 65 },
  };

  for (const slot of COMPANION_SLOT_ORDER) {
    const itemSlug = loadout[slot];
    const item = itemSlug ? catalog.get(itemSlug) : undefined;
    if (!item) continue;
    const backLayer = companionItemLayer(item, 'back', slotZIndices[slot].back, baseConfig, canvas);
    if (backLayer) layers.push(backLayer);
  }

  layers.push(...baseConfig.layers.map((layer) => ({
    ...layer,
    sceneFacingFlip: layer.sceneFacingFlip ?? 'allow',
    slices: layer.slices.length
      ? layer.slices.map((slice) => ({ ...slice }))
      : [fullLayerSlice(layer.relativePath, layer.key, undefined, layer.motionGroup, canvas)],
  })));

  for (const slot of COMPANION_SLOT_ORDER) {
    const itemSlug = loadout[slot];
    const item = itemSlug ? catalog.get(itemSlug) : undefined;
    if (!item) continue;
    const frontLayer = companionItemLayer(item, 'front', slotZIndices[slot].front, baseConfig, canvas);
    if (frontLayer) layers.push(frontLayer);
  }

  const orderedLayers = layers
    .filter((layer) => Boolean(layer.relativePath) && layer.slices.length > 0)
    .sort((left, right) => left.zIndex - right.zIndex || left.key.localeCompare(right.key));
  const normalizedScene = normalizeSceneLayers(orderedLayers, canvas);

  return {
    width: normalizedScene.width,
    height: normalizedScene.height,
    layers: normalizedScene.layers,
    baseConfig,
  };
}

export function resolveCompanionLayerSpecs(
  db: Database,
  loadout: Record<CompanionSlotKey, string | null>,
): CompanionManifestLayer[] {
  return resolveCompanionLayerScene(db, loadout).layers;
}

export function companionRenderManifest(
  db: Database,
  loadout: Record<CompanionSlotKey, string | null>,
) {
  const scene = resolveCompanionLayerScene(db, loadout, {
    width: COMPANION_STAGE_CANVAS_SIZE,
    height: COMPANION_STAGE_CANVAS_SIZE,
    roundToPixels: true,
  });

  const layers = scene.layers
    .map((layer) => {
      const src = companionAssetUrl(layer.relativePath);
      if (!src) return null;

      const animation = layer.relativePath === scene.baseConfig.bodyAssetPath ? scene.baseConfig.animation : companionAssetAnimation(layer.relativePath);
      const motionGroup = layer.motionGroup || (layer.slot ? scene.baseConfig.rig.slotGroups[layer.slot] ?? null : null);

      return {
        key: layer.key,
        role: layer.role,
        src,
        zIndex: layer.zIndex,
        animation,
        sceneFacingFlip: layer.sceneFacingFlip,
        slot: layer.slot,
        motionGroup,
        slices: layer.slices,
      };
    })
    .filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));

  return {
    width: scene.width,
    height: scene.height,
    motion: {
      shadowOpacity: COMPANION_DEFAULT_SHADOW_OPACITY,
      rootGroup: 'root',
      channels: scene.baseConfig.rig.motionChannels,
      slotGroups: scene.baseConfig.rig.slotGroups,
      accents: scene.baseConfig.rig.motionAccents,
    },
    debug: {
      slotAnchors: scene.baseConfig.rig.slotAnchors,
      shadowRect: resolveStageShadowRect(scene.width, scene.height),
    },
    layers,
  } satisfies CompanionRenderManifest;
}

export async function readMultipartFormData(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new AppError('Expected multipart/form-data for companion asset uploads.', 400);
  }

  try {
    return await request.formData();
  } catch {
    throw new AppError('Expected multipart/form-data for companion asset uploads.', 400);
  }
}

export async function uploadedCompanionAssetFromFormData(formData: FormData, fieldName: string) {
  const entry = formData.get(fieldName);
  if (!(entry instanceof File)) return null;
  const filename = path.basename(entry.name || '');
  const data = Buffer.from(await entry.arrayBuffer());
  return {
    filename,
    contentType: entry.type || 'application/octet-stream',
    data,
  } satisfies UploadedCompanionAsset;
}

export function storeUploadedCompanionAsset(
  upload: UploadedCompanionAsset,
  options: { group: string; stem: string },
) {
  const filename = path.basename(upload.filename || '');
  const extension = path.extname(filename).toLowerCase();
  if (!(extension in COMPANION_ALLOWED_ASSET_MIME_TYPES)) {
    throw new AppError('Upload a PNG, SVG, GIF, WEBP, JPG, or JPEG companion asset.', 400);
  }
  if (!upload.data.length) {
    throw new AppError('Uploaded companion asset was empty.', 400);
  }
  if (upload.data.length > COMPANION_MAX_UPLOAD_BYTES) {
    throw new AppError('Companion asset uploads are capped at 4 MB.', 400);
  }

  const safeStem = slugify(options.stem || path.parse(filename).name || 'companion-asset');
  const uniqueName = `${safeStem}-${Math.random().toString(16).slice(2, 10)}${extension}`;
  return writeCompanionAssetFile(`uploads/${options.group}/${uniqueName}`, upload.data);
}

export function repoCompanionImportCandidates(db: Database): CompanionRepoImportCandidate[] {
  const itemsRoot = path.join(repoCompanionAssetDir(), 'defaults', 'items');
  if (!fs.existsSync(itemsRoot) || !fs.statSync(itemsRoot).isDirectory()) {
    return [];
  }

  const existingSlugs = new Set(companionCatalogRows(db).map((row) => row.slug));
  const candidatesBySlug = new Map<string, CompanionRepoImportCandidate>();

  for (const entry of fs.readdirSync(itemsRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.ghostling.json')) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!(extension in COMPANION_ALLOWED_ASSET_MIME_TYPES)) continue;

    let layer: 'front' | 'back' | null = null;
    let baseName = path.parse(entry.name).name;
    if (baseName.endsWith('-front')) {
      layer = 'front';
      baseName = baseName.slice(0, -6);
    } else if (baseName.endsWith('-back')) {
      layer = 'back';
      baseName = baseName.slice(0, -5);
    }
    if (!layer) continue;

    const slug = slugify(baseName);
    const relativePath = `repo/defaults/items/${entry.name}`;
    const candidate = candidatesBySlug.get(slug) ?? {
      slug,
      name: humanizeIdentifier(slug),
      suggestedSlot: null,
      suggestedRarity: null,
      suggestedCost: null,
      suggestedDescription: null,
      frontAssetPath: null,
      frontAssetUrl: null,
      backAssetPath: null,
      backAssetUrl: null,
      renderMetadataPath: null,
      renderMetadata: null,
      renderMetadataErrors: [],
    };

    if (layer === 'front') {
      candidate.frontAssetPath = relativePath;
      candidate.frontAssetUrl = companionAssetUrl(relativePath);
    } else {
      candidate.backAssetPath = relativePath;
      candidate.backAssetUrl = companionAssetUrl(relativePath);
    }
    candidatesBySlug.set(slug, candidate);
  }

  for (const entry of fs.readdirSync(itemsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ghostling.json')) continue;
    const baseName = entry.name.slice(0, -'.ghostling.json'.length);
    const slug = slugify(baseName);
    const relativePath = `repo/defaults/items/${entry.name}`;
    const candidate = candidatesBySlug.get(slug) ?? {
      slug,
      name: humanizeIdentifier(slug),
      suggestedSlot: null,
      suggestedRarity: null,
      suggestedCost: null,
      suggestedDescription: null,
      frontAssetPath: null,
      frontAssetUrl: null,
      backAssetPath: null,
      backAssetUrl: null,
      renderMetadataPath: null,
      renderMetadata: null,
      renderMetadataErrors: [],
    };

    const metadataResult = tryParseCompanionItemRenderMetadata(fs.readFileSync(path.join(itemsRoot, entry.name), 'utf8'), {
      expectedSlot: candidate.suggestedSlot ?? undefined,
      frontAssetPresent: Boolean(candidate.frontAssetPath),
      backAssetPresent: Boolean(candidate.backAssetPath),
    });
    candidate.renderMetadataPath = relativePath;
    candidate.renderMetadata = metadataResult.metadata;
    candidate.renderMetadataErrors = metadataResult.errors;
    candidate.suggestedSlot = metadataResult.metadata?.slot ?? candidate.suggestedSlot;
    candidatesBySlug.set(slug, candidate);
  }

  return [...candidatesBySlug.values()]
    .filter((candidate) => !existingSlugs.has(candidate.slug) && Boolean(candidate.frontAssetPath || candidate.backAssetPath))
    .sort((left, right) => left.name.localeCompare(right.name));
}
