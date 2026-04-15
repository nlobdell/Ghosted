'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  LootChestBoardChest,
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestTurn,
  TwitchRewardConnectionState,
} from '@/lib/types';
import styles from './loot-chest-scene.module.css';

const REVEAL_ANIMATION_MS = 1400;

type LootChestSceneReward = Pick<TwitchRewardConnectionState, 'reward'>['reward'];

function spriteAssetForState(state: LootChestChestSpriteState) {
  switch (state) {
    case 'selected':
      return '/giveaways/sprites/chest-selected.svg';
    case 'locked':
      return '/giveaways/sprites/chest-locked.svg';
    case 'opening':
      return '/giveaways/sprites/chest-opening.svg';
    case 'empty':
    case 'resolved-empty':
      return '/giveaways/sprites/chest-empty.svg';
    case 'prize':
    case 'resolved-prize':
      return '/giveaways/sprites/chest-prize.svg';
    case 'closed':
    default:
      return '/giveaways/sprites/chest-closed.svg';
  }
}

function badgeIcon(kind: 'reward' | 'queue' | 'viewer') {
  if (kind === 'reward') return '/giveaways/sprites/badge-reward.svg';
  if (kind === 'queue') return '/giveaways/sprites/badge-queue.svg';
  return '/giveaways/sprites/badge-viewer.svg';
}

function resultAsset(result: LootChestTurn['result'] | null | undefined) {
  if (result === 'win') return '/giveaways/sprites/result-win.svg';
  if (result === 'miss') return '/giveaways/sprites/result-miss.svg';
  return null;
}

function sceneHeadline(turn: LootChestTurn | null, queueCount: number) {
  if (turn?.status === 'active') {
    return `${turn.viewer.displayName} is on the board`;
  }
  if (turn?.status === 'completed') {
    return turn.result === 'win'
      ? `${turn.viewer.displayName} cracked the treasure chest`
      : `${turn.viewer.displayName} came up empty`;
  }
  if (queueCount > 0) {
    return `${queueCount} queued turn${queueCount === 1 ? '' : 's'} waiting`;
  }
  return 'Treasure board standing by';
}

function sceneSummary(turn: LootChestTurn | null, queueCount: number, reward: LootChestSceneReward) {
  if (!turn?.board) {
    return queueCount > 0
      ? `The host can start the next ${reward.title} turn at any time.`
      : `Waiting for the next ${reward.title} redemption.`;
  }
  if (turn.phase === 'selection') {
    return 'Choose three chests before the reveal begins.';
  }
  if (turn.phase === 'locked') {
    return 'Three chests are locked in and ready to open.';
  }
  if (turn.phase === 'revealing') {
    return `Revealing chest ${turn.board.revealedChests.length + 1} of ${turn.board.selectionLimit}.`;
  }
  if (turn.result === 'win') {
    return 'The prize chest is open and the board is celebrating the win.';
  }
  return 'All chosen chests are open and the board has resolved.';
}

function chestLabel(chest: LootChestBoardChest, spriteState: LootChestChestSpriteState) {
  if (spriteState === 'prize' || spriteState === 'resolved-prize') return 'Prize';
  if (spriteState === 'empty' || spriteState === 'resolved-empty') return 'Empty';
  if (spriteState === 'locked') return 'Locked';
  if (spriteState === 'selected') return 'Marked';
  if (spriteState === 'opening') return 'Opening';
  return chest.label;
}

function displaySpriteState(
  chest: LootChestBoardChest,
  boardSelectionLimit: number,
  selectedIndices: Set<number>,
  interactive: boolean,
): LootChestChestSpriteState {
  if (!interactive) {
    return chest.spriteState;
  }
  if (selectedIndices.has(chest.index)) {
    return selectedIndices.size === boardSelectionLimit ? 'locked' : 'selected';
  }
  return chest.revealed ? chest.spriteState : 'closed';
}

function displayAnimationState(
  chest: LootChestBoardChest,
  spriteState: LootChestChestSpriteState,
): LootChestChestAnimationState {
  if (chest.animationState === 'opening' || spriteState === 'opening') return 'opening';
  if (spriteState === 'selected') return 'pulse';
  if (spriteState === 'resolved-prize') return 'burst';
  if (spriteState === 'resolved-empty' || spriteState === 'prize' || spriteState === 'empty') return 'settled';
  return chest.animationState;
}

