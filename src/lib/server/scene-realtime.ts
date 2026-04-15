import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import type Database from 'better-sqlite3';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  buildLootChestSocketErrorMessage,
  buildLootChestSocketSnapshotMessage,
  LOOT_CHEST_REALTIME_INTERVAL_MS,
  LOOT_CHEST_REALTIME_PATH,
} from '@/lib/giveaway-realtime';
import type {
  LootChestRealtimeSocketMessage,
  LootChestSceneSnapshot,
  ScenePresencePayload,
  ScenePresenceSocketMessage,
} from '@/lib/types';
import {
  buildScenePresenceSocketErrorMessage,
  buildScenePresenceSocketSnapshotMessage,
  SCENE_REALTIME_INTERVAL_MS,
  SCENE_REALTIME_PATH,
  SCENE_REALTIME_PORT,
} from '@/lib/scene-realtime';
import { envInt } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { buildScenePresencePayload } from '@/lib/server/scene-presence';

const localRequire = createRequire(import.meta.url);

type SceneRealtimeLogger = Pick<Console, 'error' | 'info' | 'warn'>;

type SceneRealtimeServerOptions = {
  path?: string;
  giveawayPath?: string;
  host?: string;
  port?: number;
  tickMs?: number;
  giveawayTickMs?: number;
  db?: Database.Database;
  buildPayload?: (options?: {
    now?: number;
    db?: Database.Database;
    forceRefresh?: boolean;
  }) => Promise<ScenePresencePayload>;
  buildGiveawaySnapshot?: (options?: {
    now?: number;
    db?: Database.Database;
    forceRefresh?: boolean;
  }) => Promise<LootChestSceneSnapshot>;
  isValidGiveawayToken?: (token: string, db?: Database.Database) => boolean;
  logger?: SceneRealtimeLogger;
};

type SceneRealtimeStartResult = {
  host: string;
  path: string;
  giveawayPath: string;
  port: number;
};

export function resolveSceneRealtimePort() {
  return envInt('SCENE_REALTIME_PORT', SCENE_REALTIME_PORT);
}

function sendSocketMessage<T extends ScenePresenceSocketMessage | LootChestRealtimeSocketMessage>(
  socket: WebSocket,
  message: T,
) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

