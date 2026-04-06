import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import type {
  CompanionAnimationFrame,
  CompanionLayerAnimation,
  CompanionMotionChannel,
  CompanionRepoImportCandidate,
  CompanionRenderSlice,
  CompanionSlotKey,
} from '@/lib/types';
import { AppError, envText, humanizeIdentifier, slugify } from '@/lib/server/core';
import { COMPANION_DEFAULT_BASE_ASSET_PATH, ensureDefaultCompanionBase } from '@/lib/server/companion-schema';

export { COMPANION_DEFAULT_BASE_ASSET_PATH } from '@/lib/server/companion-schema';

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

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  motionChannels: Record<string, CompanionMotionChannel>;
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
  slot: CompanionSlotKey | null;
  motionGroup: string | null;
  slices: CompanionRenderSlice[];
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
  active: number;
  sort_order: number;
  created_at: string;
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
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...relativeParts);
  const relative = path.relative(resolvedRoot, target);
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

export function companionAssetDir() {
  const configured = envText('COMPANION_ASSET_DIR');
  if (configured) return path.resolve(configured);

  const configuredDatabasePath = envText('DATABASE_PATH');
  if (configuredDatabasePath) {
    return path.join(path.dirname(path.resolve(configuredDatabasePath)), 'companion-assets');
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
  if (path.resolve(legacyRoot) !== path.resolve(companionAssetDir())) {
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

export function companionBaseAssetPath(db: Database) {
  ensureDefaultCompanionBase(db);
  const row = db.prepare(`
    SELECT base_asset_path
    FROM companion_settings
    WHERE singleton_key = 'default'
  `).get() as { base_asset_path: string | null } | undefined;
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

function companionCatalogRows(db: Database) {
  return db.prepare(`
    SELECT slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, active, sort_order, created_at
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
    motionChannels: defaultMotionChannels(),
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
      if (!channelValue || typeof channelValue !== 'object') continue;
      const channel = channelValue as Record<string, unknown>;
      const normalized: CompanionMotionChannel = {};
      for (const axisKey of ['offsetX', 'offsetY'] as const) {
        const axis = channel[axisKey];
        if (!axis || typeof axis !== 'object') continue;
        const axisShape = axis as Record<string, unknown>;
        const amplitude = Number(axisShape.amplitude ?? 0);
        const durationMs = Number(axisShape.durationMs ?? 1000);
        const phase = Number(axisShape.phase ?? 0);
        if (!Number.isFinite(amplitude) || !Number.isFinite(durationMs) || !Number.isFinite(phase)) continue;
        normalized[axisKey] = {
          amplitude,
          durationMs: Math.max(1, Math.trunc(durationMs)),
          phase,
        };
      }
      if (normalized.offsetX || normalized.offsetY) {
        motionChannels[String(channelKey)] = normalized;
      }
    }
  }

  const slotGroups: Partial<Record<CompanionSlotKey, string>> = { ...COMPANION_DEFAULT_SLOT_GROUPS };
  if (payload.slotGroups && typeof payload.slotGroups === 'object') {
    for (const [slotKey, group] of Object.entries(payload.slotGroups as Record<string, unknown>)) {
      if (COMPANION_SLOT_ORDER.includes(slotKey as CompanionSlotKey) && group) {
        slotGroups[slotKey as CompanionSlotKey] = String(group);
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
    motionChannels,
  };
}

export function resolveCompanionLayerSpecs(
  db: Database,
  loadout: Record<CompanionSlotKey, string | null>,
): CompanionManifestLayer[] {
  const layers: CompanionManifestLayer[] = [];
  const catalog = new Map(companionCatalogRows(db).map((row) => [row.slug, row]));
  const bodySlug = loadout.body;
  const bodyItem = bodySlug ? catalog.get(bodySlug) : undefined;
  if (bodyItem?.back_asset_path) {
    layers.push({
      key: 'body-back',
      role: 'body-back',
      slot: 'body',
      relativePath: bodyItem.back_asset_path,
      zIndex: 10,
      motionGroup: null,
      slices: [],
    });
  }

  const basePath = companionBaseAssetPath(db);
  const baseAnimation = basePath ? companionAssetAnimation(basePath) : defaultCompanionAnimation(COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE);
  const [baseSourceWidth, baseSourceHeight] = companionAnimationSourceDimensions(baseAnimation);
  const baseRig = companionAssetRig(basePath, baseSourceWidth, baseSourceHeight);

  if (baseRig.layers.length) {
    for (const rigLayer of baseRig.layers) {
      layers.push({
        key: rigLayer.key,
        role: rigLayer.role,
        slot: null,
        relativePath: rigLayer.relativePath,
        zIndex: rigLayer.zIndex,
        motionGroup: rigLayer.motionGroup,
        slices: [],
      });
    }
  } else if (basePath) {
    layers.push({
      key: 'base',
      role: 'base',
      slot: null,
      relativePath: basePath,
      zIndex: 20,
      motionGroup: null,
      slices: [],
    });
  }

  const slotZIndices: Record<'neck' | 'face' | 'hat', number> = {
    neck: 30,
    face: 45,
    hat: 55,
  };
  for (const slot of ['neck', 'face', 'hat'] as const) {
    const item = loadout[slot] ? catalog.get(loadout[slot] as string) : undefined;
    if (item?.front_asset_path) {
      layers.push({
        key: `${slot}-front`,
        role: `${slot}-front`,
        slot,
        relativePath: item.front_asset_path,
        zIndex: slotZIndices[slot],
        motionGroup: null,
        slices: [],
      });
    }
  }

  if (bodyItem?.front_asset_path) {
    layers.push({
      key: 'body-front',
      role: 'body-front',
      slot: 'body',
      relativePath: bodyItem.front_asset_path,
      zIndex: 65,
      motionGroup: null,
      slices: [],
    });
  }

  return layers;
}

export function companionRenderManifest(
  db: Database,
  loadout: Record<CompanionSlotKey, string | null>,
) {
  const basePath = companionBaseAssetPath(db);
  const baseAnimation = basePath ? companionAssetAnimation(basePath) : defaultCompanionAnimation(COMPANION_CANVAS_SIZE, COMPANION_CANVAS_SIZE);
  const [baseSourceWidth, baseSourceHeight] = companionAnimationSourceDimensions(baseAnimation);
  const baseRig = companionAssetRig(basePath, baseSourceWidth, baseSourceHeight);
  let manifestWidth = Math.max(COMPANION_CANVAS_SIZE, baseRig.width);
  let manifestHeight = Math.max(COMPANION_CANVAS_SIZE, baseRig.height);

  const layers = resolveCompanionLayerSpecs(db, loadout)
    .map((layer) => {
      const src = companionAssetUrl(layer.relativePath);
      if (!src) return null;

      const animation = layer.relativePath === basePath ? baseAnimation : companionAssetAnimation(layer.relativePath);
      const [sourceWidth, sourceHeight] = companionAnimationSourceDimensions(animation);
      manifestWidth = Math.max(manifestWidth, sourceWidth);
      manifestHeight = Math.max(manifestHeight, sourceHeight);
      const motionGroup = layer.motionGroup || (layer.slot ? baseRig.slotGroups[layer.slot] ?? null : null);

      const slices = layer.role === 'base'
        ? baseRig.parts.map((part) => ({
          key: part.key,
          sourceX: part.source.x,
          sourceY: part.source.y,
          sourceWidth: part.source.width,
          sourceHeight: part.source.height,
          targetX: part.target.x,
          targetY: part.target.y,
          targetWidth: part.target.width,
          targetHeight: part.target.height,
          motionGroup: part.motionGroup,
        }))
        : [];

      return {
        key: layer.key,
        role: layer.role,
        src,
        zIndex: layer.zIndex,
        animation,
        slot: layer.slot,
        motionGroup,
        slices,
      };
    })
    .filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));

  return {
    width: manifestWidth,
    height: manifestHeight,
    motion: {
      shadowOpacity: COMPANION_DEFAULT_SHADOW_OPACITY,
      rootGroup: 'root',
      channels: baseRig.motionChannels,
      slotGroups: baseRig.slotGroups,
    },
    layers,
  };
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
      frontAssetPath: '',
      frontAssetUrl: null,
      backAssetPath: null,
      backAssetUrl: null,
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

  return [...candidatesBySlug.values()]
    .filter((candidate) => !existingSlugs.has(candidate.slug) && Boolean(candidate.frontAssetPath))
    .sort((left, right) => left.name.localeCompare(right.name));
}
