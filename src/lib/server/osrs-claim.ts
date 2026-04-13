import 'server-only';

import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { recordAudit } from '@/lib/server/audit';
import { sendDiscordDirectMessage } from '@/lib/server/discord';
import { AppError, parseIso, utcIso, utcNow } from '@/lib/server/core';
import { setUserPublicNameSource } from '@/lib/server/osrs-identity';
import { getUserGameAccount, updateUserGameAccountClaimMetadata, womLinkPayload } from '@/lib/server/wom';

const OSRS_CLAIM_CHALLENGE_TTL_MS = 15 * 60 * 1000;

type CurrentUserLike = {
  id: number;
  discord_id: string;
};

type OsrsClaimChallengeRow = {
  id: number;
  user_id: number;
  requested_username: string;
  wom_player_id: number | null;
  code_hash: string;
  status: string;
  expires_at: string;
  created_at: string;
  redeemed_at: string | null;
  redeemed_username: string | null;
};

function normalizeRuneScapeUsername(username: string) {
  return String(username ?? '').trim().toLowerCase();
}

function hashClaimCode(code: string) {
  return crypto
    .createHash('sha256')
    .update(String(code ?? '').trim())
    .digest('hex');
}

function generateClaimCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function getActiveChallengeByCodeHash(
  db: Database,
  codeHash: string,
) {
  return db.prepare(`
    SELECT *
    FROM osrs_claim_challenges
    WHERE code_hash = ?
    LIMIT 1
  `).get(codeHash) as OsrsClaimChallengeRow | undefined;
}

function markSupersededChallenges(
  db: Database,
  userId: number,
) {
  db.prepare(`
    UPDATE osrs_claim_challenges
    SET status = 'superseded'
    WHERE user_id = ?
      AND status = 'issued'
      AND redeemed_at IS NULL
  `).run(userId);
}

function formatClaimChallengeMessage(requestedUsername: string, code: string, expiresAt: string) {
  return [
    'Ghosted OSRS claim challenge',
    `RuneScape username: ${requestedUsername}`,
    `One-time code: ${code}`,
    `Expires: ${expiresAt}`,
    'Enter this code into the Ghosted RuneLite plugin to verify your linked username.',
  ].join('\n');
}

export async function createOsrsClaimChallenge(
  db: Database,
  user: CurrentUserLike,
) {
  const account = getUserGameAccount(db, user.id, 'osrs');
  if (!account) {
    throw new AppError('Link a Wise Old Man RuneScape account first.', 404);
  }

  const requestedUsername = String(account.username ?? '').trim();
  if (!requestedUsername) {
    throw new AppError('Your linked RuneScape username could not be resolved.', 409);
  }

  const nowIso = utcIso();
  const expiresAtIso = utcIso(new Date(Date.now() + OSRS_CLAIM_CHALLENGE_TTL_MS));
  const code = generateClaimCode();
  const codeHash = hashClaimCode(code);

  markSupersededChallenges(db, user.id);
  db.prepare(`
    INSERT INTO osrs_claim_challenges (
      user_id,
      requested_username,
      wom_player_id,
      code_hash,
      status,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?, 'issued', ?, ?)
  `).run(
    user.id,
    requestedUsername,
    account.wom_player_id,
    codeHash,
    expiresAtIso,
    nowIso,
  );

  await sendDiscordDirectMessage(
    user.discord_id,
    formatClaimChallengeMessage(requestedUsername, code, expiresAtIso),
  );

  recordAudit(user.id, 'issue_osrs_claim_challenge', 'user_game_account', String(account.id), {
    requestedUsername,
    womPlayerId: account.wom_player_id,
    expiresAt: expiresAtIso,
  });

  return {
    requestedUsername,
    expiresAt: expiresAtIso,
  };
}

export async function redeemOsrsClaimChallenge(
  db: Database,
  input: {
    code: string;
    username: string;
  },
) {
  const code = String(input.code ?? '').trim();
  const username = String(input.username ?? '').trim();
  if (!code || !username) {
    throw new AppError('Code and username are required.', 400);
  }

  const challenge = getActiveChallengeByCodeHash(db, hashClaimCode(code));
  if (!challenge || challenge.status !== 'issued') {
    throw new AppError('That claim code is invalid or has already been used.', 404);
  }

  const now = utcNow();
  const expiresAt = parseIso(challenge.expires_at);
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
    db.prepare(`
      UPDATE osrs_claim_challenges
      SET status = 'expired'
      WHERE id = ?
    `).run(challenge.id);
    throw new AppError('That claim code has expired.', 410);
  }

  if (normalizeRuneScapeUsername(challenge.requested_username) !== normalizeRuneScapeUsername(username)) {
    throw new AppError('That RuneScape username does not match the issued claim challenge.', 400);
  }

  const verifiedAt = utcIso(now);
  const account = updateUserGameAccountClaimMetadata(db, challenge.user_id, 'osrs', {
    claimSource: 'runelite_plugin',
    verifiedAt,
  });
  setUserPublicNameSource(db, challenge.user_id, 'osrs');

  db.prepare(`
    UPDATE osrs_claim_challenges
    SET status = 'redeemed',
        redeemed_at = ?,
        redeemed_username = ?
    WHERE id = ?
  `).run(verifiedAt, username, challenge.id);

  recordAudit(challenge.user_id, 'redeem_osrs_claim_challenge', 'user_game_account', String(account.id), {
    requestedUsername: challenge.requested_username,
    redeemedUsername: username,
    verifiedAt,
  });

  return womLinkPayload(db, challenge.user_id);
}
