'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
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
  getSceneSpriteVisibleRegion,
} from './scene-sprite-catalog';
import styles from './loot-chest-scene.module.css';

const REVEAL_ANIMATION_MS = 1400;
const CHEST_OPENING_LATCH_MS = 820;
const CHEST_SPRITE_BOX_WIDTH_PCT = 82;
const CHEST_SPRITE_BOX_HEIGHT_PCT = CHEST_SPRITE_BOX_WIDTH_PCT * (32 / 48);
const CHEST_SPRITE_BOX_TOP_PCT = 50 - ((56 * CHEST_SPRITE_BOX_HEIGHT_PCT) / 100);

type ActiveChestRevealAnimation = {
  cycle: number;
  winner: boolean;
};

type RevealAnimationState = {
  turnId: number;
  animations: Record<number, ActiveChestRevealAnimation>;
};

type RevealAnimationAction =
  | {
    type: 'queue';
    turnId: number;
    chestIndex: number;
    winner: boolean;
  }
  | {
    type: 'clear';
    chestIndex: number;
  }
  | {
    type: 'reset';
  };

function revealAnimationReducer(
  state: RevealAnimationState,
  action: RevealAnimationAction,
): RevealAnimationState {
  if (action.type === 'reset') {
    if (state.turnId === 0 && Object.keys(state.animations).length === 0) {
      return state;
    }

    return {
      turnId: 0,
      animations: {},
    };
  }

  if (action.type === 'clear') {
    if (!state.animations[action.chestIndex]) {
      return state;
    }

    const nextAnimations = { ...state.animations };
    delete nextAnimations[action.chestIndex];
    return {
      ...state,
      animations: nextAnimations,
    };
  }

  const currentAnimations = state.turnId === action.turnId ? state.animations : {};
  const existing = currentAnimations[action.chestIndex];
  const nextCycle = existing?.cycle ?? (Math.max(0, ...Object.values(currentAnimations).map((entry) => entry.cycle)) + 1);

  return {
    turnId: action.turnId,
    animations: {
      ...currentAnimations,
      [action.chestIndex]: {
        cycle: nextCycle,
        winner: Boolean(existing?.winner || action.winner),
      },
    },
  };
}

