import 'server-only';

import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { recordAudit } from '@/lib/server/audit';
import { AppError, parseIso, utcIso, utcNow } from '@/lib/server/core';
import { setUserPublicNameSource } from '@/lib/server/osrs-identity';
import {
  deleteUserGameAccount,
  getUserGameAccount,
  saveUserGameAccount,
  updateUserGameAccountClaimMetadata,
  womCachedJson,
  womGroupId,
  womLinkPayload,
  womResolvePlayerForLink,
} from '@/lib/server/wom';

const RUNELITE_PAIRING_TTL_MS = 15 * 60 * 1000;
const RUNELITE_POLL_AFTER_SECONDS = 5;
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type CurrentUserLike = {
  id: number;
};

type RunelitePairingRow = {
  id: string;
  user_code: string;
  poll_token_hash: string;
  requested_account_hash: string;
  requested_username: string;
  launcher_display_name: string | null;
  plugin_version: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  approved_at: string | null;
  approved_by_user_id: number | null;
};

type RuneliteAccountLinkRow = {
  account_hash: string;
  user_id: number;
  current_username: string;
  launcher_display_name: string | null;
  plugin_version: string | null;
  linked_at: string;
  last_verified_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArrayOfRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    : [];
}

function normalizeAccountHash(value: unknown) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new AppError('accountHash must be sent as a string to preserve 64-bit precision.', 400);
    }
    return normalizeAccountHash(String(value));
  }

  const normalized = String(value ?? '').trim();
  if (!normalized || !/^-?\d+$/.test(normalized)) {
    throw new AppError('A valid RuneLite account hash is required.', 400);
  }

  if (normalized === '0' || normalized === '-1') {
    throw new AppError('Log into RuneLite before linking your account.', 400);
  }

  return normalized;
}

function normalizeUsername(value: unknown) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new AppError('A RuneScape username is required.', 400);
  }
  return normalized;
}

function normalizeLauncherDisplayName(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, 128) : null;
}

function normalizePluginVersion(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, 32) : null;
}

