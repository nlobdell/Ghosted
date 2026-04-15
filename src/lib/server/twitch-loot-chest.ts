import 'server-only';

import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  LootChestBoard,
  LootChestGameState,
  LootChestOverlayState,
  LootChestTurn,
  LootChestTurnResult,
  LootChestTurnStatus,
  TwitchModuleHealth,
  TwitchRewardConnectionState,
} from '@/lib/types';
import { AppError, jsonLoad, utcIso } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { displayName } from '@/lib/server/ghosted-api';
import {
  beginTwitchPlatformConnect,
  completeTwitchPlatformConnect,
  getTwitchPlatformConfig,
  getTwitchPlatformFeatureBaseUrl,
  isTwitchPlatformOperator,
  requireTwitchPlatformOperator,
  twitchPlatformGateway,
  twitchPlatformLoginHref,
  twitchPlatformStore,
  type TwitchModuleContext,
  type TwitchModuleHandler,
} from '@/lib/server/twitch-platform';

const SETTINGS_KEY = 'default';
const CHEST_COUNT = 10;
const CHEST_SELECTION_LIMIT = 3;
const DEFAULT_REWARD_TITLE = 'Loot Chest Spin';
const DEFAULT_REWARD_PROMPT = 'Redeem for a host-run Ghosted loot chest turn.';
const DEFAULT_REWARD_COST = 1000;
const GIVEAWAY_REDEMPTION_SUBSCRIPTION = 'channel.channel_points_custom_reward_redemption.add';
const GIVEAWAY_REDEMPTION_SUBSCRIPTION_VERSION = '1';

type TwitchRewardRecord = {
  id: string;
  title: string;
  prompt: string;
  cost: number;
  is_enabled: boolean;
  is_paused: boolean;
};

type LootChestSettingsRow = {
  singleton_key: string;
  broadcaster_user_id: string | null;
  reward_id: string | null;
  reward_title: string;
  reward_prompt: string;
  reward_cost: number;
  reward_is_paused: number;
  reward_is_enabled: number;
  overlay_token: string;
  created_at: string;
  updated_at: string;
};

type LootChestTurnRow = {
  id: number;
  redemption_id: string;
  reward_id: string;
  viewer_twitch_id: string;
  viewer_login: string;
  viewer_display_name: string;
  user_input: string | null;
  status: LootChestTurnStatus;
  result: LootChestTurnResult | null;
  prize_chest_index: number | null;
  selected_chests_json: string;
  revealed_chests_json: string;
  fulfillment_status: string;
  redeemed_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TwitchRewardRedemptionEvent = {
  id?: string;
  user_id?: string;
  user_login?: string;
  user_name?: string;
  user_input?: string;
  redeemed_at?: string;
  reward?: {
    id?: string;
  };
};

function getDb() {
  return getDatabase();
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

function ensureSettingsRow(db: Database) {
  const now = utcIso();
  db.prepare(`
    INSERT OR IGNORE INTO twitch_loot_chest_settings (
      singleton_key,
      reward_title,
      reward_prompt,
      reward_cost,
      reward_is_paused,
      reward_is_enabled,
      overlay_token,
      token_scope_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 0, 0, ?, '[]', ?, ?)
  `).run(
    SETTINGS_KEY,
    DEFAULT_REWARD_TITLE,
    DEFAULT_REWARD_PROMPT,
    DEFAULT_REWARD_COST,
    randomToken(24),
    now,
    now,
  );
}

function getSettingsRow(db = getDb()) {
  ensureSettingsRow(db);
  return db.prepare(`
    SELECT singleton_key, broadcaster_user_id, reward_id, reward_title, reward_prompt, reward_cost, reward_is_paused, reward_is_enabled, overlay_token, created_at, updated_at
    FROM twitch_loot_chest_settings
    WHERE singleton_key = ?
    LIMIT 1
  `).get(SETTINGS_KEY) as LootChestSettingsRow;
}

function updateSettings(
  db: Database,
  updates: Partial<Record<Exclude<keyof LootChestSettingsRow, 'singleton_key' | 'created_at'>, unknown>>,
) {
  ensureSettingsRow(db);
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!entries.length) return getSettingsRow(db);

  const assignments = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  assignments.push('updated_at = ?');
  values.push(utcIso());
  values.push(SETTINGS_KEY);

  db.prepare(`
    UPDATE twitch_loot_chest_settings
    SET ${assignments.join(', ')}
    WHERE singleton_key = ?
  `).run(...values);

  return getSettingsRow(db);
}

function listTurnRows(db = getDb()) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    ORDER BY created_at DESC, id DESC
  `).all() as LootChestTurnRow[];
}

function activeTurnRow(db = getDb()) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE status = 'active'
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  `).get() as LootChestTurnRow | undefined;
}