export function createSceneRealtimeServer(options: SceneRealtimeServerOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  const path = options.path ?? SCENE_REALTIME_PATH;
  const giveawayPath = options.giveawayPath ?? LOOT_CHEST_REALTIME_PATH;
  const port = options.port ?? resolveSceneRealtimePort();
  const tickMs = options.tickMs ?? SCENE_REALTIME_INTERVAL_MS;
  const giveawayTickMs = options.giveawayTickMs ?? LOOT_CHEST_REALTIME_INTERVAL_MS;
  const db = options.db ?? getDatabase();
  const buildPayload = options.buildPayload ?? buildScenePresencePayload;
  const buildGiveawaySnapshot = options.buildGiveawaySnapshot
    ?? (async (input?: { db?: Database.Database }) => {
      const { buildLootChestSceneSnapshot } = localRequire('./twitch-loot-chest');
      return buildLootChestSceneSnapshot(input?.db ?? db);
    });
  const validateGiveawayToken = options.isValidGiveawayToken
    ?? ((token: string, currentDb?: Database.Database) => {
      const { isValidLootChestOverlayToken } = localRequire('./twitch-loot-chest');
      return isValidLootChestOverlayToken(token, currentDb ?? db);
    });
  const logger = options.logger ?? console;

  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        sceneClients: sceneWss.clients.size,
        giveawayClients: giveawayWss.clients.size,
        path,
        giveawayPath,
      }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found.' }));
  });
  const sceneWss = new WebSocketServer({ noServer: true });
  const giveawayWss = new WebSocketServer({ noServer: true });

  let started = false;
  let sceneTickTimer: ReturnType<typeof setInterval> | null = null;
  let giveawayTickTimer: ReturnType<typeof setInterval> | null = null;
  let latestSceneMessage: ScenePresenceSocketMessage | null = null;
  let latestSceneMessageAt = 0;
  let latestGiveawayMessage: LootChestRealtimeSocketMessage | null = null;
  let latestGiveawayMessageAt = 0;
  let scenePublishInFlight: Promise<void> | null = null;
  let giveawayPublishInFlight: Promise<void> | null = null;

  const broadcastScene = (message: ScenePresenceSocketMessage) => {
    latestSceneMessage = message;
    latestSceneMessageAt = Date.now();
    for (const client of sceneWss.clients) {
      sendSocketMessage(client, message);
    }
  };

  const broadcastGiveaway = (message: LootChestRealtimeSocketMessage) => {
    latestGiveawayMessage = message;
    latestGiveawayMessageAt = Date.now();
    for (const client of giveawayWss.clients) {
      sendSocketMessage(client, message);
    }
  };

  const publishSceneSnapshot = async (forceRefresh = false) => {
    if (!forceRefresh && sceneWss.clients.size === 0) {
      return;
    }

    const now = Date.now();
    if (scenePublishInFlight) {
      await scenePublishInFlight;
      return;
    }

    scenePublishInFlight = (async () => {
      try {
        const payload = await buildPayload({ now, db, forceRefresh });
        broadcastScene(buildScenePresenceSocketSnapshotMessage(payload, new Date(now).toISOString()));
      } catch (error) {
        logger.error('[scene-realtime] Failed to publish scene snapshot.', error);
        broadcastScene(buildScenePresenceSocketErrorMessage(true));
      } finally {
        scenePublishInFlight = null;
      }
    })();

    await scenePublishInFlight;
  };

  const publishGiveawaySnapshot = async (forceRefresh = false) => {
    if (!forceRefresh && giveawayWss.clients.size === 0) {
      return;
    }

    const now = Date.now();
    if (giveawayPublishInFlight) {
      await giveawayPublishInFlight;
      return;
    }

    giveawayPublishInFlight = (async () => {
      try {
        const payload = await buildGiveawaySnapshot({ now, db, forceRefresh });
        broadcastGiveaway(buildLootChestSocketSnapshotMessage(payload, new Date(now).toISOString()));
      } catch (error) {
        logger.error('[scene-realtime] Failed to publish giveaway snapshot.', error);
        broadcastGiveaway(buildLootChestSocketErrorMessage(true));
      } finally {
        giveawayPublishInFlight = null;
      }
    })();

    await giveawayPublishInFlight;
  };

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname === path) {
      sceneWss.handleUpgrade(request, socket, head, (websocket, incomingRequest) => {
        sceneWss.emit('connection', websocket, incomingRequest);
      });
      return;
    }

    if (url.pathname === giveawayPath) {
      const overlayToken = String(url.searchParams.get('overlayToken') ?? '').trim();
      if (!validateGiveawayToken(overlayToken, db)) {
        socket.destroy();
        return;
      }

      giveawayWss.handleUpgrade(request, socket, head, (websocket, incomingRequest) => {
        giveawayWss.emit('connection', websocket, incomingRequest);
      });
      return;
    }

    socket.destroy();
  });

  sceneWss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    logger.info(
      `[scene-realtime] Scene client connected from ${request.socket.remoteAddress ?? 'unknown'} (${sceneWss.clients.size} total).`,
    );

    if (latestSceneMessage && (Date.now() - latestSceneMessageAt) <= (tickMs * 2)) {
      sendSocketMessage(socket, latestSceneMessage);
    } else {
      void publishSceneSnapshot();
    }

    socket.on('close', () => {
      logger.info(`[scene-realtime] Scene client disconnected (${sceneWss.clients.size} remaining).`);
    });
  });

  giveawayWss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    logger.info(
      `[scene-realtime] Giveaway client connected from ${request.socket.remoteAddress ?? 'unknown'} (${giveawayWss.clients.size} total).`,
    );

    if (latestGiveawayMessage && (Date.now() - latestGiveawayMessageAt) <= (giveawayTickMs * 2)) {
      sendSocketMessage(socket, latestGiveawayMessage);
    } else {
      void publishGiveawaySnapshot();
    }

    socket.on('close', () => {
      logger.info(`[scene-realtime] Giveaway client disconnected (${giveawayWss.clients.size} remaining).`);
    });
  });

  return {
    async start(): Promise<SceneRealtimeStartResult> {
      if (started) {
        return { host, path, giveawayPath, port };
      }

      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });

      started = true;
      sceneTickTimer = setInterval(() => {
        void publishSceneSnapshot();
      }, tickMs);
      giveawayTickTimer = setInterval(() => {
        void publishGiveawaySnapshot();
      }, giveawayTickMs);

      const address = server.address() as AddressInfo | null;
      return { host, path, giveawayPath, port: address?.port ?? port };
    },
    async stop() {
      if (sceneTickTimer) {
        clearInterval(sceneTickTimer);
        sceneTickTimer = null;
      }
      if (giveawayTickTimer) {
        clearInterval(giveawayTickTimer);
        giveawayTickTimer = null;
      }

      await Promise.allSettled(
        [...sceneWss.clients, ...giveawayWss.clients].map((client) => new Promise<void>((resolve) => {
          client.once('close', () => resolve());
          client.close();
        })),
      );

      if (!started) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      started = false;
    },
    async publishSnapshot(forceRefresh = false) {
      await publishSceneSnapshot(forceRefresh);
    },
    async publishGiveawaySnapshot(forceRefresh = false) {
      await publishGiveawaySnapshot(forceRefresh);
    },
    get clientCount() {
      return sceneWss.clients.size;
    },
    get giveawayClientCount() {
      return giveawayWss.clients.size;
    },
    get server() {
      return server as HttpServer;
    },
  };
}
