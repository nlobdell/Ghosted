import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';
import type { ScenePresencePayload, ScenePresenceSocketMessage } from '@/lib/types';
import { createSceneRealtimeServer } from '@/lib/server/scene-realtime';

function waitForMessage(socket: WebSocket) {
  return new Promise<ScenePresenceSocketMessage>((resolve, reject) => {
    const onMessage = (data: Buffer) => {
      cleanup();
      resolve(JSON.parse(data.toString()) as ScenePresenceSocketMessage);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.on('error', onError);
  });
}

describe('scene realtime server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an immediate snapshot on connect and keeps broadcasting updated snapshots', async () => {
    let tick = 0;
    const server = createSceneRealtimeServer({
      host: '127.0.0.1',
      port: 0,
      tickMs: 50,
      logger: { info() {}, warn() {}, error() {} },
      buildPayload: vi.fn(async () => ({
        members: [],
        source: 'empty' as const,
        sharedScene: {
          hero: {
            version: 1,
            variant: 'hero' as const,
            width: SHARED_COMMONS_WORLD.sourceWidth,
            height: SHARED_COMMONS_WORLD.sourceHeight,
            savedAt: Date.now() + tick++,
            payloadSource: 'empty' as const,
            liveCount: 0,
            entities: [],
          },
        },
      }) satisfies ScenePresencePayload),
    });

    const start = await server.start();
    const socket = new WebSocket(`ws://${start.host}:${start.port}${start.path}`);

    const firstMessage = await waitForMessage(socket);
    const secondMessage = await waitForMessage(socket);

    expect(firstMessage.type).toBe('scene:snapshot');
    expect(secondMessage.type).toBe('scene:snapshot');
    if (firstMessage.type === 'scene:snapshot' && secondMessage.type === 'scene:snapshot') {
      expect(secondMessage.payload.sharedScene?.hero?.savedAt).toBeGreaterThan(
        firstMessage.payload.sharedScene?.hero?.savedAt ?? 0,
      );
    }

    socket.close();
    await server.stop();
  });

  it('delivers the same latest snapshot to multiple connected clients', async () => {
    const latestPayload = {
      members: [],
      source: 'empty' as const,
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero' as const,
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'empty' as const,
          liveCount: 0,
          entities: [],
        },
      },
    } satisfies ScenePresencePayload;
    const server = createSceneRealtimeServer({
      host: '127.0.0.1',
      port: 0,
      tickMs: 250,
      logger: { info() {}, warn() {}, error() {} },
      buildPayload: vi.fn(async () => latestPayload),
    });

    const start = await server.start();
    const firstSocket = new WebSocket(`ws://${start.host}:${start.port}${start.path}`);
    const secondSocket = new WebSocket(`ws://${start.host}:${start.port}${start.path}`);

    const [firstMessage, secondMessage] = await Promise.all([
      waitForMessage(firstSocket),
      waitForMessage(secondSocket),
    ]);

    expect(firstMessage).toEqual(secondMessage);

    firstSocket.close();
    secondSocket.close();
    await server.stop();
  });

  it('sends an unavailable error when snapshot building fails', async () => {
    const server = createSceneRealtimeServer({
      host: '127.0.0.1',
      port: 0,
      tickMs: 250,
      logger: { info() {}, warn() {}, error() {} },
      buildPayload: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const start = await server.start();
    const socket = new WebSocket(`ws://${start.host}:${start.port}${start.path}`);
    const message = await waitForMessage(socket);

    expect(message).toEqual({
      type: 'scene:error',
      code: 'unavailable',
      retryable: true,
    });

    socket.close();
    await server.stop();
  });
});
