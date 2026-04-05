import type { Session } from 'next-auth';
import { getAuthDb } from '@/lib/auth/db';

type DiscordProfile = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

type UpsertedLegacyUser = {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  roles: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function adminDiscordIds() {
  return new Set(
    String(process.env.ADMIN_DISCORD_IDS ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function discordAvatarUrl(discordId: string, avatarHash?: string | null) {
  if (!avatarHash) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=128`;
}

export async function fetchDiscordRoles(discordId: string) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) return [] as string[];

  try {
    const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: 'application/json',
        'User-Agent': process.env.DISCORD_USER_AGENT ?? 'GhostedNextAuth/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) return [] as string[];
    const payload = await response.json() as { roles?: string[] };
    return Array.isArray(payload.roles) ? payload.roles.map((role) => String(role)) : [];
  } catch {
    return [] as string[];
  }
}

function ensureUserRewards(db: ReturnType<typeof getAuthDb>, userId: number, roles: string[]) {
  const memberRoleId = process.env.DISCORD_MEMBER_ROLE_ID?.trim();
  const startingBalance = 250;
  const memberRoleBonus = 100;

  const existingWelcome = db
    .prepare("SELECT 1 FROM reward_ledger WHERE user_id = ? AND entry_type = 'welcome_bonus' LIMIT 1")
    .get(userId);
  if (!existingWelcome) {
    db.prepare(`
      INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      startingBalance,
      'welcome_bonus',
      'Welcome bonus for linking your Discord account.',
      JSON.stringify({ source: 'next_auth' }),
      nowIso(),
    );
  }

  if (memberRoleId && roles.includes(memberRoleId)) {
    const existingRoleBonus = db
      .prepare("SELECT 1 FROM reward_ledger WHERE user_id = ? AND entry_type = 'role_bonus' LIMIT 1")
      .get(userId);
    if (!existingRoleBonus) {
      db.prepare(`
        INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        memberRoleBonus,
        'role_bonus',
        'Member role bonus for verified Ghosted members.',
        JSON.stringify({ role_id: memberRoleId }),
        nowIso(),
      );
    }
  }
}

export function getLegacyUserById(userId: string | number | null | undefined) {
  if (!userId) return null;
  const db = getAuthDb();
  const row = db.prepare(`
    SELECT id, discord_id, username, global_name, avatar_hash, roles_json, is_admin
    FROM users
    WHERE id = ?
  `).get(Number(userId)) as
    | {
      id: number;
      discord_id: string;
      username: string;
      global_name: string | null;
      avatar_hash: string | null;
      roles_json: string;
      is_admin: number;
    }
    | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    discordId: row.discord_id,
    username: row.username,
    displayName: row.global_name || row.username,
    avatarUrl: discordAvatarUrl(row.discord_id, row.avatar_hash),
    isAdmin: Boolean(row.is_admin),
    roles: JSON.parse(row.roles_json || '[]') as string[],
  };
}

export async function upsertLegacyUserFromDiscord(
  profile: DiscordProfile,
  account?: {
    provider?: string;
    providerAccountId?: string;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
  } | null,
): Promise<UpsertedLegacyUser> {
  const db = getAuthDb();
  const roles = await fetchDiscordRoles(profile.id);
  const isAdmin = adminDiscordIds().has(profile.id);
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO users (discord_id, username, global_name, avatar_hash, roles_json, is_admin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      username = excluded.username,
      global_name = excluded.global_name,
      avatar_hash = excluded.avatar_hash,
      roles_json = excluded.roles_json,
      is_admin = excluded.is_admin,
      updated_at = excluded.updated_at
  `).run(
    profile.id,
    profile.username ?? 'ghosted-member',
    profile.global_name ?? null,
    profile.avatar ?? null,
    JSON.stringify(roles),
    isAdmin ? 1 : 0,
    timestamp,
    timestamp,
  );

  const row = db.prepare(`
    SELECT id, discord_id, username, global_name, avatar_hash, is_admin
    FROM users
    WHERE discord_id = ?
  `).get(profile.id) as {
    id: number;
    discord_id: string;
    username: string;
    global_name: string | null;
    avatar_hash: string | null;
    is_admin: number;
  };

  ensureUserRewards(db, row.id, roles);

  if (account?.provider && account?.providerAccountId) {
    db.prepare(`
      INSERT INTO auth_accounts (
        provider,
        provider_account_id,
        user_id,
        access_token,
        refresh_token,
        expires_at,
        token_type,
        scope,
        id_token,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_account_id) DO UPDATE SET
        user_id = excluded.user_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        token_type = excluded.token_type,
        scope = excluded.scope,
        id_token = excluded.id_token,
        updated_at = excluded.updated_at
    `).run(
      account.provider,
      account.providerAccountId,
      row.id,
      account.access_token ?? null,
      account.refresh_token ?? null,
      account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
      account.token_type ?? null,
      account.scope ?? null,
      account.id_token ?? null,
      timestamp,
      timestamp,
    );
  }

  return {
    id: String(row.id),
    discordId: row.discord_id,
    username: row.username,
    displayName: row.global_name || row.username,
    avatarUrl: discordAvatarUrl(row.discord_id, row.avatar_hash),
    isAdmin: Boolean(row.is_admin),
    roles,
  };
}

export function enrichSessionUser(
  session: (Session & { user?: { id?: string; image?: string | null } }) | null,
) {
  if (!session?.user?.id) return session;
  const legacyUser = getLegacyUserById(session.user.id);
  if (!legacyUser) return session;

  return {
    ...session,
    user: {
      ...session.user,
      id: legacyUser.id,
      discordId: legacyUser.discordId,
      username: legacyUser.username,
      displayName: legacyUser.displayName,
      avatarUrl: legacyUser.avatarUrl ?? undefined,
      isAdmin: legacyUser.isAdmin,
      roles: legacyUser.roles,
      image: legacyUser.avatarUrl ?? session.user.image ?? undefined,
      name: legacyUser.displayName,
    },
  };
}
