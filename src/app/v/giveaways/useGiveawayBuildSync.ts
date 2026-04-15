'use client';

import { useEffect, useRef } from 'react';

const BUILD_CHECK_INTERVAL_MS = 15000;

export function useGiveawayBuildSync(buildId: string) {
  const buildIdRef = useRef(buildId);

  useEffect(() => {
    buildIdRef.current = buildId;
  }, [buildId]);

  useEffect(() => {
    let disposed = false;

    async function syncBuild() {
      try {
        const response = await fetch('/api/v/giveaways/build', {
          cache: 'no-store',
        });
        if (!response.ok || disposed) {
          return;
        }

        const payload = await response.json() as { buildId?: string };
        const nextBuildId = payload.buildId?.trim();
        if (!nextBuildId || disposed) {
          return;
        }

        if (nextBuildId !== buildIdRef.current) {
          window.location.reload();
        }
      } catch {
        // Keep the host and overlay surfaces alive if the build probe fails.
      }
    }

    const intervalId = window.setInterval(() => {
      void syncBuild();
    }, BUILD_CHECK_INTERVAL_MS);

    const handleFocus = () => {
      void syncBuild();
    };

    window.addEventListener('focus', handleFocus);
    void syncBuild();

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}
