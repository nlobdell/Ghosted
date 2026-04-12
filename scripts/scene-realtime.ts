#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { loadLocalEnvIntoProcess } from './load-local-env.mjs';
import { SCENE_REALTIME_PATH } from '../src/lib/scene-realtime';
import { createSceneRealtimeServer, resolveSceneRealtimePort } from '../src/lib/server/scene-realtime';

const envState = loadLocalEnvIntoProcess();
if (envState.loadedFiles.length > 0) {
  const relativeFiles = envState.loadedFiles.map((filePath) => path.relative(process.cwd(), filePath) || filePath);
  console.log(`[scene-realtime] Loaded env files: ${relativeFiles.join(', ')}`);
} else {
  console.log('[scene-realtime] No .env*, .env.local, or .env.development* file found. Using current shell environment only.');
}

const port = resolveSceneRealtimePort();
const service = createSceneRealtimeServer({ port });

async function shutdown(signal: string) {
  console.log(`[scene-realtime] Received ${signal}; shutting down.`);
  await service.stop();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

service.start()
  .then((result) => {
    console.log(`[scene-realtime] Listening on ws://${result.host}:${result.port}${SCENE_REALTIME_PATH}`);
  })
  .catch((error) => {
    console.error('[scene-realtime] Failed to start.', error);
    process.exit(1);
  });
