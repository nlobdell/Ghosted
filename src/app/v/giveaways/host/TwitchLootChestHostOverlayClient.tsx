'use client';

import Link from 'next/link';
import { startTransition, useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatDate, getJSON } from '@/lib/api';
import type {
  LootChestGameState,
  LootChestPresentationCue,
  LootChestSceneSnapshot,
  LootChestTurn,
} from '@/lib/types';
import { LootChestScene } from '../LootChestScene';
import { useGiveawayBuildSync } from '../useGiveawayBuildSync';
import { useLootChestSceneTransport } from '../useLootChestSceneTransport';
import styles from './page.module.css';

const HOST_STATE_POLL_MS = 2500;
const PRESENTATION_THROTTLE_MS = 90;

type HostMessage = {
  text: string;
  tone: 'info' | 'error';
} | null;

type TurnActionResponse = {
  ok: boolean;
  result: LootChestTurn;
  scene: LootChestSceneSnapshot;
};

function hostCaption(state: LootChestGameState) {
  if (state.activeTurn) {
    return `${state.activeTurn.viewer.displayName} is live. ${boardStatus(state)}.`;
  }

  if (state.queue.length > 0) {
    return `${state.queue.length} queued redemption${state.queue.length === 1 ? '' : 's'} waiting for the next start.`;
  }

  return 'Keep this open on a second screen for the fastest control path.';
}

function boardStatus(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    return state.queue.length > 0 ? 'Queue waiting' : 'No active turn';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Selection open';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return `${activeTurn.board.remainingReveals} reveal${activeTurn.board.remainingReveals === 1 ? '' : 's'} left`;
  }

  return activeTurn.result === 'win' ? 'Prize found' : 'Resolve and complete';
}

function controlHint(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    return state.queue[0] ? 'Enter starts the next queued turn.' : 'Waiting for new redemptions.';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Keys 1-0 toggle picks. Enter locks three selections.';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return 'Click a locked chest or press Space to reveal.';
  }

  return 'Press C or use Complete to fulfill Twitch.';
}

function actionLabel(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    const nextTurn = state.queue[0];
    return nextTurn ? `Start ${nextTurn.viewer.displayName}` : 'Waiting';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Lock selections';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return 'Reveal next';
  }

  return 'Complete turn';
}

function recentResultLabel(turn: LootChestTurn) {
  return turn.result === 'win' ? 'Prize found' : 'Prize missed';
}