export function LootChestScene({
  turn,
  queueCount,
  reward,
  variant = 'overlay',
  draftSelections,
  onToggleSelection,
}: {
  turn: LootChestTurn | null;
  queueCount: number;
  reward: LootChestSceneReward;
  variant?: 'overlay' | 'host';
  draftSelections?: number[];
  onToggleSelection?: (index: number) => void;
}) {
  const board = turn?.board ?? null;
  const interactive = Boolean(onToggleSelection && board && turn?.status === 'active' && !board.allSelectionsLocked && board.revealedChests.length === 0);
  const selectedIndices = new Set(interactive ? (draftSelections ?? []) : board?.selectedChests ?? []);
  const [animatedRevision, setAnimatedRevision] = useState(0);
  const lastAnimatedRef = useRef(board?.boardRevision ?? 0);
  const lastTurnIdRef = useRef(turn?.id ?? 0);

  useEffect(() => {
    const nextTurnId = turn?.id ?? 0;
    const nextRevision = board?.boardRevision ?? 0;
    const shouldAnimate = nextRevision > 0 && (nextRevision > lastAnimatedRef.current || nextTurnId !== lastTurnIdRef.current);

    lastAnimatedRef.current = nextRevision;
    lastTurnIdRef.current = nextTurnId;

    if (!shouldAnimate) {
      return undefined;
    }

    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      setAnimatedRevision(nextRevision);
      timeoutId = window.setTimeout(() => {
        setAnimatedRevision((current) => (current === nextRevision ? 0 : current));
      }, REVEAL_ANIMATION_MS);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [board?.boardRevision, turn?.id]);

  const changedChestIndex = board?.activeAnimationChestIndex ?? board?.lastChangedChestIndex ?? null;
  const animateResult = Boolean(
    turn?.resolutionCue
    && board
    && animatedRevision === board.boardRevision,
  );

  return (
    <section className={`${styles.scene} ${variant === 'host' ? styles.sceneHost : styles.sceneOverlay}`}>
      <div className={styles.ambientHalo} aria-hidden="true" />
      <div className={styles.sceneHeader}>
        <div className={styles.titleStack}>
          <p className={styles.kicker}>Ghosted loot chest</p>
          <h2 className={styles.headline}>{sceneHeadline(turn, queueCount)}</h2>
          <p className={styles.summary}>{sceneSummary(turn, queueCount, reward)}</p>
        </div>

        <div className={styles.badgeRow}>
          <div className={styles.badge} data-badge-kind="viewer">
            <span className={styles.badgeIcon} style={{ ['--badge-icon' as string]: `url("${badgeIcon('viewer')}")` }} aria-hidden="true" />
            <span>
              <strong>{turn?.viewer.displayName ?? 'Stand by'}</strong>
              <small>{turn ? `@${turn.viewer.login}` : 'No active viewer'}</small>
            </span>
          </div>
          <div className={styles.badge} data-badge-kind="queue">
            <span className={styles.badgeIcon} style={{ ['--badge-icon' as string]: `url("${badgeIcon('queue')}")` }} aria-hidden="true" />
            <span>
              <strong>{queueCount}</strong>
              <small>queued turn{queueCount === 1 ? '' : 's'}</small>
            </span>
          </div>
          <div className={styles.badge} data-badge-kind="reward">
            <span className={styles.badgeIcon} style={{ ['--badge-icon' as string]: `url("${badgeIcon('reward')}")` }} aria-hidden="true" />
            <span>
              <strong>{reward.title}</strong>
              <small>{reward.cost.toLocaleString()} points</small>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.boardShell}>
        <div className={styles.boardFrame} aria-hidden="true" />
        {board ? (
          <>
            <div className={styles.boardMeta}>
              <span className={styles.metaChip}>{selectedIndices.size} / {board.selectionLimit} selected</span>
              <span className={styles.metaChip}>{board.revealedChests.length} revealed</span>
              <span className={styles.metaChip}>{board.phase}</span>
              <span className={styles.metaChip}>rev {board.boardRevision}</span>
            </div>

            <div className={styles.boardGrid}>
              {board.chests.map((chest) => {
                const spriteState = displaySpriteState(chest, board.selectionLimit, selectedIndices, interactive);
                const animationState = displayAnimationState(chest, spriteState);
                const animateReveal = Boolean(
                  board
                  && changedChestIndex === chest.index
                  && board.boardRevision === animatedRevision
                  && chest.revealCue,
                );
                const chestClassName = [
                  styles.chest,
                  interactive ? styles.chestInteractive : '',
                  spriteState === 'selected' ? styles.chestSelected : '',
                  spriteState === 'locked' ? styles.chestLocked : '',
                  spriteState === 'prize' || spriteState === 'resolved-prize' ? styles.chestPrize : '',
                  spriteState === 'empty' || spriteState === 'resolved-empty' ? styles.chestEmpty : '',
                  animateReveal ? styles.chestReveal : '',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={chest.index}
                    type="button"
                    className={chestClassName}
                    disabled={!interactive}
                    onClick={() => onToggleSelection?.(chest.index)}
                    data-chest-index={chest.index}
                    data-sprite-state={spriteState}
                    data-animation-state={animationState}
                    data-reveal-cue={chest.revealCue ? 'true' : 'false'}
                    data-active-animation={animateReveal ? 'true' : 'false'}
                  >
                    <span className={styles.chestGlow} aria-hidden="true" />
                    <span
                      className={styles.chestSprite}
                      style={{ ['--chest-sprite' as string]: `url("${spriteAssetForState(spriteState)}")` }}
                      aria-hidden="true"
                    />
                    <span className={styles.chestNumber}>{chest.label}</span>
                    <span className={styles.chestWord}>{chestLabel(chest, spriteState)}</span>
                  </button>
                );
              })}
            </div>

            {turn?.resolutionCue && resultAsset(turn.resolutionCue.result) ? (
              <div
                className={`${styles.outcomeBurst} ${animateResult ? styles.outcomeBurstAnimated : ''}`}
                style={{ ['--result-asset' as string]: `url("${resultAsset(turn.resolutionCue.result)}")` }}
                data-result-cue={animateResult ? 'true' : 'false'}
                aria-hidden="true"
              />
            ) : null}
          </>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyCrest} aria-hidden="true" />
            <strong>No active board</strong>
            <p>The next redemption will light up the treasure room as soon as the host starts a turn.</p>
          </div>
        )}
      </div>

      <div className={styles.statusRail}>
        <span className={styles.statusChip}>{turn?.phase ?? 'queued'}</span>
        <span className={styles.statusChip}>
          {turn?.result === 'win'
            ? 'Prize found'
            : turn?.result === 'miss'
              ? 'All picks opened'
              : 'Treasure hidden'}
        </span>
        <span className={styles.statusChip}>
          {turn?.lastActionAt ? `Updated ${new Date(turn.lastActionAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for motion'}
        </span>
      </div>
    </section>
  );
}
