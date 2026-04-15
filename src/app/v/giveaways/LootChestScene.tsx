'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  LootChestBoardChest,
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestPresentationCue,
  LootChestSceneSnapshot,
  LootChestTurn,
} from '@/lib/types';
import styles from './loot-chest-scene.module.css';

const REVEAL_ANIMATION_MS = 1400;

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

function resultAsset(result: LootChestTurn['result'] | null | undefined) {
  if (result === 'win') return '/giveaways/sprites/result-win.svg';
  if (result === 'miss') return '/giveaways/sprites/result-miss.svg';
  return null;
}

function phaseLabel(phase: LootChestTurn['phase'] | null | undefined, queueCount: number) {
  if (phase === 'selection') return 'Choose 3 chests';
  if (phase === 'locked') return 'Ready to reveal';
  if (phase === 'revealing') return 'Reveal in progress';
  if (phase === 'resolved') return 'Board resolved';
  return queueCount > 0 ? 'Waiting in queue' : 'Idle';
}

function sceneHeadline(turn: LootChestTurn | null, queueCount: number) {
  if (turn?.status === 'active') {
    return `${turn.viewer.displayName} is on the board`;
  }
  if (turn?.status === 'completed') {
    return turn.result === 'win'
      ? `${turn.viewer.displayName} found the prize`
      : `${turn.viewer.displayName} missed the prize`;
  }
  if (queueCount > 0) {
    return `${queueCount} waiting to play`;
  }
  return 'Loot chest ready';
}

function sceneSummary(turn: LootChestTurn | null, queueCount: number, rewardTitle: string) {
  if (!turn?.board) {
    return queueCount > 0
      ? `Start the next ${rewardTitle.toLowerCase()} turn when stream timing is right.`
      : `Waiting for the next ${rewardTitle.toLowerCase()} redemption.`;
  }
  if (turn.phase === 'selection') {
    return 'Choose three chests.';
  }
  if (turn.phase === 'locked') {
    return 'Three chests are locked in. Reveal when ready.';
  }
  if (turn.phase === 'revealing') {
    return `Reveal ${turn.board.revealedChests.length + 1} of ${turn.board.selectionLimit}.`;
  }
  if (turn.result === 'win') {
    return 'Prize found. Awaiting completion.';
  }
  return 'Board resolved. Awaiting completion.';
}

