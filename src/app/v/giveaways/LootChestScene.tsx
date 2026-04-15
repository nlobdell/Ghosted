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
import { SceneSprite } from './SceneSprite';
import {
  getBoardBackdropSpriteSpec,
  getBoardFrameSpriteSpec,
  getChestSpriteSpec,
  getResultSpriteSpec,
} from './scene-sprite-catalog';
import styles from './loot-chest-scene.module.css';

const REVEAL_ANIMATION_MS = 1400;

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

function selectionRowPosition(board: NonNullable<LootChestTurn['board']>, chestIndex: number) {
  const slot = board.selectedChests.indexOf(chestIndex);
  if (slot === -1) {
    return null;
  }

  const currentColumn = chestIndex % 5;
  const currentRow = Math.floor(chestIndex / 5);
  const targetColumn = slot + 1;
  const targetRow = 0.5;

  return {
    slot,
    columnShift: targetColumn - currentColumn,
    rowShift: targetRow - currentRow,
  };
}

export function LootChestScene({
  scene,
  presentationCue,
  draftSelections,
  onToggleSelection,
  onRevealChest,
  onPreviewChest,
  frame = 'standalone',
}: {
  scene: LootChestSceneSnapshot;
  presentationCue?: LootChestPresentationCue | null;
  draftSelections?: number[];
  onToggleSelection?: (index: number) => void;
  onRevealChest?: (index: number) => void;
  onPreviewChest?: (index: number | null) => void;
  frame?: 'standalone' | 'embedded' | 'broadcast' | 'board-only';
}) {
  const turn = scene.focusTurn;
  const board = turn?.board ?? null;
  const selectionInteractive = Boolean(
    onToggleSelection
    && board
    && turn?.status === 'active'
    && !board.allSelectionsLocked
    && board.revealedChests.length === 0,
  );
  const revealInteractive = Boolean(
    onRevealChest
    && board
    && turn?.status === 'active'
    && board.allSelectionsLocked
    && board.remainingReveals > 0,
  );
  const selectedIndices = new Set(selectionInteractive ? (draftSelections ?? []) : board?.selectedChests ?? []);
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
  const selectionRowActive = Boolean(
    board
    && board.allSelectionsLocked
    && board.selectedChests.length === board.selectionLimit,
  );
  const boardOnly = frame === 'board-only';

  return (
    <section
      className={[
        styles.scene,
        frame === 'embedded' ? styles.sceneEmbedded : '',
        frame === 'broadcast' ? styles.sceneBroadcast : '',
        boardOnly ? styles.sceneBoardOnly : '',
      ].filter(Boolean).join(' ')}
    >
      {boardOnly ? null : (
        <header className={styles.sceneHeader}>
          <div className={styles.titleStack}>
            <p className={styles.kicker}>Ghosted loot chest</p>
            <h2 className={styles.headline}>{sceneHeadline(turn, scene.queueCount)}</h2>
          </div>

          <div className={styles.sceneMeta}>
            <span className={styles.sceneMetaItem}>
              <small>Reward</small>
              <strong>{scene.reward.title}</strong>
              <em>{scene.reward.cost.toLocaleString()} pts</em>
            </span>
            <span className={styles.sceneMetaItem}>
              <small>Queue</small>
              <strong>{scene.queueCount}</strong>
              <em>{scene.queueCount === 1 ? 'viewer waiting' : 'viewers waiting'}</em>
            </span>
          </div>
        </header>
      )}

      <div className={styles.boardShell}>
        {boardOnly ? null : <SceneSprite spec={getBoardBackdropSpriteSpec()} className={styles.boardBackdrop} />}
        <SceneSprite spec={getBoardFrameSpriteSpec(boardOnly ? 'overlay' : 'default')} className={styles.boardFrame} />
        <div className={styles.boardContent}>
        {board ? (
          <>
            <div className={[styles.boardGrid, selectionRowActive ? styles.boardGridSelectionStage : ''].filter(Boolean).join(' ')}>
              {board.chests.map((chest) => {
                const spriteState = displaySpriteState(chest, board.selectionLimit, selectedIndices, selectionInteractive);
                const animationState = displayAnimationState(chest, spriteState);
                const spriteSpec = getChestSpriteSpec(spriteState, animationState, {
                  winner: chest.containsPrize || spriteState === 'prize' || spriteState === 'resolved-prize',
                });
                const selectionRow = selectionRowActive ? selectionRowPosition(board, chest.index) : null;
                const dormant = selectionRowActive && selectionRow === null;
                const revealable = Boolean(
                  revealInteractive
                  && chest.selected
                  && !chest.revealed,
                );
                const clickable = selectionInteractive || revealable;
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
                  clickable ? styles.chestInteractive : '',
                  selectionRowActive ? styles.chestSelectionStage : '',
                  selectionRow ? styles.chestSelectedRow : '',
                  dormant ? styles.chestDormant : '',
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
                    style={{
                      ['--selection-column-shift' as string]: selectionRow ? String(selectionRow.columnShift) : '0',
                      ['--selection-row-shift' as string]: selectionRow ? String(selectionRow.rowShift) : '0',
                    }}
                    disabled={!clickable}
                    onClick={() => {
                      if (selectionInteractive) {
                        onToggleSelection?.(chest.index);
                        return;
                      }

                      if (revealable) {
                        onRevealChest?.(chest.index);
                      }
                    }}
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
                    data-selection-stage={selectionRowActive ? 'true' : 'false'}
                    data-selection-slot={selectionRow ? String(selectionRow.slot) : ''}
                    data-dormant={dormant ? 'true' : 'false'}
                    data-clickable={clickable ? 'true' : 'false'}
                  >
                    <SceneSprite spec={spriteSpec} className={styles.chestSprite} />
                    <span className={styles.chestNumber}>{chest.label}</span>
                    <span className={styles.chestWord}>{chestLabel(chest, spriteState)}</span>
                  </button>
                );
              })}
            </div>

            {(turn?.resolutionCue || cuedResult) && getResultSpriteSpec(cuedResult ?? turn?.resolutionCue?.result) ? (
              <SceneSprite
                spec={getResultSpriteSpec(cuedResult ?? turn?.resolutionCue?.result)!}
                className={`${styles.resultStamp} ${(animateResult || Boolean(cuedResult)) ? styles.resultStampAnimated : ''}`}
                data-result-cue={(animateResult || Boolean(cuedResult)) ? 'true' : 'false'}
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
      </div>

      {boardOnly ? null : (
        <footer className={styles.sceneFooter}>
          <div className={styles.footerPrimary}>
            <span className={styles.footerLabel}>Live step</span>
            <strong className={styles.footerValue}>{phaseLabel(turn?.phase, scene.queueCount)}</strong>
          </div>
          <p className={styles.footerNote}>{sceneSummary(turn, scene.queueCount, scene.reward.title)}</p>
          <p className={styles.footerDetail}>{footerNote(turn, selectedIndices.size, scene.queueCount)}</p>
          <span className={styles.footerTimestamp}>
            {turn?.lastActionAt
              ? new Date(turn.lastActionAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              : 'Waiting'}
          </span>
        </footer>
      )}
    </section>
  );
}
