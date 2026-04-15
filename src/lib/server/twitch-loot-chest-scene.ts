import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  LootChestBoard,
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestPresentationAction,
  LootChestPresentationPhase,
  LootChestSceneSnapshot,
  LootChestTurn,
  LootChestTurnResult,
  LootChestTurnStatus,
} from '../types';

const SETTINGS_KEY = 'default';
const CHEST_COUNT = 10;
const CHEST_SELECTION_LIMIT = 3;
const DEFAULT_REWARD_TITLE = 'Loot Chest Spin';
const DEFAULT_REWARD_PROMPT = 'Redeem for a host-run Ghosted loot chest turn.';
const DEFAULT_REWARD_COST = 1000;

type LootChestSettingsRow = {
  singleton_key: string;
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
  board_revision: number;
  last_action: string | null;
  last_action_at: string | null;
  last_changed_chest_index: number | null;
  redeemed_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function utcIso(value?: Date | string | null) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function jsonLoad<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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

function getSettingsRow(db: Database) {
  ensureSettingsRow(db);
  return db.prepare(`
    SELECT singleton_key, reward_id, reward_title, reward_prompt, reward_cost, reward_is_paused, reward_is_enabled, overlay_token, created_at, updated_at
    FROM twitch_loot_chest_settings
    WHERE singleton_key = ?
    LIMIT 1
  `).get(SETTINGS_KEY) as LootChestSettingsRow;
}

function activeTurnRow(db: Database) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE status = 'active'
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  `).get() as LootChestTurnRow | undefined;
}

function queuedTurnRows(db: Database) {
  return db.prepare(`
    SELECT *
    FROM twitch_loot_chest_turns
    WHERE status = 'queued'
    ORDER BY redeemed_at ASC, id ASC
  `).all() as LootChestTurnRow[];
}

function recentCompletedTurns(db: Database, limit = 8) {
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

function lastChangedChestIndex(row: LootChestTurnRow) {
  return Number.isInteger(row.last_changed_chest_index) ? Number(row.last_changed_chest_index) : null;
}

function lastPresentationAction(row: LootChestTurnRow): LootChestPresentationAction {
  const action = String(row.last_action ?? '').trim();
  if (
    action === 'queued'
    || action === 'turn_started'
    || action === 'chests_selected'
    || action === 'chest_revealed'
    || action === 'turn_completed'
  ) {
    return action;
  }
  return 'queued';
}

function boardRevision(row: LootChestTurnRow, selected: number[], revealed: number[]) {
  const explicitRevision = Number(row.board_revision ?? 0);
  if (explicitRevision > 0) {
    return explicitRevision;
  }

  let fallbackRevision = 0;
  if (row.status !== 'queued' || row.started_at) fallbackRevision += 1;
  if (selected.length === CHEST_SELECTION_LIMIT) fallbackRevision += 1;
  fallbackRevision += revealed.length;
  if (row.status === 'completed') fallbackRevision += 1;
  return fallbackRevision;
}

function chestRevealState(
  index: number,
  selected: number[],
  revealed: number[],
  prizeIndex: number | null,
): LootChestBoard['chests'][number]['revealState'] {
  const isSelected = selected.includes(index);
  const isRevealed = revealed.includes(index);
  if (!isRevealed) return isSelected ? 'selected' : 'closed';
  return prizeIndex === index ? 'prize' : 'empty';
}

function presentationPhase(row: LootChestTurnRow, selected: number[], revealed: number[]): LootChestPresentationPhase {
  if (row.status === 'queued') return 'queued';
  if (row.status === 'completed') return 'resolved';
  if (selected.length < CHEST_SELECTION_LIMIT) return 'selection';
  if (revealed.length === 0) return 'locked';
  if (revealed.length < CHEST_SELECTION_LIMIT) return 'revealing';
  return 'resolved';
}

function boardPhaseFromTurnPhase(phase: LootChestPresentationPhase): Exclude<LootChestPresentationPhase, 'queued'> {
  return phase === 'queued' ? 'selection' : phase;
}

function chestPresentationState(input: {
  row: LootChestTurnRow;
  index: number;
  selectedChests: number[];
  revealedChests: number[];
  prizeIndex: number | null;
  phase: Exclude<LootChestPresentationPhase, 'queued'>;
}) {
  const { row, index, selectedChests, revealedChests, prizeIndex, phase } = input;
  const revealState = chestRevealState(index, selectedChests, revealedChests, prizeIndex);
  const isSelected = selectedChests.includes(index);
  const isRevealed = revealedChests.includes(index);
  const isPrize = prizeIndex === index;
  const isLastChanged = lastChangedChestIndex(row) === index;
  const revealCue = isLastChanged && lastPresentationAction(row) === 'chest_revealed';

  let spriteState: LootChestChestSpriteState = 'closed';
  let animationState: LootChestChestAnimationState = 'idle';

  if (revealCue) {
    spriteState = 'opening';
    animationState = 'opening';
  } else if (isRevealed && isPrize) {
    spriteState = phase === 'resolved' ? 'resolved-prize' : 'prize';
    animationState = phase === 'resolved' ? 'burst' : 'settled';
  } else if (isRevealed) {
    spriteState = phase === 'resolved' ? 'resolved-empty' : 'empty';
    animationState = 'settled';
  } else if (isSelected && selectedChests.length === CHEST_SELECTION_LIMIT) {
    spriteState = 'locked';
    animationState = 'idle';
  } else if (isSelected) {
    spriteState = 'selected';
    animationState = 'pulse';
  }

  return {
    revealState,
    spriteState,
    animationState,
    revealCue,
  };
}

function buildTurnBoard(row: LootChestTurnRow | null | undefined): LootChestBoard | null {
  if (!row) return null;
  const selectedChests = parseChestIndexes(row.selected_chests_json);
  const revealedChests = parseChestIndexes(row.revealed_chests_json);
  const prizeIndex = Number.isInteger(row.prize_chest_index) ? Number(row.prize_chest_index) : null;
  const prizeFound = prizeIndex !== null && revealedChests.includes(prizeIndex);
  const revealPrizeLocation = row.status === 'completed';
  const phase = boardPhaseFromTurnPhase(presentationPhase(row, selectedChests, revealedChests));
  const action = lastPresentationAction(row);

  return {
    totalChests: CHEST_COUNT,
    selectionLimit: CHEST_SELECTION_LIMIT,
    phase,
    boardRevision: boardRevision(row, selectedChests, revealedChests),
    prizeChestIndex: row.status === 'completed' ? prizeIndex : null,
    selectedChests,
    revealedChests,
    remainingSelections: Math.max(0, CHEST_SELECTION_LIMIT - selectedChests.length),
    remainingReveals: Math.max(0, selectedChests.length - revealedChests.length),
    prizeFound,
    allSelectionsLocked: selectedChests.length === CHEST_SELECTION_LIMIT,
    lastAction: action,
    lastActionAt: row.last_action_at,
    lastChangedChestIndex: lastChangedChestIndex(row),
    activeAnimationChestIndex: action === 'chest_revealed' ? lastChangedChestIndex(row) : null,
    chests: Array.from({ length: CHEST_COUNT }, (_, index) => {
      const presentation = chestPresentationState({
        row,
        index,
        selectedChests,
        revealedChests,
        prizeIndex,
        phase,
      });
      return {
        index,
        label: String(index + 1),
        selected: selectedChests.includes(index),
        revealed: revealedChests.includes(index),
        containsPrize: prizeIndex === index && (revealPrizeLocation || revealedChests.includes(index)),
        revealState: presentation.revealState,
        spriteState: presentation.spriteState,
        animationState: presentation.animationState,
        revealCue: presentation.revealCue,
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
  const board = buildTurnBoard(row);
  const resolvedResult = turnResult(row);
  const phase = presentationPhase(
    row,
    parseChestIndexes(row.selected_chests_json),
    parseChestIndexes(row.revealed_chests_json),
  );
  const prizeIndex = Number.isInteger(row.prize_chest_index) ? Number(row.prize_chest_index) : null;

  return {
    id: row.id,
    redemptionId: row.redemption_id,
    rewardId: row.reward_id,
    status: row.status,
    result: resolvedResult,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    phase,
    lastAction: lastPresentationAction(row),
    lastActionAt: row.last_action_at,
    resolutionCue: resolvedResult === 'pending'
      ? null
      : {
        result: resolvedResult,
        highlightChestIndex: (
          resolvedResult === 'win'
          || row.status === 'completed'
        ) ? prizeIndex : null,
      },
    userInput: row.user_input,
    viewer: {
      twitchId: row.viewer_twitch_id,
      login: row.viewer_login,
      displayName: row.viewer_display_name,
    },
    board,
  };
}

function latestScenePublishedAt(input: {
  settings: LootChestSettingsRow;
  queued: LootChestTurnRow[];
  active: LootChestTurnRow | null;
  lastResolved: LootChestTurnRow | null;
}) {
  const timestamps = [
    input.settings.updated_at,
    input.active?.updated_at ?? null,
    input.lastResolved?.updated_at ?? null,
    input.queued[0]?.updated_at ?? null,
  ].filter((value): value is string => Boolean(value));

  const latestTimestamp = timestamps.reduce((latest, value) => {
    if (!latest) return value;
    return Date.parse(value) > Date.parse(latest) ? value : latest;
  }, '');

  return latestTimestamp || utcIso();
}

function sceneRevisionFromTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildLootChestSceneSnapshot(db: Database): LootChestSceneSnapshot {
  const settings = getSettingsRow(db);
  const queued = queuedTurnRows(db);
  const active = activeTurnRow(db) ?? null;
  const lastResolved = recentCompletedTurns(db, 1)[0] ?? null;
  const publishedAt = latestScenePublishedAt({
    settings,
    queued,
    active,
    lastResolved,
  });

  return {
    revision: sceneRevisionFromTimestamp(publishedAt),
    publishedAt,
    queueCount: queued.length,
    reward: {
      id: settings.reward_id,
      title: settings.reward_title || DEFAULT_REWARD_TITLE,
      prompt: settings.reward_prompt || DEFAULT_REWARD_PROMPT,
      cost: Number(settings.reward_cost ?? DEFAULT_REWARD_COST),
      isPaused: Boolean(settings.reward_is_paused),
      isEnabled: Boolean(settings.reward_is_enabled),
    },
    focusTurn: active ? mapTurnRow(active) : lastResolved ? mapTurnRow(lastResolved) : null,
  };
}

export function isValidLootChestOverlayToken(token: string, db: Database) {
  const normalized = String(token ?? '').trim();
  return Boolean(normalized) && normalized === getSettingsRow(db).overlay_token;
}
