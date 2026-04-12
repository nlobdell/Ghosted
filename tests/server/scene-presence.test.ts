import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';

const { buildRuntimeAuthConfigMock, womGroupIdMock, womRequestJsonMock } = vi.hoisted(() => ({
  buildRuntimeAuthConfigMock: vi.fn(),
  womGroupIdMock: vi.fn(),
  womRequestJsonMock: vi.fn(),
}));

vi.mock('@/lib/server/discord', () => ({
  buildRuntimeAuthConfig: buildRuntimeAuthConfigMock,
}));

vi.mock('@/lib/server/wom', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/wom')>('@/lib/server/wom');
  return {
    ...actual,
    womGroupId: womGroupIdMock,
    womRequestJson: womRequestJsonMock,
  };
});

import {
  buildScenePresencePayload,
  resetScenePresenceStateForTests,
  SCENE_PRESENCE_CACHE_TTL_MS,
} from '@/lib/server/scene-presence';
import type { ScenePresencePayload } from '@/lib/types';

function mockVoiceWidget(members: Array<{
  username: string;
  channel_id: string;
  display_name?: string;
}>) {
  return vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    channels: [{ id: 'voice-1' }],
    members,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('scene presence builder', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
    context = setupServerTestEnvironment();
    buildRuntimeAuthConfigMock.mockReset();
    womGroupIdMock.mockReset();
    womRequestJsonMock.mockReset();
    resetScenePresenceStateForTests();
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reuses the source cache across realtime ticks while still advancing the shared hero snapshot', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    const fetchMock = mockVoiceWidget([{ username: 'member', channel_id: 'voice-1', display_name: 'Member' }]);

    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', fetchMock);

    const firstPayload = await buildScenePresencePayload({ db: context.db });

    vi.setSystemTime(new Date('2026-04-10T12:00:05.000Z'));
    const secondPayload = await buildScenePresencePayload({ db: context.db });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstPayload.members[0]?.key).toBe(`user:${userId}`);
    expect(secondPayload.members[0]?.key).toBe(`user:${userId}`);
    expect(secondPayload.sharedScene?.hero?.savedAt).toBeGreaterThan(firstPayload.sharedScene?.hero?.savedAt ?? 0);

    vi.setSystemTime(new Date(`2026-04-10T12:00:${Math.ceil((SCENE_PRESENCE_CACHE_TTL_MS + 1000) / 1000)
      .toString()
      .padStart(2, '0')}.000Z`));
    await buildScenePresencePayload({ db: context.db });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves the last cached payload immediately while a slow refresh runs in the background', async () => {
    insertUser(context.db, { username: 'member', globalName: 'Member' });
    const initialFetchMock = mockVoiceWidget([{ username: 'member', channel_id: 'voice-1', display_name: 'Member' }]);

    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', initialFetchMock);

    const firstPayload = await buildScenePresencePayload({ db: context.db });

    vi.setSystemTime(new Date(`2026-04-10T12:00:${Math.ceil((SCENE_PRESENCE_CACHE_TTL_MS + 1000) / 1000)
      .toString()
      .padStart(2, '0')}.000Z`));

    let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | undefined;
    const slowFetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', slowFetchMock);

    let secondPayload!: ScenePresencePayload;
    let settled = false;
    const payloadPromise = buildScenePresencePayload({ db: context.db }).then((payload) => {
      secondPayload = payload;
      settled = true;
    });

    await Promise.resolve();

    expect(settled).toBe(true);
    expect(secondPayload.members[0]?.key).toBe(firstPayload.members[0]?.key);
    expect(slowFetchMock).toHaveBeenCalledTimes(1);

    if (resolveFetch) {
      resolveFetch(new Response(JSON.stringify({
        channels: [{ id: 'voice-1' }],
        members: [{ username: 'member', channel_id: 'voice-1', display_name: 'Member' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    await payloadPromise;
    await Promise.resolve();
  });
});