function queuedTurnRows(db = getDb()) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE status = 'queued'
    ORDER BY redeemed_at ASC, id ASC
  `).all() as LootChestTurnRow[];
}

function recentCompletedTurns(db = getDb(), limit = 8) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE status = 'completed'
    ORDER BY completed_at DESC, id DESC
    LIMIT ?
  `).all(limit) as LootChestTurnRow[];
}

function parseChestIndexes(value: string | null | undefined) {
  const parsed = jsonLoad<number[]>(value, []);
  return parsed
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < CHEST_COUNT);
}

function normalizeChestIndexes(input: unknown) {
  if (!Array.isArray(input)) return [] as number[];
  const unique = new Set<number>();
  for (const entry of input) {
    const index = Number(entry);
    if (!Number.isInteger(index) || index < 0 || index >= CHEST_COUNT) continue;
    unique.add(index);
  }
  return [...unique];
}

function chestRevealState(index: number, selected: number[], revealed: number[], prizeIndex: number | null) {
  const isSelected = selected.includes(index);
  const isRevealed = revealed.includes(index);
  if (!isRevealed) return isSelected ? 'selected' : 'closed';
  return prizeIndex === index ? 'prize' : 'empty';
}

function buildTurnBoard(row: LootChestTurnRow | null | undefined): LootChestBoard | null {
  if (!row) return null;
  const selectedChests = parseChestIndexes(row.selected_chests_json);
  const revealedChests = parseChestIndexes(row.revealed_chests_json);
  const prizeIndex = Number.isInteger(row.prize_chest_index) ? Number(row.prize_chest_index) : null;
  const prizeFound = prizeIndex !== null && revealedChests.includes(prizeIndex);

  return {
    totalChests: CHEST_COUNT,
    selectionLimit: CHEST_SELECTION_LIMIT,
    prizeChestIndex: row.status === 'completed' ? prizeIndex : null,
    selectedChests,
    revealedChests,
    remainingSelections: Math.max(0, CHEST_SELECTION_LIMIT - selectedChests.length),
    remainingReveals: Math.max(0, selectedChests.length - revealedChests.length),
    prizeFound,
    allSelectionsLocked: selectedChests.length === CHEST_SELECTION_LIMIT,
    chests: Array.from({ length: CHEST_COUNT }, (_, index) => {
      const revealState = chestRevealState(index, selectedChests, revealedChests, prizeIndex);
      return {
        index,
        label: String(index + 1),
        selected: selectedChests.includes(index),
        revealed: revealedChests.includes(index),
        containsPrize: revealState === 'prize',
        revealState,
      };
    }),
  };
}

function turnResult(row: LootChestTurnRow) {
  if (row.result === 'win' || row.result === 'miss') return row.result;
  const board = buildTurnBoard(row);
  if (!board) return 'pending' as const;
  if (board.prizeFound) return 'win' as const;
  if (board.revealedChests.length >= CHEST_SELECTION_LIMIT) return 'miss' as const;
  return 'pending' as const;
}

