import 'server-only';

import type { Database } from 'better-sqlite3';
import { utcIso } from '@/lib/server/core';

export type PublicNameSource = 'discord' | 'osrs';
export type OsrsClaimSource = 'manual_wom' | 'runelite_plugin';

export type UserOsrsIdentityColumns = {
  public_name_source?: string | null;
  osrs_player_id?: number | null;
  osrs_username?: string | null;
  osrs_display_name?: string | null;
  osrs_claim_source?: string | null;
  osrs_claimed_at?: string | null;
  osrs_verified_at?: string | null;
};

export function primaryOsrsIdentityJoin(
  userAlias = 'users',
  accountAlias = 'primary_osrs_account',
) {
  return `LEFT JOIN user_game_accounts AS ${accountAlias}
    ON ${accountAlias}.user_id = ${userAlias}.id
    AND ${accountAlias}.game = 'osrs'
    AND ${accountAlias}.is_primary = 1`;
}

export function primaryOsrsIdentitySelect(
  userAlias = 'users',
  accountAlias = 'primary_osrs_account',
) {
  return `
    ${userAlias}.public_name_source AS public_name_source,
    ${accountAlias}.wom_player_id AS osrs_player_id,
    ${accountAlias}.username AS osrs_username,
    ${accountAlias}.display_name AS osrs_display_name,
    ${accountAlias}.claim_source AS osrs_claim_source,
    ${accountAlias}.claimed_at AS osrs_claimed_at,
    ${accountAlias}.verified_at AS osrs_verified_at
  `;
}

export function resolveDiscordDisplayName(
  user: Pick<{ username: string; global_name: string | null }, 'username' | 'global_name'>,
) {
  return user.global_name || user.username;
}

export function normalizePublicNameSource(value: unknown): PublicNameSource {
  return String(value ?? '').trim().toLowerCase() === 'osrs'
    ? 'osrs'
    : 'discord';
}

export function normalizeOsrsClaimSource(value: unknown): OsrsClaimSource | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'manual_wom') return 'manual_wom';
  if (normalized === 'runelite_plugin') return 'runelite_plugin';
  return null;
}

export function resolveClaimedOsrsDisplayName(user: UserOsrsIdentityColumns) {
  const displayName = String(user.osrs_display_name ?? '').trim();
  if (displayName) return displayName;
  const username = String(user.osrs_username ?? '').trim();
  return username || null;
}

export function resolvePublicDisplayName(
  user: Pick<{ username: string; global_name: string | null }, 'username' | 'global_name'> & UserOsrsIdentityColumns,
) {
  const preferredSource = normalizePublicNameSource(user.public_name_source);
  const claimedOsrsName = resolveClaimedOsrsDisplayName(user);
  if (preferredSource === 'osrs' && claimedOsrsName) {
    return claimedOsrsName;
  }
  return resolveDiscordDisplayName(user);
}

export function setUserPublicNameSource(
  db: Database,
  userId: number,
  source: PublicNameSource,
) {
  db.prepare(`
    UPDATE users
    SET public_name_source = ?, updated_at = ?
    WHERE id = ?
  `).run(source, utcIso(), userId);
}