function footerNote(
  turn: LootChestTurn | null,
  selectedCount: number,
  queueCount: number,
) {
  const board = turn?.board;

  if (!board) {
    return queueCount > 0
      ? 'The next redemption is ready in queue.'
      : 'Waiting for the next Twitch redemption.';
  }

  if (!board.allSelectionsLocked) {
    return `${selectedCount} of ${board.selectionLimit} picks marked. Choose three chests.`;
  }

  if (turn?.phase === 'locked') {
    return 'Three picks locked. Reveal the first chest when ready.';
  }

  if (board.remainingReveals > 0) {
    return `${board.revealedChests.length} of ${board.selectionLimit} opened. Reveal the next chest.`;
  }

  if (turn?.result === 'win') {
    return 'Prize chest found. Complete the turn when you are ready.';
  }

  if (turn?.result === 'miss') {
    return 'No prize chest in the chosen set. Complete the turn to fulfill Twitch.';
  }

  return 'Board resolved. Complete the turn when ready.';
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
  scene,
  presentationCue,
  draftSelections,
  onToggleSelection,
  onPreviewChest,
  frame = 'standalone',
}: {
  scene: LootChestSceneSnapshot;
  presentationCue?: LootChestPresentationCue | null;
  draftSelections?: number[];
  onToggleSelection?: (index: number) => void;
  onPreviewChest?: (index: number | null) => void;
  frame?: 'standalone' | 'embedded';
}) {
  const turn = scene.focusTurn;
  const board = turn?.board ?? null;
  const interactive = Boolean(
    onToggleSelection
    && board
    && turn?.status === 'active'
    && !board.allSelectionsLocked
    && board.revealedChests.length === 0,
  );
  const selectedIndices = new Set(interactive ? (draftSelections ?? []) : board?.selectedChests ?? []);
  const [animatedRevision, setAnimatedRevision] = useState(0);
  const lastAnimatedRef = useRef(board?.boardRevision ?? 0);
  const lastTurnIdRef = useRef(turn?.id ?? 0);

  useEffect(() => {
    const nextTurnId = turn?.id ?? 0;
    const nextRevision = board?.boardRevision ?? 0;
    const shouldAnimate = nextRevision > 0
      && (nextRevision > lastAnimatedRef.current || nextTurnId !== lastTurnIdRef.current);

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
  const animateResult = Boolean(turn?.resolutionCue && board && animatedRevision === board.boardRevision);
  const hoveredChestIndex = presentationCue?.kind === 'hover' && presentationCue.turnId === turn?.id
    ? presentationCue.chestIndex ?? null
    : null;
  const cuedRevealChestIndex = presentationCue?.kind === 'reveal' && presentationCue.turnId === turn?.id
    ? presentationCue.chestIndex ?? null
    : null;
  const cuedResult = presentationCue?.kind === 'result' && presentationCue.turnId === turn?.id
    ? presentationCue.result ?? null
    : null;

  return (
    <section className={[styles.scene, frame === 'embedded' ? styles.sceneEmbedded : ''].filter(Boolean).join(' ')}>
      <header className={styles.sceneHeader}>
        <div className={styles.titleStack}>
          <p className={styles.kicker}>Ghosted loot chest</p>
          <h2 className={styles.headline}>{sceneHeadline(turn, scene.queueCount)}</h2>
          <p className={styles.summary}>{sceneSummary(turn, scene.queueCount, scene.reward.title)}</p>
        </div>

        <div className={styles.sceneMeta}>
          <span className={styles.sceneMetaItem}>
            <strong>{scene.reward.title}</strong>
            <small>{scene.reward.cost.toLocaleString()} pts</small>
          </span>
          <span className={styles.sceneMetaItem}>
            <strong>{scene.queueCount}</strong>
            <small>{scene.queueCount === 1 ? 'viewer waiting' : 'viewers waiting'}</small>
          </span>
        </div>
      </header>

      <div className={styles.boardShell}>
        {board ? (
          <>
            <div className={styles.boardGrid}>
              {board.chests.map((chest) => {
                const spriteState = displaySpriteState(chest, board.selectionLimit, selectedIndices, interactive);
                const animationState = displayAnimationState(chest, spriteState);
                const animateReveal = Boolean(
                  (
                    changedChestIndex === chest.index
                    && board.boardRevision === animatedRevision
                    && chest.revealCue
                  )
                  || cuedRevealChestIndex === chest.index,
                );
                const hovered = hoveredChestIndex === chest.index;
                const chestClassName = [
                  styles.chest,
                  interactive ? styles.chestInteractive : '',
                  hovered ? styles.chestHovered : '',
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
                    onPointerEnter={() => onPreviewChest?.(chest.index)}
                    onPointerLeave={() => onPreviewChest?.(null)}
                    onFocus={() => onPreviewChest?.(chest.index)}
                    onBlur={() => onPreviewChest?.(null)}
                    data-chest-index={chest.index}
                    data-sprite-state={spriteState}
                    data-animation-state={animationState}
                    data-hovered={hovered ? 'true' : 'false'}
                    data-reveal-cue={chest.revealCue ? 'true' : 'false'}
                    data-active-animation={animateReveal ? 'true' : 'false'}
                  >
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

            {(turn?.resolutionCue || cuedResult) && resultAsset(cuedResult ?? turn?.resolutionCue?.result) ? (
              <div
                className={`${styles.resultStamp} ${(animateResult || Boolean(cuedResult)) ? styles.resultStampAnimated : ''}`}
                style={{ ['--result-asset' as string]: `url("${resultAsset(cuedResult ?? turn?.resolutionCue?.result)}")` }}
                data-result-cue={(animateResult || Boolean(cuedResult)) ? 'true' : 'false'}
                aria-hidden="true"
              />
            ) : null}
          </>
        ) : (
          <div className={styles.emptyState}>
            <strong>No active board</strong>
            <p>The next redemption will appear here when the host starts a turn.</p>
          </div>
        )}
      </div>

      <footer className={styles.sceneFooter}>
        <div className={styles.footerPrimary}>
          <span className={styles.footerLabel}>Live step</span>
          <strong className={styles.footerValue}>{phaseLabel(turn?.phase, scene.queueCount)}</strong>
        </div>
        <p className={styles.footerNote}>{footerNote(turn, selectedIndices.size, scene.queueCount)}</p>
        <span className={styles.footerTimestamp}>
          {turn?.lastActionAt
            ? new Date(turn.lastActionAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'Waiting'}
        </span>
      </footer>
    </section>
  );
}
