import 'server-only';

import { cache } from 'react';
import { getPythonJSON } from '@/lib/server/python-proxy';
import type { HallDashboardData, ShellData } from '@/lib/types';

function normalizeHallPath(nextPath: string) {
  return nextPath.startsWith('/') ? nextPath : '/hall/';
}

function withNextLoginHref(shellData: ShellData, nextPath: string): ShellData {
  const loginHref = process.env.ENABLE_DEV_AUTH === 'true'
    ? `/auth/dev-login?next=${encodeURIComponent(nextPath)}`
    : `/auth/login?next=${encodeURIComponent(nextPath)}`;

  return {
    ...shellData,
    auth: {
      ...shellData.auth,
      canSignIn: true,
      loginHref,
    },
  };
}

export const getHallShellData = cache(async (nextPath: string): Promise<ShellData | null> => {
  const normalizedNextPath = normalizeHallPath(nextPath);
  const response = await getPythonJSON<ShellData>(`/api/site-shell?next=${encodeURIComponent(normalizedNextPath)}`);
  return response.ok && response.data ? withNextLoginHref(response.data, normalizedNextPath) : null;
});

export const getHallDashboardData = cache(async (): Promise<HallDashboardData | null> => {
  const response = await getPythonJSON<HallDashboardData>('/api/hall/dashboard');
  return response.ok ? response.data : null;
});
