import type { ScenePresencePayload, ScenePresenceSocketMessage } from '@/lib/types';

export const SCENE_REALTIME_PATH = '/ws/scene/presence';
export const SCENE_REALTIME_INTERVAL_MS = 250;
export const SCENE_REALTIME_PORT = 3_001;

export function buildScenePresenceSocketSnapshotMessage(
  payload: ScenePresencePayload,
  sentAt = new Date().toISOString(),
): ScenePresenceSocketMessage {
  return {
    type: 'scene:snapshot',
    payload,
    sentAt,
  };
}

export function buildScenePresenceSocketErrorMessage(
  retryable = true,
): ScenePresenceSocketMessage {
  return {
    type: 'scene:error',
    code: 'unavailable',
    retryable,
  };
}

export function resolveSceneRealtimeClientUrl(locationValue?: Pick<Location, 'protocol' | 'hostname' | 'port' | 'host'>) {
  const configured = String(process.env.NEXT_PUBLIC_SCENE_REALTIME_URL ?? '').trim();
  if (configured) return configured;

  const protocol = locationValue?.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = locationValue?.hostname ?? 'localhost';
  const host = locationValue?.host ?? `${hostname}:${locationValue?.port || ''}`.replace(/:$/, '');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost && (locationValue?.port === '3000' || !locationValue?.port)) {
    return `${protocol}//${hostname}:${SCENE_REALTIME_PORT}${SCENE_REALTIME_PATH}`;
  }

  return `${protocol}//${host}${SCENE_REALTIME_PATH}`;
}
