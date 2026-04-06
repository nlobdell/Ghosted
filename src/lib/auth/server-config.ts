import 'server-only';
import { isDiscordAuthConfigured } from '@/lib/auth/config';

export { isDiscordAuthConfigured } from '@/lib/auth/config';

function normalizeNextPath(nextPath: string) {
  return nextPath.startsWith('/') ? nextPath : '/hall/';
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
