import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { LootChestRealtimeSocketMessage, LootChestSceneSnapshot } from '@/lib/types';
import { createSceneRealtimeServer } from '@/lib/server/scene-realtime';

function waitForMessage(socket: WebSocket) {
  return new Promise<LootChestRealtimeSocketMessage>((resolve, reject) => {
    const onMessage = (data: Buffer) => {
      cleanup();
      resolve(JSON.parse(data.toString()) as LootChestRealtimeSocketMessage);
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

function makeSnapshot(revision: number): LootChestSceneSnapshot {
  return {
    revision,
    publishedAt: new Date(Date.now() + revision).toISOString(),
    queueCount: 1,
    reward: {
      id: 'reward-1',
      title: 'Loot Chest Spin',
      prompt: 'Redeem for a host-run Ghosted loot chest turn.',
      cost: 1000,
      isPaused: false,
      isEnabled: true,
    },
    focusTurn: null,
  };
}

describe('giveaway realtime server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an immediate giveaway snapshot on connect and keeps broadcasting updates', async () => {
    let revision = 1;
    const server = createSceneRealtimeServer({
      host: '127.0.0.1',
      port: 0,
      giveawayTickMs: 50,
      logger: { info() {}, warn() {}, error() {} },
      buildGiveawaySnapshot: vi.fn(async () => makeSnapshot(revision++)),
      isValidGiveawayToken: vi.fn((token) => token === 'overlay-token'),
    });

    const start = await server.start();
    const socket = new WebSocket(`ws://${start.host}:${start.port}${start.giveawayPath}?overlayToken=overlay-token`);

    const firstMessage = await waitForMessage(socket);
    const secondMessage = await waitForMessage(socket);

    expect(firstMessage.type).toBe('loot-chest:snapshot');
    expect(secondMessage.type).toBe('loot-chest:snapshot');
    if (firstMessage.type === 'loot-chest:snapshot' && secondMessage.type === 'loot-chest:snapshot') {
      expect(secondMessage.payload.revision).toBeGreaterThan(firstMessage.payload.revision);
    }

    socket.close();
    await server.stop();
  });

  it('sends an unavailable error when giveaway snapshot building fails', async () => {
    const server = createSceneRealtimeServer({
      host: '127.0.0.1',
      port: 0,
      giveawayTickMs: 50,
      logger: { info() {}, warn() {}, error() {} },
      buildGiveawaySnapshot: vi.fn(async () => {
        throw new Error('boom');
      }),
      isValidGiveawayToken: vi.fn((token) => token === 'overlay-token'),
    });

    const start = await server.start();
    const socket = new WebSocket(`ws://${start.host}:${start.port}${start.giveawayPath}?overlayToken=overlay-token`);
    const message = await waitForMessage(socket);

    expect(message).toEqual({
      type: 'loot-chest:error',
      code: 'unavailable',
      retryable: true,
    });

    socket.close();
    await server.stop();
  });
});