function mapTurnRow(row: LootChestTurnRow): LootChestTurn {
  return {
    id: row.id,
    redemptionId: row.redemption_id,
    rewardId: row.reward_id,
    status: row.status,
    result: turnResult(row),
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    userInput: row.user_input,
    viewer: {
      twitchId: row.viewer_twitch_id,
      login: row.viewer_login,
      displayName: row.viewer_display_name,
    },
    board: buildTurnBoard(row),
  };
}

function findGiveawaySubscription(db: Database, broadcasterUserId?: string | null, rewardId?: string | null) {
  return twitchPlatformStore.listSubscriptions(db).find((subscription) => {
    if (subscription.module_key !== 'giveaways') return false;
    if (subscription.subscription_type !== GIVEAWAY_REDEMPTION_SUBSCRIPTION) return false;
    if (broadcasterUserId && subscription.broadcaster_user_id !== broadcasterUserId) return false;
    const condition = jsonLoad<Record<string, string | null>>(subscription.condition_json, {});
    if (rewardId && String(condition.reward_id ?? '') !== rewardId) return false;
    return true;
  });
}

function connectionStateFromRows(db: Database): TwitchRewardConnectionState {
  const config = getTwitchPlatformConfig();
  const settings = getSettingsRow(db);
  const connection = twitchPlatformStore.getActiveBroadcaster(db);
  const subscription = findGiveawaySubscription(db, connection?.broadcaster_user_id ?? settings.broadcaster_user_id, settings.reward_id);

  return {
    configured: config.oauthReady && config.eventSubReady,
    oauthReady: config.oauthReady,
    connected: Boolean(connection?.access_token),
    requiresReconnect: Boolean(connection && !connection.access_token),
    broadcaster: connection
      ? {
        id: connection.broadcaster_user_id,
        login: connection.broadcaster_login,
        displayName: connection.broadcaster_display_name,
      }
      : null,
    reward: {
      id: settings.reward_id,
      title: settings.reward_title || DEFAULT_REWARD_TITLE,
      prompt: settings.reward_prompt || DEFAULT_REWARD_PROMPT,
      cost: Number(settings.reward_cost ?? DEFAULT_REWARD_COST),
      isPaused: Boolean(settings.reward_is_paused),
      isEnabled: Boolean(settings.reward_is_enabled),
    },
    eventSub: {
      callbackUrl: subscription?.callback_url ?? config.callbackUrl ?? null,
      subscriptionId: subscription?.id ?? null,
      status: subscription?.status ?? null,
      lastVerifiedAt: subscription?.last_verified_at ?? null,
    },
    scopes: connection ? jsonLoad<string[]>(connection.token_scope_json, []) : [],
    overlayUrl: getTwitchPlatformFeatureBaseUrl()
      ? `${getTwitchPlatformFeatureBaseUrl()}/v/giveaways/overlay/${settings.overlay_token}`
      : null,
  };
}

