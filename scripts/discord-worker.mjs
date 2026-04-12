#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { loadLocalEnvIntoProcess } from './load-local-env.mjs';
import {
  createDiscordVoicePresenceModule,
  createDiscordWorkerHost,
  formatDiscordWorkerError,
} from './discord-worker-lib.mjs';

const envState = loadLocalEnvIntoProcess();
if (envState.loadedFiles.length > 0) {
  const relativeFiles = envState.loadedFiles.map((filePath) => path.relative(process.cwd(), filePath) || filePath);
  console.log(`[discord-worker] Loaded env files: ${relativeFiles.join(', ')}`);
} else {
  console.log('[discord-worker] No .env*, .env.local, or .env.development* file found. Using current shell environment only.');
}

const discordGuildId = String(process.env.DISCORD_GUILD_ID ?? '').trim();
const discordBotToken = String(process.env.DISCORD_BOT_TOKEN ?? '').trim();
if ((discordGuildId && !discordBotToken) || (!discordGuildId && discordBotToken)) {
  console.warn('[discord-worker] Setup warning: Discord guild sync is partially configured. Set both DISCORD_GUILD_ID and DISCORD_BOT_TOKEN for live role lookups.');
} else if (!discordGuildId && !discordBotToken) {
  console.log('[discord-worker] Setup note: Discord guild sync is disabled locally, so live role metadata will fall back to configured labels only.');
}

const worker = createDiscordWorkerHost({
  modules: [createDiscordVoicePresenceModule()],
});
const idleHold = setInterval(() => {
  // Keeps the process alive in no-config dev/service mode.
}, 60_000);

async function shutdown(signal) {
  clearInterval(idleHold);
  console.log(`[discord-worker] Received ${signal}; shutting down.`);
  await worker.stop();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

worker.start()
  .then((result) => {
    if (!result.configured) {
      console.log('[discord-worker] Worker is idle until DISCORD_GUILD_ID and DISCORD_BOT_TOKEN are configured.');
      return;
    }

    console.log(`[discord-worker] Worker connected for guild ${result.guildId} with modules: ${result.moduleKeys.join(', ') || 'none'}.`);
  })
  .catch((error) => {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const formattedMessage = formatDiscordWorkerError(error);
    if (formattedMessage === rawMessage) {
      console.error('[discord-worker] Failed to start.', error);
    } else {
      console.error(`[discord-worker] Failed to start. ${formattedMessage}`);
    }
    process.exit(1);
  });
