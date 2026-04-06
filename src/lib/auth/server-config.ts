import 'server-only';

function normalizeNextPath(nextPath: string) {
  return nextPath.startsWith('/') ? nextPath : '/hall/';
}

export function isDiscordAuthConfigured() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID?.trim()
    && process.env.DISCORD_CLIENT_SECRET?.trim(),
  );
}

export function getConfiguredLoginHref(nextPath: string) {
  const normalizedNextPath = normalizeNextPath(nextPath);

  if (process.env.ENABLE_DEV_AUTH === 'true') {
    return `/auth/dev-login?next=${encodeURIComponent(normalizedNextPath)}`;
  }

  if (!isDiscordAuthConfigured()) {
    return undefined;
  }

  return `/auth/login?next=${encodeURIComponent(normalizedNextPath)}`;
}
