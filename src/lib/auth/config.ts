function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

const DEV_AUTH_SECRET = 'ghosted-local-dev-auth-secret';
const DISCORD_CALLBACK_PATH_SUFFIX = '/callback/discord';

export function getAuthSecret() {
  const configuredSecret = normalizeEnvValue(process.env.AUTH_SECRET);
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_AUTH_SECRET;
  }

  return undefined;
}

export function isDiscordAuthConfigured() {
  return Boolean(
    normalizeEnvValue(process.env.DISCORD_CLIENT_ID)
    && normalizeEnvValue(process.env.DISCORD_CLIENT_SECRET),
  );
}

export function getDiscordRedirectUri() {
  const configuredRedirectUri = normalizeEnvValue(process.env.DISCORD_REDIRECT_URI);
  if (!configuredRedirectUri) {
    return undefined;
  }

  try {
    return new URL(configuredRedirectUri);
  } catch {
    return undefined;
  }
}

export function getDiscordRedirectProxyUrl() {
  const redirectUri = getDiscordRedirectUri();
  if (!redirectUri) {
    return undefined;
  }

  if (!redirectUri.pathname.endsWith(DISCORD_CALLBACK_PATH_SUFFIX)) {
    return undefined;
  }

  const proxyUrl = new URL(redirectUri.toString());
  const basePath = proxyUrl.pathname.slice(0, -DISCORD_CALLBACK_PATH_SUFFIX.length);

  proxyUrl.pathname = basePath || '/';
  proxyUrl.search = '';
  proxyUrl.hash = '';

  return proxyUrl.toString().replace(/\/+$/, '');
}