async function syncManagedReward(db: Database, input?: Partial<{ title: string; prompt: string; cost: number }>) {
  const activeConnection = await twitchPlatformGateway.ensureFreshBroadcaster(db);
  const settings = getSettingsRow(db);
  const desiredTitle = String(input?.title ?? settings.reward_title ?? DEFAULT_REWARD_TITLE).trim() || DEFAULT_REWARD_TITLE;
  const desiredPrompt = String(input?.prompt ?? settings.reward_prompt ?? DEFAULT_REWARD_PROMPT).trim() || DEFAULT_REWARD_PROMPT;
  const desiredCost = Math.max(1, Number(input?.cost ?? settings.reward_cost ?? DEFAULT_REWARD_COST));

  const rewards = await twitchPlatformGateway.userApiRequest<{ data?: TwitchRewardRecord[] }>(db, {
    path: '/channel_points/custom_rewards',
    query: {
      broadcaster_id: activeConnection.broadcaster_user_id,
      only_manageable_rewards: true,
    },
  });

  let reward = (rewards?.data ?? []).find((entry) => entry.id === settings.reward_id)
    ?? (rewards?.data ?? []).find((entry) => entry.title === desiredTitle);

  if (!reward) {
    const created = await twitchPlatformGateway.userApiRequest<{ data?: TwitchRewardRecord[] }>(db, {
      path: '/channel_points/custom_rewards',
      method: 'POST',
      query: { broadcaster_id: activeConnection.broadcaster_user_id },
      body: {
        title: desiredTitle,
        prompt: desiredPrompt,
        cost: desiredCost,
        is_user_input_required: false,
        should_redemptions_skip_request_queue: false,
      },
    });
    reward = created.data?.[0];
  } else if (
    reward.title !== desiredTitle
    || reward.prompt !== desiredPrompt
    || Number(reward.cost) !== desiredCost
  ) {
    const updated = await twitchPlatformGateway.userApiRequest<{ data?: TwitchRewardRecord[] }>(db, {
      path: '/channel_points/custom_rewards',
      method: 'PATCH',
      query: {
        broadcaster_id: activeConnection.broadcaster_user_id,
        id: reward.id,
      },
      body: {
        title: desiredTitle,
        prompt: desiredPrompt,
        cost: desiredCost,
        is_enabled: true,
      },
    });
    reward = updated.data?.[0] ?? reward;
  }

  if (!reward?.id) {
    throw new AppError('The Twitch reward could not be created or loaded.', 502);
  }

  return updateSettings(db, {
    broadcaster_user_id: activeConnection.broadcaster_user_id,
    reward_id: reward.id,
    reward_title: reward.title,
    reward_prompt: reward.prompt,
    reward_cost: Number(reward.cost),
    reward_is_paused: reward.is_paused ? 1 : 0,
    reward_is_enabled: reward.is_enabled ? 1 : 0,
  });
}

async function setRewardPaused(db: Database, paused: boolean) {
  const settings = getSettingsRow(db);
  const activeConnection = await twitchPlatformGateway.ensureFreshBroadcaster(db);
  if (!settings.reward_id) {
    throw new AppError('Create the Twitch reward first.', 400);
  }

  const updated = await twitchPlatformGateway.userApiRequest<{ data?: TwitchRewardRecord[] }>(db, {
    path: '/channel_points/custom_rewards',
    method: 'PATCH',
    query: {
      broadcaster_id: activeConnection.broadcaster_user_id,
      id: settings.reward_id,
    },
    body: {
      is_paused: paused,
    },
  });

  const reward = updated.data?.[0];
  return updateSettings(db, {
    broadcaster_user_id: activeConnection.broadcaster_user_id,
    reward_is_paused: reward?.is_paused ? 1 : paused ? 1 : 0,
    reward_is_enabled: reward?.is_enabled ? 1 : 0,
  });
}

