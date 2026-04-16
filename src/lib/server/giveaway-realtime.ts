import {
  LOOT_CHEST_REALTIME_INTERNAL_CUE_PATH,
  LOOT_CHEST_REALTIME_INTERNAL_SNAPSHOT_PATH,
} from '@/lib/giveaway-realtime';
import type { LootChestPresentationCue, LootChestSceneSnapshot } from '@/lib/types';
import { resolveSceneRealtimePort } from '@/lib/server/scene-realtime';

const LOCAL_SCENE_REALTIME_ORIGIN = '127.0.0.1';
const REALTIME_POST_TIMEOUT_MS = 400;

function realtimeInternalUrl(pathname: string) {
  return `http://${LOCAL_SCENE_REALTIME_ORIGIN}:${resolveSceneRealtimePort()}${pathname}`;
}

async function postRealtimePayload(pathname: string, payload: object) {
  try {
    const response = await fetch(realtimeInternalUrl(pathname), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REALTIME_POST_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function publishLootChestSceneSnapshot(snapshot: LootChestSceneSnapshot) {
  return postRealtimePayload(LOOT_CHEST_REALTIME_INTERNAL_SNAPSHOT_PATH, snapshot);
}

export async function publishLootChestPresentationCue(cue: LootChestPresentationCue) {
  return postRealtimePayload(LOOT_CHEST_REALTIME_INTERNAL_CUE_PATH, cue);
}
