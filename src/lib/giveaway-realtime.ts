import type { LootChestRealtimeSocketMessage, LootChestSceneSnapshot } from '@/lib/types';
import { SCENE_REALTIME_PORT } from '@/lib/scene-realtime';

export const LOOT_CHEST_REALTIME_PATH = '/ws/giveaways/loot-chest';
export const LOOT_CHEST_REALTIME_INTERVAL_MS = 250;

export function buildLootChestSocketSnapshotMessage(
  payload: LootChestSceneSnapshot,
  sentAt = new Date().toISOString(),
): LootChestRealtimeSocketMessage {
  return {
    type: 'loot-chest:snapshot',
    payload,
    sentAt,
  };
}

export function buildLootChestSocketErrorMessage(
  retryable = true,
): LootChestRealtimeSocketMessage {
  return {
    type: 'loot-chest:error',
    code: 'unavailable',
    retryable,
  };
}

export function resolveLootChestRealtimeClientUrl(
  overlayToken: string,
  locationValue?: Pick<Location, 'protocol' | 'hostname' | 'port' | 'host'>,
) {
  const normalizedToken = overlayToken.trim();
  const configured = String(process.env.NEXT_PUBLIC_SCENE_REALTIME_URL ?? '').trim();
  const url = configured
    ? new URL(configured)
    : (() => {
      const protocol = locationValue?.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = locationValue?.hostname ?? 'localhost';
      const host = locationValue?.host ?? `${hostname}:${locationValue?.port || ''}`.replace(/:$/, '');
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const targetHost = isLocalhost && (locationValue?.port === '3000' || !locationValue?.port)
        ? `${hostname}:${SCENE_REALTIME_PORT}`
        : host;
      return new URL(`${protocol}//${targetHost}${LOOT_CHEST_REALTIME_PATH}`);
    })();

  url.pathname = LOOT_CHEST_REALTIME_PATH;
  url.search = '';
  if (normalizedToken) {
    url.searchParams.set('overlayToken', normalizedToken);
  }

  return url.toString();
}