async function syncGiveawaySubscription(context: TwitchModuleContext, settings = getSettingsRow(context.db)) {
  if (!settings.reward_id) {
    throw new AppError('Create the Twitch reward first.', 400);
  }

  const response = await context.gateway.eventSubApiRequest<{ data?: Array<{
    id: string;
    status: string;
    type: string;
    version: string;
    condition?: {
      broadcaster_user_id?: string;
      reward_id?: string;
    };
    transport?: {
      method?: string;
      callback?: string;
    };
  }> }>({
    path: '/eventsub/subscriptions',
    query: {
      type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
    },
  });

  const existing = (response.data ?? []).find((subscription) => (
    subscription.type === GIVEAWAY_REDEMPTION_SUBSCRIPTION
    && String(subscription.condition?.broadcaster_user_id ?? '') === context.connection.broadcaster_user_id
    && String(subscription.condition?.reward_id ?? '') === settings.reward_id
    && String(subscription.transport?.callback ?? '') === context.config.callbackUrl
  ));

  if (existing) {
    context.store.upsertSubscription(context.db, {
      id: existing.id,
      moduleKey: 'giveaways',
      subscriptionType: existing.type,
      subscriptionVersion: existing.version,
      broadcasterUserId: context.connection.broadcaster_user_id,
      condition: existing.condition ?? {},
      transportMethod: existing.transport?.method ?? 'webhook',
      callbackUrl: existing.transport?.callback ?? context.config.callbackUrl ?? null,
      status: existing.status,
      lastSyncAttemptAt: utcIso(),
    });
    return;
  }

  const created = await context.gateway.eventSubApiRequest<{ data?: Array<{
    id: string;
    status: string;
    type: string;
    version: string;
    condition?: {
      broadcaster_user_id?: string;
      reward_id?: string;
    };
    transport?: {
      method?: string;
      callback?: string;
    };
  }> }>({
    path: '/eventsub/subscriptions',
    method: 'POST',
    body: {
      type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
      version: GIVEAWAY_REDEMPTION_SUBSCRIPTION_VERSION,
      condition: {
        broadcaster_user_id: context.connection.broadcaster_user_id,
        reward_id: settings.reward_id,
      },
      transport: {
        method: 'webhook',
        callback: context.config.callbackUrl,
        secret: context.config.eventSubSecret,
      },
    },
  });

  const subscription = created.data?.[0];
  if (!subscription?.id) {
    throw new AppError('The Twitch EventSub subscription could not be created.', 502);
  }

  context.store.upsertSubscription(context.db, {
    id: subscription.id,
    moduleKey: 'giveaways',
    subscriptionType: subscription.type,
    subscriptionVersion: subscription.version,
    broadcasterUserId: context.connection.broadcaster_user_id,
    condition: subscription.condition ?? {},
    transportMethod: subscription.transport?.method ?? 'webhook',
    callbackUrl: subscription.transport?.callback ?? context.config.callbackUrl ?? null,
    status: subscription.status,
    lastSyncAttemptAt: utcIso(),
  });
}

