import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GatewayIntentBits } from 'discord.js';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, setupServerTestEnvironment } from './test-utils';
import { getDiscordPresenceWorkerSummary, listDiscordVoicePresence } from '@/lib/server/discord-presence';
import {
  createDiscordVoicePresenceModule,
  createDiscordWorkerHost,
  formatDiscordWorkerError,
} from '../../scripts/discord-worker-lib.mjs';

type Handler = (...args: unknown[]) => unknown | Promise<unknown>;
type FakeGuildMember = {
  id: string;
  guild: { id: string };
  displayName: string;
  user: {
    id?: string;
    username: string;
    bot: boolean;
  };
};
type FakeVoiceState = {
  id: string;
  channelId: string | null;
  guild: { id: string };
  member: FakeGuildMember;
};
type FakeGuild = {
  id: string;
  voiceStates: {
    cache: Map<string, FakeVoiceState>;
  };
  members: {
    fetch(memberId: string): Promise<FakeGuildMember | null>;
  };
};

class FakeDiscordClient {
  intents: number[];
  user = { tag: 'Ghosted Bot#0001' };
  loginToken: string | null = null;
  destroyed = false;
  loginError: Error | null = null;
  guilds = {
    cache: new Map<string, FakeGuild>(),
    fetch: async (guildId: string) => this.guilds.cache.get(guildId) ?? null,
  };

  #listeners = new Map<string, Handler[]>();
  #onceListeners = new Map<string, Handler[]>();

  constructor(intents: number[]) {
    this.intents = intents;
  }

  once(event: string, handler: Handler) {
    const listeners = this.#onceListeners.get(event) ?? [];
    listeners.push(handler);
    this.#onceListeners.set(event, listeners);
    return this;
  }

  on(event: string, handler: Handler) {
    const listeners = this.#listeners.get(event) ?? [];
    listeners.push(handler);
    this.#listeners.set(event, listeners);
    return this;
  }

  async emit(event: string, ...args: unknown[]) {
    const listeners = this.#listeners.get(event) ?? [];
    const onceListeners = this.#onceListeners.get(event) ?? [];
    this.#onceListeners.delete(event);

    for (const handler of [...listeners, ...onceListeners]) {
      await handler(...args);
    }
  }

  async login(token: string) {
    this.loginToken = token;
    if (this.loginError) {
      await this.emit('shardError', this.loginError);
      throw this.loginError;
    }
    await this.emit('clientReady');
    return token;
  }

  async destroy() {
    this.destroyed = true;
  }
}

function createVoiceState(
  guildId: string,
  channelId: string | null,
  overrides: Partial<{
    id: string;
    username: string;
    displayName: string;
    bot: boolean;
  }> = {},
): FakeVoiceState {
  const id = overrides.id ?? 'discord-1';
  const username = overrides.username ?? 'smirk';

  return {
    id,
    channelId,
    guild: { id: guildId },
    member: {
      id,
      guild: { id: guildId },
      displayName: overrides.displayName ?? 'Smirk',
      user: {
        id,
        username,
        bot: overrides.bot ?? false,
      },
    },
  };
}

function createFakeGuild(guildId: string, voiceStates: FakeVoiceState[]): FakeGuild {
  const stateMap = new Map<string, FakeVoiceState>(
    voiceStates.map((state) => [
      state.id,
      {
        ...state,
        guild: { id: guildId },
        member: {
          ...state.member,
          guild: { id: guildId },
        },
      },
    ]),
  );

  return {
    id: guildId,
    voiceStates: {
      cache: stateMap,
    },
    members: {
      fetch: async (memberId: string) => stateMap.get(memberId)?.member ?? null,
    },
  };
}

