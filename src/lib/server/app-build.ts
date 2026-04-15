import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

let cachedBuildId: string | null = null;

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

export function getGhostedBuildId() {
  if (cachedBuildId) {
    return cachedBuildId;
  }

  cachedBuildId = firstNonEmpty([
    process.env.GHOSTED_BUILD_ID,
    process.env.NEXT_PUBLIC_APP_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    readBuildIdFromDisk(),
  ]) ?? `pkg-${readPackageVersion()}`;

  return cachedBuildId;
}
