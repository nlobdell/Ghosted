import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type Database from 'better-sqlite3';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ScenePresencePayload, ScenePresenceSocketMessage } from '@/lib/types';
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

type SceneRealtimeLogger = Pick<Console, 'error' | 'info' | 'warn'>;

type SceneRealtimeServerOptions = {
  path?: string;
  host?: string;
  port?: number;
  tickMs?: number;
  db?: Database.Database;
  buildPayload?: (options?: {
    now?: number;
    db?: Database.Database;
    forceRefresh?: boolean;
  }) => Promise<ScenePresencePayload>;
  logger?: SceneRealtimeLogger;
};

type SceneRealtimeStartResult = {
  host: string;
  path: string;
  port: number;
};

export function resolveSceneRealtimePort() {
  return envInt('SCENE_REALTIME_PORT', SCENE_REALTIME_PORT);
}

function sendSocketMessage(socket: WebSocket, message: ScenePresenceSocketMessage) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

export function createSceneRealtimeServer(options: SceneRealtimeServerOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  const path = options.path ?? SCENE_REALTIME_PATH;
  const port = options.port ?? resolveSceneRealtimePort();
  const tickMs = options.tickMs ?? SCENE_REALTIME_INTERVAL_MS;
  const db = options.db ?? getDatabase();
  const buildPayload = options.buildPayload ?? buildScenePresencePayload;
  const logger = options.logger ?? console;

  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        clients: wss.clients.size,
        path,
      }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found.' }));
  });
  const wss = new WebSocketServer({ noServer: true });

  let started = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let latestMessage: ScenePresenceSocketMessage | null = null;
  let latestMessageAt = 0;
  let publishInFlight: Promise<void> | null = null;

  const broadcast = (message: ScenePresenceSocketMessage) => {
    latestMessage = message;
    latestMessageAt = Date.now();
    for (const client of wss.clients) {
      sendSocketMessage(client, message);
    }
  };

  const publishSnapshot = async (forceRefresh = false) => {
    if (!forceRefresh && wss.clients.size === 0) {
      return;
    }

    const now = Date.now();

    if (publishInFlight) {
      await publishInFlight;
      return;
    }

    publishInFlight = (async () => {
      try {
        const payload = await buildPayload({ now, db, forceRefresh });
        broadcast(buildScenePresenceSocketSnapshotMessage(payload, new Date(now).toISOString()));
      } catch (error) {
        logger.error('[scene-realtime] Failed to publish scene snapshot.', error);
        broadcast(buildScenePresenceSocketErrorMessage(true));
      } finally {
        publishInFlight = null;
      }
    })();

    await publishInFlight;
  };

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== path) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket, incomingRequest) => {
      wss.emit('connection', websocket, incomingRequest);
    });
  });

  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    logger.info(
      `[scene-realtime] Client connected from ${request.socket.remoteAddress ?? 'unknown'} (${wss.clients.size} total).`,
    );

    if (latestMessage && (Date.now() - latestMessageAt) <= (tickMs * 2)) {
      sendSocketMessage(socket, latestMessage);
    } else {
      void publishSnapshot();
    }

    socket.on('close', () => {
      logger.info(`[scene-realtime] Client disconnected (${wss.clients.size} remaining).`);
    });
  });

  return {
    async start(): Promise<SceneRealtimeStartResult> {
      if (started) {
        return { host, path, port };
      }

      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });

      started = true;
      tickTimer = setInterval(() => {
        void publishSnapshot();
      }, tickMs);

      const address = server.address() as AddressInfo | null;

      return { host, path, port: address?.port ?? port };
    },
    async stop() {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }

      await Promise.allSettled(
        Array.from(wss.clients).map((client) => new Promise<void>((resolve) => {
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
      await publishSnapshot(forceRefresh);
    },
    get clientCount() {
      return wss.clients.size;
    },
    get server() {
      return server as HttpServer;
    },
  };
}
