function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

const DEV_AUTH_SECRET = 'ghosted-local-dev-auth-secret';

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