function upsertTurnFromRedemption(db: Database, event: TwitchRewardRedemptionEvent) {
  const redemptionId = String(event.id ?? '').trim();
  const rewardId = String(event.reward?.id ?? '').trim();
  if (!redemptionId || !rewardId) {
    throw new AppError('The Twitch redemption payload is incomplete.', 400);
  }

  const now = utcIso();
  db.prepare(`
    INSERT OR IGNORE INTO twitch_loot_chest_turns (
      redemption_id,
      reward_id,
      viewer_twitch_id,
      viewer_login,
      viewer_display_name,
      user_input,
      status,
      result,
      prize_chest_index,
      selected_chests_json,
      revealed_chests_json,
      fulfillment_status,
      redeemed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 'pending', NULL, '[]', '[]', 'UNFULFILLED', ?, ?, ?)
  `).run(
    redemptionId,
    rewardId,
    String(event.user_id ?? '').trim(),
    String(event.user_login ?? '').trim(),
    String(event.user_name ?? event.user_login ?? '').trim() || 'Viewer',
    String(event.user_input ?? '').trim() || null,
    String(event.redeemed_at ?? now).trim() || now,
    now,
    now,
  );

  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE redemption_id = ?
    LIMIT 1
  `).get(redemptionId) as LootChestTurnRow;
}

export const twitchGiveawaysModuleHandler: TwitchModuleHandler = {
  moduleKey: 'giveaways',
  label: 'Giveaways',
  href: '/v/giveaways/',
  subscriptionTypes: [GIVEAWAY_REDEMPTION_SUBSCRIPTION],

  buildHealth(db): TwitchModuleHealth {
    const settings = getSettingsRow(db);
    const connection = twitchPlatformStore.getActiveBroadcaster(db);
    const subscription = findGiveawaySubscription(db, connection?.broadcaster_user_id ?? settings.broadcaster_user_id, settings.reward_id);
    const queueCount = queuedTurnRows(db).length;
    const activeTurn = activeTurnRow(db);

    let status: TwitchModuleHealth['status'] = 'ready';
    let summary = 'Reward, queue, and EventSub wiring are ready.';
    if (!connection?.access_token) {
      status = 'critical';
      summary = 'Connect the broadcaster account before the giveaway module can run.';
    } else if (!settings.reward_id || !subscription) {
      status = 'warning';
      summary = 'Sync the managed reward and its EventSub subscription.';
    }

    return {
      key: 'giveaways',
      label: 'Loot chest giveaways',
      href: '/v/giveaways/',
      status,
      summary,
      chips: [
        connection ? `Broadcaster: ${connection.broadcaster_display_name}` : 'No broadcaster',
        settings.reward_id ? 'Reward ready' : 'Reward missing',
        subscription?.status ?? 'Subscription unsynced',
        activeTurn ? '1 active turn' : `${queueCount} queued`,
      ],
    };
  },

  async syncSubscriptions(context) {
    const settings = await syncManagedReward(context.db);
    await syncGiveawaySubscription(context, settings);
  },

  async processDelivery(context) {
    const settings = getSettingsRow(context.db);
    const event = (context.envelope.event ?? {}) as TwitchRewardRedemptionEvent;
    const rewardId = String(event.reward?.id ?? '').trim();
    if (!settings.reward_id || !rewardId || rewardId !== settings.reward_id) {
      return 'ignored';
    }
    upsertTurnFromRedemption(context.db, event);
    return 'processed';
  },
};

export const isTwitchGameOperator = isTwitchPlatformOperator;
export const twitchGameLoginHref = twitchPlatformLoginHref;
export const requireTwitchGameOperator = requireTwitchPlatformOperator;

export async function beginTwitchConnect(actor: Awaited<ReturnType<typeof requireTwitchPlatformOperator>>) {
  return beginTwitchPlatformConnect(actor, '/v/giveaways/');
}

export async function completeTwitchConnect(params: {
  code?: string | null;
  state?: string | null;
  actor: Awaited<ReturnType<typeof requireTwitchPlatformOperator>>;
}) {
  await completeTwitchPlatformConnect(params);
  await twitchGiveawaysModuleHandler.syncSubscriptions({
    db: getDb(),
    config: getTwitchPlatformConfig(),
    connection: await twitchPlatformGateway.ensureFreshBroadcaster(getDb()),
    gateway: twitchPlatformGateway,
    store: twitchPlatformStore,
  });
  return buildLootChestGameState(params.actor);
}

function assertTurnById(db: Database, turnId: number) {
  const row = db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE id = ?
    LIMIT 1
  `).get(turnId) as LootChestTurnRow | undefined;
  if (!row) {
    throw new AppError('That loot chest turn does not exist.', 404);
  }
  return row;
}

function assertNoActiveTurn(db: Database, turnId?: number) {
  const current = activeTurnRow(db);
  if (current && current.id !== turnId) {
    throw new AppError('Finish the active loot chest turn before starting another one.', 400);
  }
}

function randomPrizeChestIndex() {
  return crypto.randomInt(0, CHEST_COUNT);
}