export default function TwitchLootChestHostOverlayClient({
  initialState,
  buildId,
}: {
  initialState: LootChestGameState;
  buildId: string;
}) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<HostMessage>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draftSelections, setDraftSelections] = useState<number[]>(initialState.activeTurn?.board?.selectedChests ?? []);
  const [presentationCue, setPresentationCue] = useState<LootChestPresentationCue | null>(null);
  const pollInFlightRef = useRef(false);
  const presentationThrottleRef = useRef<{
    lastSentAt: number;
    lastSentKey: string | null;
    queued: { turnId: number; chestIndex: number | null } | null;
    timeoutId: number;
  }>({
    lastSentAt: 0,
    lastSentKey: null,
    queued: null,
    timeoutId: 0,
  });

  const activeTurn = state.activeTurn;
  const activeBoard = activeTurn?.board ?? null;
  const nextQueuedTurn = state.queue[0] ?? null;
  const activeTurnId = activeTurn?.id ?? null;
  const selectedChestKey = activeBoard?.selectedChests.join(',') ?? '';
  const revealedChestKey = activeBoard?.revealedChests.join(',') ?? '';
  const draftSelectionKey = draftSelections.join(',');
  const overlayToken = state.connection.overlayToken ?? null;
  const revealBusy = Boolean(busyAction?.startsWith('reveal'));
  const showInlineLockAction = Boolean(
    activeBoard
    && !activeBoard.allSelectionsLocked
    && draftSelections.length === activeBoard.selectionLimit,
  );
  const selectionStageActive = Boolean(
    activeTurnId
    && activeBoard
    && !activeBoard.allSelectionsLocked
    && activeBoard.revealedChests.length === 0,
  );
  useGiveawayBuildSync(buildId);

  useEffect(() => {
    setDraftSelections(
      selectedChestKey
        ? selectedChestKey.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))
        : [],
    );
  }, [activeTurnId, selectedChestKey, revealedChestKey]);

  useEffect(() => {
    presentationThrottleRef.current.lastSentAt = 0;
    presentationThrottleRef.current.lastSentKey = null;
    presentationThrottleRef.current.queued = null;
    if (presentationThrottleRef.current.timeoutId > 0) {
      window.clearTimeout(presentationThrottleRef.current.timeoutId);
      presentationThrottleRef.current.timeoutId = 0;
    }
    setPresentationCue(null);
  }, [activeTurnId, revealedChestKey]);

  useEffect(() => {
    const throttleState = presentationThrottleRef.current;
    return () => {
      if (throttleState.timeoutId > 0) {
        window.clearTimeout(throttleState.timeoutId);
      }
    };
  }, []);

  function cueKey(input: { turnId: number; chestIndex: number | null; selectedChests?: number[] | null }) {
    return `${input.turnId}:${input.chestIndex ?? 'clear'}:${(input.selectedChests ?? []).join(',')}`;
  }

  function makeOptimisticCue(input: { turnId: number; chestIndex: number | null; selectedChests?: number[] | null }): LootChestPresentationCue {
    const sentAt = new Date().toISOString();
    if (input.chestIndex === null) {
      return {
        kind: 'clear',
        turnId: input.turnId,
        selectedChests: input.selectedChests ?? null,
        sentAt,
      };
    }

    return {
      kind: 'hover',
      turnId: input.turnId,
      chestIndex: input.chestIndex,
      selectedChests: input.selectedChests ?? null,
      sentAt,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    };
  }

  function applyLoadedState(nextState: LootChestGameState) {
    startTransition(() => {
      setState(nextState);
    });
  }

  async function loadState(quiet = false) {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const nextState = await getJSON<LootChestGameState>('/api/v/giveaways/state');
      applyLoadedState(nextState);
      if (!quiet) {
        setMessage(null);
      }
    } catch (caught) {
      if (!quiet) {
        setMessage({
          text: caught instanceof Error ? caught.message : 'Unable to refresh the host surface.',
          tone: 'error',
        });
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }

  const refreshState = useEffectEvent((quiet = true) => {
    void loadState(quiet);
  });

  async function publishPresentationCue(input: { turnId: number; chestIndex: number | null; selectedChests?: number[] | null }) {
    const optimisticCue = makeOptimisticCue(input);
    syncCue(optimisticCue);

    try {
      const response = await getJSON<{ cue: LootChestPresentationCue }>('/api/v/giveaways/presentation', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      syncCue(response.cue);
    } catch {
      // Hover sync is best-effort. Keep the host surface responsive even if the sidecar is unavailable.
    }
  }

  function flushQueuedPresentationCue() {
    const queued = presentationThrottleRef.current.queued;
    presentationThrottleRef.current.queued = null;
    presentationThrottleRef.current.timeoutId = 0;
    if (!queued) {
      return;
    }

    presentationThrottleRef.current.lastSentAt = Date.now();
    presentationThrottleRef.current.lastSentKey = cueKey(queued);
    void publishPresentationCue(queued);
  }

  function queuePresentationCue(input: { turnId: number; chestIndex: number | null; selectedChests?: number[] | null }) {
    const nextKey = cueKey(input);
    if (presentationThrottleRef.current.lastSentKey === nextKey) {
      syncCue(makeOptimisticCue(input));
      return;
    }

    const elapsedMs = Date.now() - presentationThrottleRef.current.lastSentAt;
    if (elapsedMs >= PRESENTATION_THROTTLE_MS) {
      presentationThrottleRef.current.lastSentAt = Date.now();
      presentationThrottleRef.current.lastSentKey = nextKey;
      void publishPresentationCue(input);
      return;
    }

    presentationThrottleRef.current.queued = input;
    syncCue(makeOptimisticCue(input));
    if (presentationThrottleRef.current.timeoutId > 0) {
      return;
    }

    presentationThrottleRef.current.timeoutId = window.setTimeout(() => {
      flushQueuedPresentationCue();
    }, PRESENTATION_THROTTLE_MS - elapsedMs);
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshState(true);
    }, HOST_STATE_POLL_MS);

    const handleFocus = () => {
      refreshState(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshState(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!selectionStageActive || !activeTurnId) {
      return;
    }

    void getJSON<{ cue: LootChestPresentationCue }>('/api/v/giveaways/presentation', {
      method: 'POST',
      body: JSON.stringify({
        turnId: activeTurnId,
        selectedChests: draftSelections,
      }),
    }).catch(() => {
      // Mirroring draft picks to the public overlay is best-effort.
    });
  }, [activeTurnId, draftSelectionKey, selectionStageActive]);

  const { syncCue, dismissCue } = useLootChestSceneTransport({
    overlayToken,
    currentScene: state.scene,
    currentCue: presentationCue,
    fetchState: () => getJSON<LootChestGameState>('/api/v/giveaways/state'),
    applyState: (nextState) => {
      applyLoadedState(nextState);
    },
    applyScene: (nextScene) => {
      startTransition(() => {
        setState((current) => ({ ...current, scene: nextScene }));
      });
    },
    applyCue: (nextCue) => {
      startTransition(() => {
        if (!nextCue || nextCue.kind === 'clear' || nextCue.kind === 'selection') {
          setPresentationCue(null);
          return;
        }

        setPresentationCue(nextCue);
      });
    },
  });

  async function runAction(
    actionKey: string,
    action: () => Promise<TurnActionResponse>,
    successText?: string,
  ) {
    dismissCue();
    setBusyAction(actionKey);
    try {
      const response = await action();
      startTransition(() => {
        setState((current) => ({ ...current, scene: response.scene }));
      });
      await loadState(true);
      if (successText) {
        setMessage({ text: successText, tone: 'info' });
      }
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : 'The host action failed.',
        tone: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  function toggleSelection(index: number) {
    if (!activeBoard || activeBoard.allSelectionsLocked || activeBoard.revealedChests.length > 0) {
      return;
    }

    setDraftSelections((current) => (
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : current.length >= activeBoard.selectionLimit
          ? current
          : [...current, index]
    ));
  }

  function previewChest(index: number | null) {
    if (!activeTurn || !activeBoard) {
      dismissCue();
      return;
    }

    const canPreviewSelection = !activeBoard.allSelectionsLocked && activeBoard.revealedChests.length === 0;
    const canPreviewReveal = activeBoard.allSelectionsLocked
      && activeBoard.remainingReveals > 0
      && index !== null
      && activeBoard.selectedChests.includes(index)
      && !activeBoard.revealedChests.includes(index);

    if (!canPreviewSelection && !canPreviewReveal) {
      dismissCue();
      return;
    }

    queuePresentationCue({
      turnId: activeTurn.id,
      chestIndex: index,
      selectedChests: draftSelections,
    });
  }

  async function startTurn(turnId: number, viewerName: string) {
    setDraftSelections([]);
    await runAction(`start-${turnId}`, async () => getJSON<TurnActionResponse>(`/api/v/giveaways/turns/${turnId}/start`, { method: 'POST' }), `${viewerName} is now live on the board.`);
  }

  async function lockSelections() {
    if (!activeTurn) return;
    await runAction('lock', async () => getJSON<TurnActionResponse>(`/api/v/giveaways/turns/${activeTurn.id}/select`, {
      method: 'POST',
      body: JSON.stringify({ chests: draftSelections }),
    }), 'Chest picks locked.');
  }

  async function revealNext() {
    if (!activeTurn) return;
    await runAction('reveal', async () => getJSON<TurnActionResponse>(`/api/v/giveaways/turns/${activeTurn.id}/reveal`, {
      method: 'POST',
    }), 'Next chest revealed.');
  }

  async function revealChest(index: number) {
    if (!activeTurn || !activeBoard || busyAction) return;
    if (!activeBoard.allSelectionsLocked || !activeBoard.selectedChests.includes(index) || activeBoard.revealedChests.includes(index)) {
      return;
    }

    await runAction(`reveal-${index}`, async () => getJSON<TurnActionResponse>(`/api/v/giveaways/turns/${activeTurn.id}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ chestIndex: index }),
    }), `Chest ${index + 1} revealed.`);
  }

  async function completeTurn() {
    if (!activeTurn) return;
    await runAction('complete', async () => getJSON<TurnActionResponse>(`/api/v/giveaways/turns/${activeTurn.id}/complete`, {
      method: 'POST',
    }), 'Turn completed and redemption fulfilled.');
  }

  async function performPrimaryAction() {
    if (!activeBoard) {
      if (nextQueuedTurn) {
        await startTurn(nextQueuedTurn.id, nextQueuedTurn.viewer.displayName);
      }
      return;
    }

    if (!activeBoard.allSelectionsLocked) {
      if (draftSelections.length === activeBoard.selectionLimit) {
        await lockSelections();
      }
      return;
    }

    if (activeBoard.remainingReveals > 0) {
      await revealNext();
      return;
    }

    if (activeBoard.revealedChests.length === activeBoard.selectionLimit) {
      await completeTurn();
    }
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName ?? '';
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }

    if (event.key >= '1' && event.key <= '9') {
      toggleSelection(Number(event.key) - 1);
      return;
    }
    if (event.key === '0') {
      toggleSelection(9);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void performPrimaryAction();
      return;
    }

    if (event.key === ' ' && activeBoard?.allSelectionsLocked && activeBoard.remainingReveals > 0) {
      event.preventDefault();
      void revealNext();
      return;
    }

    if ((event.key === 'c' || event.key === 'C') && activeBoard && activeBoard.revealedChests.length === activeBoard.selectionLimit) {
      event.preventDefault();
      void completeTurn();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleKeyboard(event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  function handleBoardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setDraftSelections(activeBoard?.selectedChests ?? []);
      setMessage(null);
      dismissCue();
    }
  }

  return (
    <main className={styles.hostPage}>
      <section className={styles.hostSurface}>
        <div className={styles.surfaceBody}>
          <section className={styles.sceneStage} onKeyDown={handleBoardKeyDown} tabIndex={0}>
            <LootChestScene
              scene={state.scene}
              presentationCue={presentationCue}
              draftSelections={draftSelections}
              onToggleSelection={busyAction ? undefined : toggleSelection}
              onRevealChest={busyAction ? undefined : revealChest}
              onPreviewChest={previewChest}
              frame="board-only"
              boardSizing="width"
              assetVersion={buildId}
              boardAction={showInlineLockAction ? {
                label: busyAction === 'lock' ? 'Locking...' : 'Lock',
                onClick: () => {
                  void lockSelections();
                },
                disabled: Boolean(busyAction),
              } : null}
            />
          </section>

          <aside className={styles.sideRail}>
            <section className={styles.railBlock}>
              <div className={styles.railIntro}>
                <p className={styles.routeLabel}>Ghosted giveaways</p>
                <p className={styles.pageSummary}>{hostCaption(state)}</p>
              </div>

              <div className={styles.railUtility}>
                <span className={styles.inlineMeta}>{boardStatus(state)}</span>
                <Link className="button button--secondary" href="/v/giveaways/">
                  Console
                </Link>
                {state.connection.overlayUrl ? (
                  <Link className="button button--secondary" href={state.connection.overlayUrl}>
                    Public overlay
                  </Link>
                ) : (
                  <span className={styles.inlineMeta}>Overlay pending</span>
                )}
              </div>

              {message ? (
                <div className={`${styles.inlineBanner} ${message.tone === 'error' ? styles.messageError : styles.messageInfo}`}>
                  <strong>{message.tone === 'error' ? 'Action failed' : 'Live update'}</strong>
                  <span>{message.text}</span>
                </div>
              ) : null}

              <div className={styles.railHeader}>
                <div>
                  <p className={styles.sectionLabel}>Live control</p>
                  <h2 className={styles.sectionTitle}>{actionLabel(state)}</h2>
                </div>
                <span className={styles.inlineMeta}>{state.queue.length} waiting</span>
              </div>

              <p className={styles.sectionCopy}>{controlHint(state)}</p>

              <button
                className={`button ${styles.primaryActionButton}`}
                type="button"
                onClick={() => {
                  void performPrimaryAction();
                }}
                disabled={Boolean(busyAction) || (!activeBoard && !nextQueuedTurn) || (!activeBoard ? false : (!activeBoard.allSelectionsLocked && draftSelections.length !== activeBoard.selectionLimit))}
              >
                {busyAction ? 'Working...' : actionLabel(state)}
              </button>

              <div className={styles.actionGrid}>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!nextQueuedTurn || Boolean(activeTurn) || busyAction === `start-${nextQueuedTurn?.id ?? 0}`}
                  onClick={() => {
                    if (nextQueuedTurn) {
                      void startTurn(nextQueuedTurn.id, nextQueuedTurn.viewer.displayName);
                    }
                  }}
                >
                  {busyAction?.startsWith('start-') ? 'Starting...' : nextQueuedTurn ? 'Start next' : 'Queue empty'}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!activeBoard || activeBoard.allSelectionsLocked || draftSelections.length !== activeBoard.selectionLimit || busyAction === 'lock'}
                  onClick={() => {
                    void lockSelections();
                  }}
                >
                  {busyAction === 'lock' ? 'Locking...' : 'Lock picks'}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!activeBoard?.allSelectionsLocked || activeBoard.remainingReveals === 0 || revealBusy}
                  onClick={() => {
                    void revealNext();
                  }}
                >
                  {revealBusy ? 'Revealing...' : 'Reveal next'}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!activeBoard || activeBoard.revealedChests.length !== activeBoard.selectionLimit || busyAction === 'complete'}
                  onClick={() => {
                    void completeTurn();
                  }}
                >
                  {busyAction === 'complete' ? 'Completing...' : 'Complete'}
                </button>
              </div>

              <p className={styles.keyHint}>Shortcuts: 1-0 picks, Enter primary action, Space reveal, C complete.</p>
            </section>

            <section className={styles.railBlock}>
              <div className={styles.railHeader}>
                <div>
                  <p className={styles.sectionLabel}>Queue</p>
                  <h2 className={styles.sectionTitle}>Next viewers</h2>
                </div>
              </div>

              <div className={styles.list}>
                {state.queue.length > 0 ? state.queue.slice(0, 4).map((turn, index) => (
                  <article key={turn.id} className={styles.listRow}>
                    <div className={styles.listMain}>
                      <strong className={styles.rowTitle}>{turn.viewer.displayName}</strong>
                      <p className={styles.rowMeta}>
                        @{turn.viewer.login} - {formatDate(turn.redeemedAt)} - {index === 0 ? 'Next up' : `Queue #${index + 1}`}
                      </p>
                    </div>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      disabled={Boolean(activeTurn) || busyAction === `start-${turn.id}`}
                      onClick={() => {
                        void startTurn(turn.id, turn.viewer.displayName);
                      }}
                    >
                      {busyAction === `start-${turn.id}` ? 'Starting...' : 'Start'}
                    </button>
                  </article>
                )) : (
                  <article className={styles.listRow}>
                    <div className={styles.listMain}>
                      <strong className={styles.rowTitle}>Queue clear</strong>
                      <p className={styles.rowMeta}>New Twitch redemptions will appear here automatically.</p>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className={styles.railBlock}>
              <div className={styles.railHeader}>
                <div>
                  <p className={styles.sectionLabel}>Results</p>
                  <h2 className={styles.sectionTitle}>Recent turns</h2>
                </div>
              </div>

              <div className={styles.list}>
                {state.recentResults.length > 0 ? state.recentResults.slice(0, 4).map((turn) => (
                  <article key={turn.id} className={styles.listRow}>
                    <div className={styles.listMain}>
                      <strong className={styles.rowTitle}>{turn.viewer.displayName}</strong>
                      <p className={styles.rowMeta}>
                        {recentResultLabel(turn)} - {formatDate(turn.completedAt ?? turn.createdAt)}
                      </p>
                    </div>
                  </article>
                )) : (
                  <article className={styles.listRow}>
                    <div className={styles.listMain}>
                      <strong className={styles.rowTitle}>No completed turns yet</strong>
                      <p className={styles.rowMeta}>Resolved runs will land here after completion.</p>
                    </div>
                  </article>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
