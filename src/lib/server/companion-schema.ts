import 'server-only';

import type { Database } from 'better-sqlite3';
import { utcIso } from '@/lib/server/core';

export const COMPANION_DEFAULT_BASE_ASSET_PATH = 'repo/defaults/base/ghostling-base-body.png';

const COMPANION_LEGACY_BASE_ASSET_PATHS = new Set([
  'repo/defaults/base/ghostling-base-body.png',
  'repo/defaults/base/ghostling-base.svg',
  'repo/defaults/base/ghostling-base-animated.png',
]);

export function ensureDefaultCompanionBase(db: Database) {
  const row = db.prepare(`
    SELECT base_asset_path
    FROM companion_settings
    WHERE singleton_key = 'default'
  `).get() as { base_asset_path: string | null } | undefined;

  if (row) {
    const current = String(row.base_asset_path ?? '').trim();
    if (!current || COMPANION_LEGACY_BASE_ASSET_PATHS.has(current)) {
      db.prepare(`
        UPDATE companion_settings
        SET base_asset_path = ?, updated_at = ?
        WHERE singleton_key = 'default'
      `).run(COMPANION_DEFAULT_BASE_ASSET_PATH, utcIso());
    }
    return;
  }

  db.prepare(`
    INSERT INTO companion_settings (singleton_key, base_asset_path, updated_at)
    VALUES ('default', ?, ?)
  `).run(COMPANION_DEFAULT_BASE_ASSET_PATH, utcIso());
}

export function removeLegacyDefaultCompanionAssets(db: Database) {
  const rows = db.prepare(`
    SELECT slug
    FROM companion_catalog
    WHERE front_asset_path LIKE 'defaults/%'
       OR back_asset_path LIKE 'defaults/%'
       OR front_asset_path LIKE 'repo/defaults/items/%'
       OR back_asset_path LIKE 'repo/defaults/items/%'
  `).all() as Array<{ slug: string }>;

  if (rows.length) {
    const placeholders = rows.map(() => '?').join(', ');
    db.prepare(`DELETE FROM companion_catalog WHERE slug IN (${placeholders})`).run(...rows.map((row) => row.slug));
  }

  db.prepare(`
    UPDATE companion_settings
    SET base_asset_path = ?, updated_at = ?
    WHERE singleton_key = 'default'
      AND (
        base_asset_path IS NULL
        OR TRIM(base_asset_path) = ''
        OR base_asset_path LIKE 'defaults/%'
        OR base_asset_path LIKE 'repo/defaults/base/%'
        OR base_asset_path IN (?, ?, ?)
      )
  `).run(
    COMPANION_DEFAULT_BASE_ASSET_PATH,
    utcIso(),
    'repo/defaults/base/ghostling-base-body.png',
    'repo/defaults/base/ghostling-base.svg',
    'repo/defaults/base/ghostling-base-animated.png',
  );
}