export async function startLootChestTurn(turnId: number) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  assertNoActiveTurn(db, turnId);
  const row = assertTurnById(db, turnId);
  if (row.status !== 'queued') {
    throw new AppError('Only queued turns can be started.', 400);
  }

  db.prepare(`
    UPDATE twitch_loot_chest_turns
    SET status = 'active',
        result = 'pending',
        prize_chest_index = ?,
        selected_chests_json = '[]',
        revealed_chests_json = '[]',
        started_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(randomPrizeChestIndex(), utcIso(), utcIso(), turnId);

  return mapTurnRow(assertTurnById(db, turnId));
}

export async function selectLootChestTurnChests(turnId: number, chestIndexes: unknown) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  const row = assertTurnById(db, turnId);
  if (row.status !== 'active') {
    throw new AppError('Selections can only be locked for the active turn.', 400);
  }

  const board = buildTurnBoard(row);
  if (!board) {
    throw new AppError('The active turn board could not be loaded.', 500);
  }
  if (board.revealedChests.length > 0) {
    throw new AppError('Selections are locked once chest reveals begin.', 400);
  }

  const selected = normalizeChestIndexes(chestIndexes);
  if (selected.length !== CHEST_SELECTION_LIMIT) {
    throw new AppError(`Select exactly ${CHEST_SELECTION_LIMIT} unique chests.`, 400);
  }

  db.prepare(`
    UPDATE twitch_loot_chest_turns
    SET selected_chests_json = ?,
        updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(selected), utcIso(), turnId);

  return mapTurnRow(assertTurnById(db, turnId));
}

export async function revealNextLootChest(turnId: number) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  const row = assertTurnById(db, turnId);
  if (row.status !== 'active') {
    throw new AppError('Only the active turn can reveal a chest.', 400);
  }

  const selected = parseChestIndexes(row.selected_chests_json);
  const revealed = parseChestIndexes(row.revealed_chests_json);
  if (selected.length !== CHEST_SELECTION_LIMIT) {
    throw new AppError('Select three chests before revealing.', 400);
  }

  const nextChest = selected.find((index) => !revealed.includes(index));
  if (nextChest === undefined) {
    throw new AppError('All selected chests are already revealed.', 400);
  }

  const nextRevealed = [...revealed, nextChest];
  const prizeIndex = Number.isInteger(row.prize_chest_index) ? Number(row.prize_chest_index) : null;
  const result: LootChestTurnResult = prizeIndex !== null && nextRevealed.includes(prizeIndex)
    ? 'win'
    : nextRevealed.length >= CHEST_SELECTION_LIMIT
      ? 'miss'
      : 'pending';

  db.prepare(`
    UPDATE twitch_loot_chest_turns
    SET revealed_chests_json = ?,
        result = ?,
        updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(nextRevealed), result, utcIso(), turnId);

  return mapTurnRow(assertTurnById(db, turnId));
}

async function fulfillTwitchRedemption(db: Database, row: LootChestTurnRow) {
  const connection = await twitchPlatformGateway.ensureFreshBroadcaster(db);
  await twitchPlatformGateway.userApiRequest(db, {
    path: '/channel_points/custom_rewards/redemptions',
    method: 'PATCH',
    query: {
      broadcaster_id: connection.broadcaster_user_id,
      reward_id: row.reward_id,
      id: row.redemption_id,
    },
    body: {
      status: 'FULFILLED',
    },
  });
}

export async function completeLootChestTurn(turnId: number) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  const row = assertTurnById(db, turnId);
  if (row.status !== 'active') {
    throw new AppError('Only the active turn can be completed.', 400);
  }

  const board = buildTurnBoard(row);
  if (!board || board.revealedChests.length !== CHEST_SELECTION_LIMIT) {
    throw new AppError('Reveal all three selected chests before completing the turn.', 400);
  }

  await fulfillTwitchRedemption(db, row);
  const resolvedResult = turnResult(row);

  db.prepare(`
    UPDATE twitch_loot_chest_turns
    SET status = 'completed',
        result = ?,
        fulfillment_status = 'FULFILLED',
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(resolvedResult, utcIso(), utcIso(), turnId);

  return mapTurnRow(assertTurnById(db, turnId));
}

export async function syncLootChestReward(input?: Partial<{ title: string; prompt: string; cost: number }>) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  await syncManagedReward(db, input);
  await syncGiveawaySubscription({
    db,
    config: getTwitchPlatformConfig(),
    connection: await twitchPlatformGateway.ensureFreshBroadcaster(db),
    gateway: twitchPlatformGateway,
    store: twitchPlatformStore,
  });
  return connectionStateFromRows(db);
}