function chestHitAreaStyle(spriteState: LootChestChestSpriteState, spriteSpec: ReturnType<typeof getChestSpriteSpec>) {
  const visibleRegion = getSceneSpriteVisibleRegion(spriteSpec);
  if (!visibleRegion) {
    return undefined;
  }

  const hitLeftPct = 50
    - (CHEST_SPRITE_BOX_WIDTH_PCT / 2)
    + ((visibleRegion.anchorShiftPct * CHEST_SPRITE_BOX_WIDTH_PCT) / 100)
    + ((visibleRegion.leftPct * CHEST_SPRITE_BOX_WIDTH_PCT) / 100);
  const hitTopPct = CHEST_SPRITE_BOX_TOP_PCT
    + ((visibleRegion.topPct * CHEST_SPRITE_BOX_HEIGHT_PCT) / 100);
  const hitWidthPct = (visibleRegion.widthPct * CHEST_SPRITE_BOX_WIDTH_PCT) / 100;
  const hitHeightPct = (visibleRegion.heightPct * CHEST_SPRITE_BOX_HEIGHT_PCT) / 100;
  const liftPx = (
    spriteState === 'selected'
    || spriteState === 'locked'
  ) ? -2 : 0;

  return {
    ['--chest-hit-left' as string]: `${hitLeftPct}%`,
    ['--chest-hit-top' as string]: `${hitTopPct}%`,
    ['--chest-hit-width' as string]: `${hitWidthPct}%`,
    ['--chest-hit-height' as string]: `${hitHeightPct}%`,
    ['--chest-hit-lift' as string]: `${liftPx}px`,
  } as CSSProperties;
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

export interface LootChestSceneDebugOverlay {
  layoutMode: 'wide' | 'compact';
  sceneScale: number;
  stageWidth: number | null;
  stageHeight: number | null;
}

function chestDebugLabel(spriteState: LootChestChestSpriteState) {
  if (spriteState === 'prize' || spriteState === 'resolved-prize') return 'Prize';
  if (spriteState === 'empty' || spriteState === 'resolved-empty') return 'Empty';
  if (spriteState === 'locked') return 'Locked';
  if (spriteState === 'selected') return 'Marked';
  if (spriteState === 'opening') return 'Opening';
  return 'Closed';
}

function cueLabel(cue: LootChestPresentationCue | null | undefined, turnId: number | null) {
  if (!cue || cue.turnId !== turnId) {
    return 'None';
  }

  if (cue.kind === 'hover') {
    return cue.chestIndex !== undefined && cue.chestIndex !== null ? `Hover #${cue.chestIndex + 1}` : 'Hover';
  }

  if (cue.kind === 'clear') {
    return 'Clear';
  }

  if (cue.kind === 'reveal') {
    return cue.chestIndex !== undefined && cue.chestIndex !== null ? `Reveal #${cue.chestIndex + 1}` : 'Reveal';
  }

  if (cue.kind === 'result') {
    return cue.result ? `Result ${cue.result}` : 'Result';
  }

  if (cue.kind === 'selection') {
    return cue.selectedChests?.length ? `Selection ${cue.selectedChests.map((entry) => entry + 1).join(', ')}` : 'Selection';
  }

  return cue.kind;
}

function formatDebugStageSize(width: number | null, height: number | null) {
  if (!width || !height) {
    return 'Pending';
  }

  return `${Math.round(width)}x${Math.round(height)}`;
}

function chestDebugFlags({
  chest,
  hovered,
  clickable,
  dormant,
  animateReveal,
  selectionRow,
}: {
  chest: LootChestBoardChest;
  hovered: boolean;
  clickable: boolean;
  dormant: boolean;
  animateReveal: boolean;
  selectionRow: ReturnType<typeof selectionRowPosition>;
}) {
  const flags: string[] = [];
  if (chest.selected) flags.push('sel');
  if (chest.revealed) flags.push('open');
  if (chest.containsPrize) flags.push('prize');
  if (hovered) flags.push('hover');
  if (animateReveal) flags.push('cue');
  if (selectionRow) flags.push(`slot${selectionRow.slot + 1}`);
  if (dormant) flags.push('dim');
  if (clickable) flags.push('live');
  return flags.length > 0 ? flags.join(' · ') : 'idle';
}

function displaySpriteState(
  chest: LootChestBoardChest,
  selectedIndices: Set<number>,
  previewSelections: boolean,
): LootChestChestSpriteState {
  if (!previewSelections) {
    return chest.spriteState;
  }
  if (previewSelections && selectedIndices.has(chest.index) && !chest.revealed) {
    return 'selected';
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
  boardSizing = 'viewport',
  assetVersion,
  debugOverlay,
  boardAction,
}: {
  scene: LootChestSceneSnapshot;
  presentationCue?: LootChestPresentationCue | null;
  draftSelections?: number[];
  onToggleSelection?: (index: number) => void;
  onRevealChest?: (index: number) => void;
  onPreviewChest?: (index: number | null) => void;
  frame?: 'standalone' | 'embedded' | 'broadcast' | 'board-only';
  boardSizing?: 'viewport' | 'width';
  assetVersion?: string;
  debugOverlay?: LootChestSceneDebugOverlay | null;
  boardAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  } | null;
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
  const previewSelections = Boolean(board && !board.allSelectionsLocked && (draftSelections?.length ?? 0) > 0);
  const selectedIndices = new Set(
    board?.allSelectionsLocked
      ? (board?.selectedChests ?? [])
      : (draftSelections ?? []),
  );
  const [revealAnimationState, dispatchRevealAnimation] = useReducer(revealAnimationReducer, {
    turnId: turn?.id ?? 0,
    animations: {},
  });
  const [animatedRevision, setAnimatedRevision] = useState(0);
  const lastAnimatedRef = useRef(board?.boardRevision ?? 0);
  const lastTurnIdRef = useRef(turn?.id ?? 0);
  const revealTimeoutsRef = useRef(new Map<number, number>());
  const processedRevealTokensRef = useRef(new Set<string>());

  useEffect(() => () => {
    revealTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    revealTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    processedRevealTokensRef.current.clear();
    revealTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    revealTimeoutsRef.current.clear();
    dispatchRevealAnimation({ type: 'reset' });
  }, [turn?.id]);

  const queueRevealAnimation = useCallback((chestIndex: number, winner: boolean) => {
    const currentTurnId = turn?.id ?? 0;
    const existingTimeout = revealTimeoutsRef.current.get(chestIndex);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    dispatchRevealAnimation({
      type: 'queue',
      turnId: currentTurnId,
      chestIndex,
      winner,
    });

    const timeoutId = window.setTimeout(() => {
      revealTimeoutsRef.current.delete(chestIndex);
      dispatchRevealAnimation({
        type: 'clear',
        chestIndex,
      });
    }, CHEST_OPENING_LATCH_MS);

    revealTimeoutsRef.current.set(chestIndex, timeoutId);
  }, [turn?.id]);

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

  useEffect(() => {
    if (!board || !turn?.id || board.lastAction !== 'chest_revealed') {
      return;
    }

    const chestIndex = board.activeAnimationChestIndex ?? board.lastChangedChestIndex ?? null;
    if (chestIndex === null || chestIndex === undefined) {
      return;
    }

    const token = `board:${turn.id}:${board.boardRevision}:${chestIndex}`;
    if (processedRevealTokensRef.current.has(token)) {
      return;
    }

    const revealChest = board.chests.find((entry) => entry.index === chestIndex);
    if (!revealChest) {
      return;
    }

    processedRevealTokensRef.current.add(token);
    queueRevealAnimation(
      chestIndex,
      revealChest.containsPrize || revealChest.spriteState === 'prize' || revealChest.spriteState === 'resolved-prize',
    );
  }, [
    board,
    queueRevealAnimation,
    turn?.id,
  ]);

  useEffect(() => {
    if (!presentationCue || presentationCue.kind !== 'reveal' || presentationCue.turnId !== turn?.id) {
      return;
    }

    const chestIndex = presentationCue.chestIndex;
    if (chestIndex === null || chestIndex === undefined) {
      return;
    }

    const token = `cue:${presentationCue.turnId}:${presentationCue.sentAt ?? ''}:${chestIndex}`;
    if (processedRevealTokensRef.current.has(token)) {
      return;
    }

    const revealChest = board?.chests.find((entry) => entry.index === chestIndex);
    processedRevealTokensRef.current.add(token);
    queueRevealAnimation(
      chestIndex,
      Boolean(
        revealChest?.containsPrize
        || revealChest?.spriteState === 'prize'
        || revealChest?.spriteState === 'resolved-prize',
      ),
    );
  }, [board?.chests, presentationCue, queueRevealAnimation, turn?.id]);

  const animateResult = Boolean(turn?.resolutionCue && board && animatedRevision === board.boardRevision);
  const hoveredChestIndex = presentationCue?.kind === 'hover' && presentationCue.turnId === turn?.id
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
  const debugChestEntries = board ? board.chests.map((chest) => {
    const spriteState = displaySpriteState(chest, selectedIndices, previewSelections);
    const animationState = displayAnimationState(chest, spriteState);
    const activeRevealAnimation = revealAnimationState.turnId === (turn?.id ?? 0)
      ? (revealAnimationState.animations[chest.index] ?? null)
      : null;
    const selectionRow = selectionRowActive ? selectionRowPosition(board, chest.index) : null;
    const dormant = selectionRowActive && selectionRow === null;
    const revealable = Boolean(
      revealInteractive
      && chest.selected
      && !chest.revealed,
    );
    const clickable = selectionInteractive || revealable;
    const animateReveal = Boolean(activeRevealAnimation);
    const renderSpriteState = animateReveal ? 'opening' : spriteState;
    const renderAnimationState = animateReveal ? 'opening' : animationState;
    const hovered = hoveredChestIndex === chest.index;

    return {
      chest,
      activeRevealAnimation,
      spriteState,
      animationState,
      selectionRow,
      dormant,
      revealable,
      clickable,
      animateReveal,
      renderSpriteState,
      renderAnimationState,
      hovered,
      debugState: chestDebugLabel(renderSpriteState),
      debugFlags: chestDebugFlags({
        chest,
        hovered,
        clickable,
        dormant,
        animateReveal,
        selectionRow,
      }),
    };
  }) : [];
  const debugCue = cueLabel(presentationCue, turn?.id ?? null);

  return (
    <section
      className={[
        styles.scene,
        frame === 'embedded' ? styles.sceneEmbedded : '',
        frame === 'broadcast' ? styles.sceneBroadcast : '',
        boardOnly ? styles.sceneBoardOnly : '',
        boardOnly && boardSizing === 'width' ? styles.sceneBoardOnlyWidth : '',
        boardOnly && boardSizing === 'viewport' ? styles.sceneBoardOnlyViewport : '',
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
        {boardOnly ? null : <SceneSprite spec={getBoardBackdropSpriteSpec(assetVersion)} className={styles.boardBackdrop} />}
        <SceneSprite
          spec={getBoardFrameSpriteSpec(boardOnly ? 'overlay' : 'default', assetVersion)}
          className={styles.boardFrame}
        />
        <div className={styles.boardContent}>
        {board ? (
          <>
            <div className={[styles.boardGrid, selectionRowActive ? styles.boardGridSelectionStage : ''].filter(Boolean).join(' ')}>
              {debugChestEntries.map((entry) => {
                const {
                  chest,
                  activeRevealAnimation,
                  spriteState,
                  animationState,
                  selectionRow,
                  dormant,
                  revealable,
                  clickable,
                  animateReveal,
                  renderSpriteState,
                  renderAnimationState,
                  hovered,
                } = entry;
                const spriteSpec = getChestSpriteSpec(renderSpriteState, renderAnimationState, {
                  winner: (
                    activeRevealAnimation?.winner
                    ?? chest.containsPrize
                  ) || spriteState === 'prize' || spriteState === 'resolved-prize',
                  assetVersion,
                });
                const spriteRenderKey = activeRevealAnimation
                  ? `${chest.index}:opening:${activeRevealAnimation.cycle}`
                  : `${chest.index}:${renderSpriteState}:${renderAnimationState}`;
                const hitAreaStyle = chestHitAreaStyle(renderSpriteState, spriteSpec);
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
                  <div
                    key={chest.index}
                    className={chestClassName}
                    data-chest-shell-index={chest.index}
                    style={{
                      ['--selection-column-shift' as string]: selectionRow ? String(selectionRow.columnShift) : '0',
                      ['--selection-row-shift' as string]: selectionRow ? String(selectionRow.rowShift) : '0',
                    }}
                  >
                    <span className={styles.chestVisual}>
                      <SceneSprite key={spriteRenderKey} spec={spriteSpec} className={styles.chestSprite} />
                      <button
                        type="button"
                        className={styles.chestHitArea}
                        style={hitAreaStyle}
                        disabled={!clickable}
                        aria-label={`Chest ${chest.label}`}
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
                      />
                    </span>
                    <span className={styles.chestLabelStack}>
                      <span className={styles.chestNumber}>{chest.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {(turn?.resolutionCue || cuedResult) && getResultSpriteSpec(cuedResult ?? turn?.resolutionCue?.result, assetVersion) ? (
              <SceneSprite
                spec={getResultSpriteSpec(cuedResult ?? turn?.resolutionCue?.result, assetVersion)!}
                className={`${styles.resultStamp} ${(animateResult || Boolean(cuedResult)) ? styles.resultStampAnimated : ''}`}
                data-result-cue={(animateResult || Boolean(cuedResult)) ? 'true' : 'false'}
              />
            ) : null}

            {boardAction ? (
              <div className={styles.boardActionDock}>
                <button
                  type="button"
                  className={styles.boardActionButton}
                  onClick={boardAction.onClick}
                  disabled={boardAction.disabled}
                >
                  {boardAction.label}
                </button>
              </div>
            ) : null}

            {debugOverlay ? (
              <div className={styles.debugOverlay} data-debug-overlay="true">
                <div className={styles.debugHeader}>
                  <strong>Scene debug</strong>
                  <span>{debugOverlay.layoutMode} | {debugOverlay.sceneScale.toFixed(2)}x</span>
                </div>

                <div className={styles.debugGrid}>
                  <section className={styles.debugBlock}>
                    <p className={styles.debugSectionTitle}>Board</p>
                    <div className={styles.debugStats}>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Turn</span>
                        <span className={styles.debugValue}>{turn?.id ?? '--'}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Phase</span>
                        <span className={styles.debugValue}>{turn?.phase ?? 'idle'}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Scene rev</span>
                        <span className={styles.debugValue}>{scene.revision}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Board rev</span>
                        <span className={styles.debugValue}>{board.boardRevision}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Stage</span>
                        <span className={styles.debugValue}>{formatDebugStageSize(debugOverlay.stageWidth, debugOverlay.stageHeight)}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Cue</span>
                        <span className={styles.debugValue}>{debugCue}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Selected</span>
                        <span className={styles.debugValue}>{selectedIndices.size}/{board.selectionLimit}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Revealed</span>
                        <span className={styles.debugValue}>{board.revealedChests.length}/{board.selectionLimit}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Changed</span>
                        <span className={styles.debugValue}>{board.lastChangedChestIndex !== null && board.lastChangedChestIndex !== undefined ? `#${board.lastChangedChestIndex + 1}` : 'None'}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Anim chest</span>
                        <span className={styles.debugValue}>{board.activeAnimationChestIndex !== null && board.activeAnimationChestIndex !== undefined ? `#${board.activeAnimationChestIndex + 1}` : 'None'}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Queue</span>
                        <span className={styles.debugValue}>{scene.queueCount}</span>
                      </span>
                      <span className={styles.debugStat}>
                        <span className={styles.debugLabel}>Action</span>
                        <span className={styles.debugValue}>{board.lastAction ?? turn?.lastAction ?? 'idle'}</span>
                      </span>
                    </div>
                  </section>

                  <section className={styles.debugBlock}>
                    <p className={styles.debugSectionTitle}>Chests</p>
                    <div className={styles.debugChestList}>
                      {debugChestEntries.map((entry) => (
                        <div
                          key={entry.chest.index}
                          className={styles.debugChestRow}
                          data-debug-chest-index={entry.chest.index}
                        >
                          <span className={styles.debugChestIndex}>#{entry.chest.label}</span>
                          <span className={styles.debugChestState}>{entry.debugState}</span>
                          <span className={styles.debugChestMeta}>{entry.renderAnimationState} | {entry.debugFlags}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
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
