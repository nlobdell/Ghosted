import fs from 'node:fs';
import path from 'node:path';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

const COMPANION_ALLOWED_ASSET_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function companionAssetDir() {
  const configured = process.env.COMPANION_ASSET_DIR?.trim();
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);

  const configuredDatabasePath = process.env.DATABASE_PATH?.trim();
  if (configuredDatabasePath) {
    return path.join(
      path.dirname(path.resolve(/*turbopackIgnore: true*/ configuredDatabasePath)),
      'companion-assets',
    );
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'companion-assets');
}

function legacyCompanionAssetDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'companion-assets');
}

function repoCompanionAssetDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'assets', 'companion');
}

function fileExists(targetPath: string) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function normalizeCompanionAssetPath(value: string) {
  const raw = String(value ?? '').trim().replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
    throw new AppError('Companion asset not found.', 404);
  }

  const parts = raw.split('/').filter((part) => part && part !== '.');
  if (!parts.length || parts.some((part) => part === '..')) {
    throw new AppError('Companion asset not found.', 404);
  }

  return parts.join('/');
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

function companionRepoDefaultRelativePath(relativePath: string) {
  if (relativePath.startsWith('repo/') || relativePath.startsWith('uploads/')) return null;
  if (!relativePath.startsWith('defaults/')) return null;
  return `repo/${relativePath}`;
}

function companionAssetPath(relativePath: string) {
  const normalized = normalizeCompanionAssetPath(relativePath);
  const repoFallback = companionRepoDefaultRelativePath(normalized);
  if (repoFallback) {
    const repoTarget = resolveCompanionStorageTarget(repoCompanionAssetDir(), repoFallback.split('/').slice(1));
    if (fileExists(repoTarget)) return repoTarget;
  }

  const parts = normalized.split('/');
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

function companionAssetMimeType(relativePath: string) {
  const target = companionAssetPath(relativePath);
  const extension = path.extname(target).toLowerCase();
  return COMPANION_ALLOWED_ASSET_MIME_TYPES[extension] ?? 'application/octet-stream';
}

export const GET = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await context.params;
  const relativePath = path.join('/');
  const target = companionAssetPath(relativePath);

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new AppError('Companion asset not found.', 404);
  }

  const body = fs.readFileSync(target);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': companionAssetMimeType(relativePath),
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'no-store',
    },
  });
});