export async function pauseLootChestReward(paused: boolean) {
  const db = getDb();
  await requireTwitchPlatformOperator();
  await setRewardPaused(db, paused);
  return connectionStateFromRows(db);
}

export async function buildLootChestGameState(actor?: Awaited<ReturnType<typeof requireTwitchPlatformOperator>>): Promise<LootChestGameState> {
  const db = getDb();
  const operator = actor ?? await requireTwitchPlatformOperator();
  const queue = queuedTurnRows(db).map(mapTurnRow);
  const activeTurn = activeTurnRow(db);
  const recentResults = recentCompletedTurns(db).map(mapTurnRow);

  return {
    operator: {
      displayName: displayName(operator),
      discordId: operator.discord_id,
    },
    connection: connectionStateFromRows(db),
    queue,
    activeTurn: activeTurn ? mapTurnRow(activeTurn) : null,
    recentResults,
    canStartNextTurn: !activeTurn && queue.length > 0,
  };
}

export function buildLootChestOverlayStateFromToken(token: string): LootChestOverlayState | null {
  const db = getDb();
  const settings = getSettingsRow(db);
  if (!token || token !== settings.overlay_token) {
    return null;
  }

  const activeTurn = activeTurnRow(db);
  const lastResolved = recentCompletedTurns(db, 1)[0];

  return {
    connection: {
      connected: Boolean(twitchPlatformStore.getActiveBroadcaster(db)?.access_token),
      reward: connectionStateFromRows(db).reward,
    },
    queueCount: queuedTurnRows(db).length,
    activeTurn: activeTurn ? mapTurnRow(activeTurn) : null,
    lastResolvedTurn: lastResolved ? mapTurnRow(lastResolved) : null,
  };
}

export function lootChestStateForOverlayToken(token: string) {
  const state = buildLootChestOverlayStateFromToken(token);
  if (!state) {
    throw new AppError('Overlay token is invalid.', 404);
  }
  return state;
}

export async function reconnectManagedRewardAndSubscription() {
  const db = getDb();
  await requireTwitchPlatformOperator();
  await syncManagedReward(db);
  await syncGiveawaySubscription({
    db,
    config: getTwitchPlatformConfig(),
    connection: await twitchPlatformGateway.ensureFreshBroadcaster(db),
    gateway: twitchPlatformGateway,
    store: twitchPlatformStore,
  });
  return connectionStateFromRows(db);
}

export function overlayTokenFromSettings() {
  return getSettingsRow(getDb()).overlay_token;
}

export function turnRowsForTests() {
  return listTurnRows(getDb());
}

export function insertQueuedLootChestTurnForTests(input: {
  rewardId?: string;
  redemptionId?: string;
  viewerTwitchId?: string;
  viewerLogin?: string;
  viewerDisplayName?: string;
  redeemedAt?: string;
}) {
  const db = getDb();
  const settings = getSettingsRow(db);
  const now = utcIso();
  db.prepare(`
    INSERT INTO twitch_loot_chest_turns (
      redemption_id,
      reward_id,
      viewer_twitch_id,
      viewer_login,
      viewer_display_name,
      user_input,
      status,
      result,
      prize_chest_index,
      selected_chests_json,
      revealed_chests_json,
      fulfillment_status,
      redeemed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, NULL, 'queued', 'pending', NULL, '[]', '[]', 'UNFULFILLED', ?, ?, ?)
  `).run(
    input.redemptionId ?? `redemption-${randomToken(6)}`,
    input.rewardId ?? settings.reward_id ?? 'reward-1',
    input.viewerTwitchId ?? `viewer-${randomToken(4)}`,
    input.viewerLogin ?? 'viewer_login',
    input.viewerDisplayName ?? 'Viewer Name',
    input.redeemedAt ?? now,
    now,
    now,
  );

  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    ORDER BY id DESC
    LIMIT 1
  `).get() as LootChestTurnRow;
}