function normalizeUserCode(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (normalized.length !== 8) {
    throw new AppError('That RuneLite pairing code is invalid.', 400);
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

function hashPollToken(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken(size = 24) {
  return crypto.randomBytes(size).toString('base64url');
}

function randomCodePart(length = 4) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += USER_CODE_ALPHABET[bytes[index] % USER_CODE_ALPHABET.length];
  }
  return result;
}

function generateUserCode() {
  return `${randomCodePart()}-${randomCodePart()}`;
}

function requireWomGroupId() {
  const groupId = womGroupId();
  if (groupId === undefined) {
    throw new AppError('Wise Old Man integration is not configured yet.', 503);
  }
  return groupId;
}

function playerInGroup(groupId: number, memberships: Array<Record<string, unknown>>) {
  const target = String(groupId);
  return memberships.some((membership) => {
    const group = asRecord(membership.group);
    return String(membership.groupId ?? '') === target || String(group.id ?? '') === target;
  });
}

function getRunelitePairingById(db: Database, pairingId: string) {
  return db.prepare(`
    SELECT *
    FROM runelite_pairings
    WHERE id = ?
    LIMIT 1
  `).get(pairingId) as RunelitePairingRow | undefined;
}

function getRunelitePairingByUserCode(db: Database, userCode: string) {
  return db.prepare(`
    SELECT *
    FROM runelite_pairings
    WHERE user_code = ?
    LIMIT 1
  `).get(userCode) as RunelitePairingRow | undefined;
}

function getRunelitePairingByPollTokenHash(db: Database, pollTokenHash: string) {
  return db.prepare(`
    SELECT *
    FROM runelite_pairings
    WHERE poll_token_hash = ?
    LIMIT 1
  `).get(pollTokenHash) as RunelitePairingRow | undefined;
}

function getRuneliteAccountLinkByAccountHash(db: Database, accountHash: string) {
  return db.prepare(`
    SELECT *
    FROM runelite_account_links
    WHERE account_hash = ?
    LIMIT 1
  `).get(accountHash) as RuneliteAccountLinkRow | undefined;
}

function getRuneliteAccountLinkByUserId(db: Database, userId: number) {
  return db.prepare(`
    SELECT *
    FROM runelite_account_links
    WHERE user_id = ?
    LIMIT 1
  `).get(userId) as RuneliteAccountLinkRow | undefined;
}

function requireRunelitePairing<T>(pairing: T | undefined, message: string) {
  if (!pairing) {
    throw new AppError(message, 404);
  }
  return pairing;
}

function isPairingExpired(pairing: RunelitePairingRow) {
  const expiresAt = parseIso(pairing.expires_at);
  return !expiresAt || expiresAt.getTime() <= utcNow().getTime();
}

function updatePairingStatus(
  db: Database,
  pairingId: string,
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'conflict',
  input: {
    approvedAt?: string | null;
    approvedByUserId?: number | null;
  } = {},
) {
  db.prepare(`
    UPDATE runelite_pairings
    SET status = ?,
        approved_at = ?,
        approved_by_user_id = ?
    WHERE id = ?
  `).run(
    status,
    input.approvedAt ?? null,
    input.approvedByUserId ?? null,
    pairingId,
  );
  return getRunelitePairingById(db, pairingId)!;
}

function refreshPairingStatus(db: Database, pairing: RunelitePairingRow) {
  if (pairing.status === 'pending' && isPairingExpired(pairing)) {
    return updatePairingStatus(db, pairing.id, 'expired');
  }
  return pairing;
}

function touchRuneliteAccountLink(
  db: Database,
  link: RuneliteAccountLinkRow,
  input: {
    username: string;
    launcherDisplayName?: string | null;
    pluginVersion?: string | null;
  },
) {
  const nowIso = utcIso();
  db.prepare(`
    UPDATE runelite_account_links
    SET current_username = ?,
        launcher_display_name = ?,
        plugin_version = ?,
        last_seen_at = ?,
        updated_at = ?
    WHERE account_hash = ?
  `).run(
    input.username,
    input.launcherDisplayName ?? link.launcher_display_name,
    input.pluginVersion ?? link.plugin_version,
    nowIso,
    nowIso,
    link.account_hash,
  );
  return getRuneliteAccountLinkByAccountHash(db, link.account_hash)!;
}

function runeliteLinkStatusPayload(link?: RuneliteAccountLinkRow | null) {
  if (!link) {
    return {
      linked: false,
      accountHash: null,
      username: null,
      launcherDisplayName: null,
      pluginVersion: null,
      linkedAt: null,
      lastVerifiedAt: null,
      lastSeenAt: null,
    };
  }

  return {
    linked: true,
    accountHash: link.account_hash,
    username: link.current_username,
    launcherDisplayName: link.launcher_display_name,
    pluginVersion: link.plugin_version,
    linkedAt: link.linked_at,
    lastVerifiedAt: link.last_verified_at,
    lastSeenAt: link.last_seen_at,
  };
}

function approvedPairingStatusPayload(link: RuneliteAccountLinkRow) {
  return {
    status: 'approved' as const,
    link: {
      accountHash: link.account_hash,
      username: link.current_username,
      linkedAt: link.linked_at,
      womLinked: true,
    },
  };
}

export function runeliteLinkPayload(db: Database, userId: number) {
  return runeliteLinkStatusPayload(getRuneliteAccountLinkByUserId(db, userId));
}

export function getRuneliteVerificationPairing(
  db: Database,
  userCode: string,
) {
  const pairing = refreshPairingStatus(
    db,
    requireRunelitePairing(
      getRunelitePairingByUserCode(db, normalizeUserCode(userCode)),
      'That RuneLite pairing code is invalid.',
    ),
  );

  return {
    id: pairing.id,
    userCode: pairing.user_code,
    username: pairing.requested_username,
    expiresAt: pairing.expires_at,
    status: pairing.status,
    launcherDisplayName: pairing.launcher_display_name,
  };
}

export function startRunelitePairing(
  db: Database,
  input: {
    accountHash: unknown;
    username: unknown;
    launcherDisplayName?: unknown;
    pluginVersion?: unknown;
    publicOrigin: string;
  },
) {
  const accountHash = normalizeAccountHash(input.accountHash);
  const username = normalizeUsername(input.username);
  const launcherDisplayName = normalizeLauncherDisplayName(input.launcherDisplayName);
  const pluginVersion = normalizePluginVersion(input.pluginVersion);
  const existingLink = getRuneliteAccountLinkByAccountHash(db, accountHash);

  if (existingLink) {
    const touched = touchRuneliteAccountLink(db, existingLink, {
      username,
      launcherDisplayName,
      pluginVersion,
    });

    return {
      status: 'already_linked' as const,
      link: runeliteLinkStatusPayload(touched),
    };
  }

  const now = utcNow();
  const pairingId = crypto.randomUUID();
  const userCode = generateUserCode();
  const pollToken = randomToken();
  const expiresAt = new Date(now.getTime() + RUNELITE_PAIRING_TTL_MS);

  db.prepare(`
    INSERT INTO runelite_pairings (
      id,
      user_code,
      poll_token_hash,
      requested_account_hash,
      requested_username,
      launcher_display_name,
      plugin_version,
      status,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    pairingId,
    userCode,
    hashPollToken(pollToken),
    accountHash,
    username,
    launcherDisplayName,
    pluginVersion,
    utcIso(expiresAt),
    utcIso(now),
  );

  recordAudit(null, 'start_runelite_pairing', 'runelite_pairing', pairingId, {
    accountHash,
    username,
    launcherDisplayName,
    pluginVersion,
    expiresAt: utcIso(expiresAt),
  });

  return {
    pairingId,
    userCode,
    verificationUrl: `${input.publicOrigin.replace(/\/+$/, '')}/runelite/link?code=${encodeURIComponent(userCode)}`,
    pollToken,
    pollAfterSeconds: RUNELITE_POLL_AFTER_SECONDS,
    expiresAt: utcIso(expiresAt),
  };
}

export function runelitePairingStatus(
  db: Database,
  pollToken: string,
) {
  const normalizedToken = String(pollToken ?? '').trim();
  if (!normalizedToken) {
    throw new AppError('pollToken is required.', 400);
  }

  const pairing = refreshPairingStatus(
    db,
    requireRunelitePairing(
      getRunelitePairingByPollTokenHash(db, hashPollToken(normalizedToken)),
      'That RuneLite pairing was not found.',
    ),
  );

  if (pairing.status === 'approved') {
    const link = getRuneliteAccountLinkByAccountHash(db, pairing.requested_account_hash);
    if (!link) {
      return { status: 'expired' as const, expiresAt: pairing.expires_at };
    }
    return approvedPairingStatusPayload(link);
  }

  if (pairing.status === 'pending') {
    return {
      status: 'pending' as const,
      expiresAt: pairing.expires_at,
    };
  }

  return {
    status: pairing.status as 'denied' | 'expired' | 'conflict',
    expiresAt: pairing.expires_at,
  };
}

export async function confirmRunelitePairing(
  db: Database,
  user: CurrentUserLike,
  input: {
    userCode: unknown;
  },
) {
  const userCode = normalizeUserCode(input.userCode);
  const existingPairing = getRunelitePairingByUserCode(db, userCode);
  if (!existingPairing) {
    throw new AppError('That RuneLite pairing code is invalid.', 404);
  }

  const pairing = refreshPairingStatus(db, existingPairing);
  if (pairing.status === 'approved' && pairing.approved_by_user_id === user.id) {
    const link = getRuneliteAccountLinkByAccountHash(db, pairing.requested_account_hash);
    if (!link) {
      throw new AppError('The approved RuneLite link could not be resolved.', 409);
    }
    return {
      ok: true,
      message: 'RuneLite account linked.',
      link: runeliteLinkStatusPayload(link),
      wom: await womLinkPayload(db, user.id),
    };
  }

  if (pairing.status !== 'pending') {
    if (pairing.status === 'expired') {
      throw new AppError('That RuneLite pairing has expired.', 410);
    }
    if (pairing.status === 'conflict') {
      throw new AppError('That RuneLite account is already linked to a different Ghosted user.', 409);
    }
    if (pairing.status === 'denied') {
      throw new AppError('That RuneLite pairing can no longer be approved.', 409);
    }
    throw new AppError('That RuneLite pairing is no longer available.', 409);
  }

  const groupId = requireWomGroupId();
  const existingByHash = getRuneliteAccountLinkByAccountHash(db, pairing.requested_account_hash);
  if (existingByHash && existingByHash.user_id !== user.id) {
    updatePairingStatus(db, pairing.id, 'conflict');
    recordAudit(user.id, 'conflict_runelite_pairing', 'runelite_pairing', pairing.id, {
      accountHash: pairing.requested_account_hash,
      existingUserId: existingByHash.user_id,
    });
    throw new AppError('That RuneLite account is already linked to a different Ghosted user.', 409);
  }

  const player = asRecord(await womResolvePlayerForLink(db, pairing.requested_username));
  const playerUsername = normalizeUsername(player.username ?? pairing.requested_username);
  const memberships = asArrayOfRecords(await womCachedJson(db, `/players/${encodeURIComponent(playerUsername)}/groups`));

  if (!playerInGroup(groupId, memberships)) {
    updatePairingStatus(db, pairing.id, 'denied');
    recordAudit(user.id, 'deny_runelite_pairing', 'runelite_pairing', pairing.id, {
      accountHash: pairing.requested_account_hash,
      username: pairing.requested_username,
      reason: 'not_in_group',
    });
    throw new AppError('That Wise Old Man player is not in the configured Ghosted group.', 400);
  }

  const previousUserLink = getRuneliteAccountLinkByUserId(db, user.id);
  const nowIso = utcIso();
  const transaction = db.transaction(() => {
    if (previousUserLink && previousUserLink.account_hash !== pairing.requested_account_hash) {
      db.prepare('DELETE FROM runelite_account_links WHERE account_hash = ?').run(previousUserLink.account_hash);
    }

    db.prepare(`
      INSERT INTO runelite_account_links (
        account_hash,
        user_id,
        current_username,
        launcher_display_name,
        plugin_version,
        linked_at,
        last_verified_at,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_hash) DO UPDATE SET
        user_id = excluded.user_id,
        current_username = excluded.current_username,
        launcher_display_name = excluded.launcher_display_name,
        plugin_version = excluded.plugin_version,
        last_verified_at = excluded.last_verified_at,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `).run(
      pairing.requested_account_hash,
      user.id,
      playerUsername,
      pairing.launcher_display_name,
      pairing.plugin_version,
      existingByHash?.linked_at ?? nowIso,
      nowIso,
      nowIso,
      existingByHash?.created_at ?? nowIso,
      nowIso,
    );

    saveUserGameAccount(db, user.id, 'osrs', player);
    updateUserGameAccountClaimMetadata(db, user.id, 'osrs', {
      claimSource: 'runelite_plugin',
      verifiedAt: nowIso,
    });
    setUserPublicNameSource(db, user.id, 'osrs');
    updatePairingStatus(db, pairing.id, 'approved', {
      approvedAt: nowIso,
      approvedByUserId: user.id,
    });
  });

  try {
    transaction();
  } catch (error) {
    if (error instanceof AppError && error.status === 409) {
      updatePairingStatus(db, pairing.id, 'conflict');
      recordAudit(user.id, 'conflict_runelite_pairing', 'runelite_pairing', pairing.id, {
        accountHash: pairing.requested_account_hash,
        username: playerUsername,
        reason: error.message,
      });
    }
    throw error;
  }

  const link = getRuneliteAccountLinkByAccountHash(db, pairing.requested_account_hash);
  if (!link) {
    throw new AppError('The new RuneLite link could not be loaded.', 500);
  }

  if (previousUserLink && previousUserLink.account_hash !== pairing.requested_account_hash) {
    recordAudit(user.id, 'replace_runelite_account_link', 'runelite_account_link', pairing.requested_account_hash, {
      previousAccountHash: previousUserLink.account_hash,
      nextAccountHash: pairing.requested_account_hash,
      username: playerUsername,
    });
  }

  recordAudit(user.id, 'confirm_runelite_pairing', 'runelite_account_link', pairing.requested_account_hash, {
    username: playerUsername,
    launcherDisplayName: pairing.launcher_display_name,
    pluginVersion: pairing.plugin_version,
    pairingId: pairing.id,
    linkedAt: link.linked_at,
  });

  return {
    ok: true,
    message: 'RuneLite account linked.',
    link: runeliteLinkStatusPayload(link),
    wom: await womLinkPayload(db, user.id),
  };
}

export function deleteRuneliteLink(
  db: Database,
  user: CurrentUserLike,
) {
  const link = getRuneliteAccountLinkByUserId(db, user.id);
  if (link) {
    db.prepare('DELETE FROM runelite_account_links WHERE account_hash = ?').run(link.account_hash);

    const gameAccount = getUserGameAccount(db, user.id, 'osrs');
    if (gameAccount?.claim_source === 'runelite_plugin') {
      deleteUserGameAccount(db, user.id, 'osrs');
      setUserPublicNameSource(db, user.id, 'discord');
    }

    recordAudit(user.id, 'unlink_runelite_account_link', 'runelite_account_link', link.account_hash, {
      username: link.current_username,
    });
  }

  return runeliteLinkStatusPayload(getRuneliteAccountLinkByUserId(db, user.id));
}