describe('discord worker host', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({
      DISCORD_GUILD_ID: 'guild-1',
      DISCORD_BOT_TOKEN: 'bot-token',
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
  });

  it('runs registered modules through the shared worker lifecycle', async () => {
    const events: string[] = [];
    const createdClients: FakeDiscordClient[] = [];
    let heartbeatStarted = false;
    let heartbeatStopped = false;

    const host = createDiscordWorkerHost({
      db: context.db,
      env: process.env,
      logger: {
        info() {},
        warn() {},
        error() {},
      },
      createClient(intents: number[]) {
        const client = new FakeDiscordClient(intents);
        createdClients.push(client);
        return client;
      },
      setHeartbeatInterval() {
        heartbeatStarted = true;
        return { heartbeat: true };
      },
      clearHeartbeatInterval() {
        heartbeatStopped = true;
      },
      modules: [
        {
          key: 'mock',
          intents: [GatewayIntentBits.GuildMembers],
          onStart() {
            events.push('start');
          },
          onReady() {
            events.push('ready');
          },
          onGuildCreate(_context: unknown, guild: { id: string }) {
            events.push(`guild:${guild.id}`);
          },
          onStop() {
            events.push('stop');
          },
        },
      ],
    });

    const result = await host.start();
    expect(result).toEqual({
      configured: true,
      guildId: 'guild-1',
      moduleKeys: ['mock'],
    });

    expect(host.moduleKeys).toEqual(['mock']);
    expect(createdClients).toHaveLength(1);
    expect(createdClients[0]?.intents).toContain(GatewayIntentBits.Guilds);
    expect(createdClients[0]?.intents).toContain(GatewayIntentBits.GuildMembers);
    expect(createdClients[0]?.loginToken).toBe('bot-token');
    expect(events).toEqual(['start', 'ready']);
    expect(heartbeatStarted).toBe(true);

    await createdClients[0]?.emit('guildCreate', { id: 'guild-1' });
    expect(events).toContain('guild:guild-1');

    await host.stop();
    expect(events.at(-1)).toBe('stop');
    expect(createdClients[0]?.destroyed).toBe(true);
    expect(heartbeatStopped).toBe(true);
  });

  it('runs the voicePresence module through the worker host and keeps presence rows in sync', async () => {
    const client = new FakeDiscordClient([]);
    client.guilds.cache.set('guild-1', createFakeGuild('guild-1', [
      createVoiceState('guild-1', 'voice-1', {
        id: 'discord-1',
        username: 'smirk',
        displayName: 'Smirk',
      }),
    ]));

    const host = createDiscordWorkerHost({
      db: context.db,
      env: process.env,
      logger: {
        info() {},
        warn() {},
        error() {},
      },
      createClient(intents: number[]) {
        client.intents = intents;
        return client;
      },
      setHeartbeatInterval() {
        return { heartbeat: true };
      },
      clearHeartbeatInterval() {},
      modules: [createDiscordVoicePresenceModule()],
    });

    const result = await host.start();
    expect(result.moduleKeys).toEqual(['voicePresence']);
    expect(client.intents).toContain(GatewayIntentBits.Guilds);
    expect(client.intents).toContain(GatewayIntentBits.GuildVoiceStates);
    expect(client.intents).toContain(GatewayIntentBits.GuildMembers);

    let rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Smirk',
      username: 'smirk',
    });

    let summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.health).toBe('healthy');
    expect(summary.state?.botInstallStatus).toBe('installed');

    await client.emit(
      'voiceStateUpdate',
      createVoiceState('guild-1', 'voice-1', {
        id: 'discord-1',
        username: 'smirk',
        displayName: 'Smirk',
      }),
      createVoiceState('guild-1', 'voice-2', {
        id: 'discord-1',
        username: 'smirk',
        displayName: 'Smirk Active',
      }),
    );

    rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows[0]).toMatchObject({
      discordId: 'discord-1',
      channelId: 'voice-2',
      displayName: 'Smirk Active',
    });

    await client.emit(
      'guildMemberUpdate',
      null,
      {
        id: 'discord-1',
        guild: { id: 'guild-1' },
        displayName: 'Captain Smirk',
        user: {
          username: 'smirk',
          bot: false,
        },
      },
    );

    rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows[0]?.displayName).toBe('Captain Smirk');

    await client.emit(
      'voiceStateUpdate',
      createVoiceState('guild-1', 'voice-2', {
        id: 'discord-1',
        username: 'smirk',
        displayName: 'Captain Smirk',
      }),
      createVoiceState('guild-1', null, {
        id: 'discord-1',
        username: 'smirk',
        displayName: 'Captain Smirk',
      }),
    );

    expect(listDiscordVoicePresence(context.db, 'guild-1')).toHaveLength(0);

    summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.state?.runtimeStatus).toBe('running');

    await host.stop();
    summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.state?.runtimeStatus).toBe('idle');
    expect(client.destroyed).toBe(true);
  });

  it('adds a clear setup hint when Discord rejects privileged intents', async () => {
    const client = new FakeDiscordClient([]);
    client.loginError = Object.assign(new Error('Used disallowed intents'), {
      code: 4014,
    });

    const errorLogs: string[] = [];
    const host = createDiscordWorkerHost({
      db: context.db,
      env: process.env,
      logger: {
        info() {},
        warn() {},
        error(...args: unknown[]) {
          errorLogs.push(args.map((value) => String(value)).join(' '));
        },
      },
      createClient(intents: number[]) {
        client.intents = intents;
        return client;
      },
      setHeartbeatInterval() {
        return { heartbeat: true };
      },
      clearHeartbeatInterval() {},
      modules: [createDiscordVoicePresenceModule()],
    });

    await expect(host.start()).rejects.toThrow('Used disallowed intents');
    expect(formatDiscordWorkerError(client.loginError)).toContain('Enable Server Members Intent');
    expect(errorLogs.some((message) => message.includes('Enable Server Members Intent'))).toBe(true);

    const summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.state?.lastError).toContain('Enable Server Members Intent');

    await host.stop();
  });
});
