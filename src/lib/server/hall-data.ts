import 'server-only';

import { cache } from 'react';
import { getConfiguredLoginHref } from '@/lib/auth/server-config';
import { getPythonJSON } from '@/lib/server/python-proxy';
import type { HallDashboardData, ShellData } from '@/lib/types';

function normalizeHallPath(nextPath: string) {
  return nextPath.startsWith('/') ? nextPath : '/hall/';
}

function withNextLoginHref(shellData: ShellData, nextPath: string): ShellData {
  const loginHref = getConfiguredLoginHref(nextPath);

  return {
    ...shellData,
    auth: {
      ...shellData.auth,
      canSignIn: Boolean(loginHref),
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
