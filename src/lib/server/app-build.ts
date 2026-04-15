import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

let cachedBuildId: string | null = null;
let cachedDevSurfaceVersion = '';
let cachedDevSurfaceVersionAt = 0;

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readBuildIdFromDisk() {
  const candidatePaths = [
    path.join(process.cwd(), '.next', 'BUILD_ID'),
    path.join(process.cwd(), '.next', 'standalone', '.next', 'BUILD_ID'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const value = fs.readFileSync(candidatePath, 'utf8').trim();
      if (value) {
        return value;
      }
    } catch {
      // Ignore missing build files and continue to the next fallback.
    }
  }

  return null;
}

function readPackageVersion() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return packageJson.version?.trim() || 'dev';
  } catch {
    return 'dev';
  }
}

function walkLatestModifiedAt(rootPath: string) {
  let latestModifiedAt = 0;
  const queue = [rootPath];

  while (queue.length > 0) {
    const currentPath = queue.pop();
    if (!currentPath) {
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      try {
        const stats = fs.statSync(absolutePath);
        latestModifiedAt = Math.max(latestModifiedAt, Math.trunc(stats.mtimeMs));
      } catch {
        // Ignore files that disappear mid-scan during local iteration.
      }
    }
  }

  return latestModifiedAt;
}

function readDevSurfaceVersion() {
  const now = Date.now();
  if (cachedDevSurfaceVersion && (now - cachedDevSurfaceVersionAt) < 1500) {
    return cachedDevSurfaceVersion;
  }

  const roots = [
    path.join(process.cwd(), 'public', 'giveaways', 'sprites'),
    path.join(process.cwd(), 'src', 'app', 'v', 'giveaways'),
  ];

  const latestModifiedAt = roots.reduce((currentLatest, rootPath) => (
    Math.max(currentLatest, walkLatestModifiedAt(rootPath))
  ), 0);

  cachedDevSurfaceVersion = latestModifiedAt > 0 ? String(latestModifiedAt) : 'dev';
  cachedDevSurfaceVersionAt = now;
  return cachedDevSurfaceVersion;
}

export function getGhostedBuildId() {
  const baseBuildId = firstNonEmpty([
    process.env.GHOSTED_BUILD_ID,
    process.env.NEXT_PUBLIC_APP_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    readBuildIdFromDisk(),
  ]) ?? `pkg-${readPackageVersion()}`;

  if (process.env.NODE_ENV !== 'production') {
    return `${baseBuildId}-surface-${readDevSurfaceVersion()}`;
  }

  if (cachedBuildId) {
    return cachedBuildId;
  }

  cachedBuildId = baseBuildId;

  return cachedBuildId;
}
