import 'server-only';

import { envText, jsonLoad } from '@/lib/server/core';

export type RoleDirectory = Record<string, { id: string; label: string; source: string }>;

export type RuntimeAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  guildId?: string;
  botToken?: string;
  memberRoleId?: string;
  vipRoleId?: string;
  giveawayRoleId?: string;
  webhookUrl?: string;
  oauthReady: boolean;
  guildReady: boolean;
};

const DEFAULT_DISCORD_USER_AGENT = 'GhostedNext/1.0';
const ROLE_CACHE_TTL_MS = 60_000;

let roleDirectoryCache:
  | {
    value: RoleDirectory;
    expiresAt: number;
  }
  | null = null;

export function buildRuntimeAuthConfig(): RuntimeAuthConfig {
  const clientId = envText('DISCORD_CLIENT_ID');
  const clientSecret = envText('DISCORD_CLIENT_SECRET');
  const guildId = envText('DISCORD_GUILD_ID');
  const botToken = envText('DISCORD_BOT_TOKEN');

  return {
    clientId,
    clientSecret,
    guildId,
    botToken,
    memberRoleId: envText('DISCORD_MEMBER_ROLE_ID'),
    vipRoleId: envText('DISCORD_VIP_ROLE_ID'),
    giveawayRoleId: envText('DISCORD_GIVEAWAY_ROLE_ID'),
    webhookUrl: envText('DISCORD_WEBHOOK_URL'),
    oauthReady: Boolean(clientId && clientSecret),
    guildReady: Boolean(guildId && botToken),
  };
}

function discordHeaders(extra?: HeadersInit) {
  return {
    Accept: 'application/json',
    'User-Agent': envText('DISCORD_USER_AGENT') ?? DEFAULT_DISCORD_USER_AGENT,
    ...extra,
  };
}

async function discordRequestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    botToken: string;
  },
) {
  const response = await fetch(`https://discord.com/api${path}`, {
    method: options.method ?? 'GET',
    headers: discordHeaders({
      Authorization: `Bot ${options.botToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    }),
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Discord request failed with HTTP ${response.status}.`);
  }

  return await response.json() as T;
}

function roleLabelOverrides() {
  return jsonLoad<Record<string, string>>(envText('DISCORD_ROLE_LABELS_JSON') ?? '', {});
}

async function fetchDiscordGuildRoles(config: RuntimeAuthConfig) {
  if (!config.guildReady || !config.guildId || !config.botToken) {
    return {} as Record<string, string>;
  }

  const response = await fetch(`https://discord.com/api/guilds/${config.guildId}/roles`, {
    headers: discordHeaders({ Authorization: `Bot ${config.botToken}` }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`Discord guild role lookup warning for guild ${config.guildId}: HTTP ${response.status}: ${body}`);
    return {};
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) {
    console.warn(`Discord guild role lookup warning for guild ${config.guildId}: unexpected payload shape.`);
    return {};
  }

  const roles: Record<string, string> = {};
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const roleId = String((entry as { id?: unknown }).id ?? '').trim();
    const roleName = String((entry as { name?: unknown }).name ?? '').trim();
    if (roleId && roleName) {
      roles[roleId] = roleName;
    }
  }
  return roles;
}

export async function buildRoleDirectory(config = buildRuntimeAuthConfig()) {
  const now = Date.now();
  if (roleDirectoryCache && roleDirectoryCache.expiresAt > now) {
    return roleDirectoryCache.value;
  }

  const directory: RoleDirectory = {};
  const remoteRoles = await fetchDiscordGuildRoles(config);
  for (const [roleId, label] of Object.entries(remoteRoles)) {
    directory[roleId] = { id: roleId, label, source: 'discord' };
  }
  for (const [roleId, label] of Object.entries(roleLabelOverrides())) {
    const normalizedId = String(roleId).trim();
    const normalizedLabel = String(label).trim();
    if (!normalizedId || !normalizedLabel) continue;
    directory[normalizedId] = { id: normalizedId, label: normalizedLabel, source: 'alias' };
  }

  roleDirectoryCache = {
    value: directory,
    expiresAt: now + ROLE_CACHE_TTL_MS,
  };
  return directory;
}

export function resolveRole(roleId: string | null | undefined, roleDirectory: RoleDirectory) {
  const normalizedId = String(roleId ?? '').trim();
  if (!normalizedId) return null;
  return roleDirectory[normalizedId] ?? { id: normalizedId, label: normalizedId, source: 'id' };
}

export function resolveRoles(roleIds: string[], roleDirectory: RoleDirectory) {
  const seen = new Set<string>();
  const resolved = [];
  for (const roleId of roleIds) {
    const normalizedId = String(roleId ?? '').trim();
    if (!normalizedId || seen.has(normalizedId)) continue;
    seen.add(normalizedId);
    const role = resolveRole(normalizedId, roleDirectory);
    if (role) resolved.push(role);
  }
  return resolved;
}

export function sortedRoleOptions(roleDirectory: RoleDirectory) {
  return Object.values(roleDirectory).sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    if (labelCompare !== 0) return labelCompare;
    return left.id.localeCompare(right.id, undefined, { sensitivity: 'base' });
  });
}

export async function postWebhook(content: string, config = buildRuntimeAuthConfig()) {
  if (!config.webhookUrl) return;

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: discordHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
      cache: 'no-store',
    });
  } catch {
    return;
  }
}

export async function sendDiscordDirectMessage(
  discordId: string,
  content: string,
  config = buildRuntimeAuthConfig(),
) {
  const recipientId = String(discordId ?? '').trim();
  const message = String(content ?? '').trim();
  if (!recipientId || !message) return;
  if (!config.botToken) {
    throw new Error('Discord bot token is not configured.');
  }

  const dmChannel = await discordRequestJson<{ id: string }>(
    '/users/@me/channels',
    {
      method: 'POST',
      body: { recipient_id: recipientId },
      botToken: config.botToken,
    },
  );

  const channelId = String(dmChannel.id ?? '').trim();
  if (!channelId) {
    throw new Error('Discord DM channel could not be created.');
  }

  await discordRequestJson(
    `/channels/${channelId}/messages`,
    {
      method: 'POST',
      body: { content: message },
      botToken: config.botToken,
    },
  );
}
