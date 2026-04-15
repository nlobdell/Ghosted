'use client';

import Link from 'next/link';
import { startTransition, useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatDate, getJSON } from '@/lib/api';
import type { LootChestGameState } from '@/lib/types';
import { LootChestBoardView } from '../LootChestBoard';
import styles from './page.module.css';

const HOST_POLL_INTERVAL_MS = 700;
const OVERLAY_POLL_INTERVAL_MS = 1200;

type HostMessage = {
  text: string;
  tone: 'info' | 'error';
} | null;

function heroHeadline(state: LootChestGameState) {
  if (state.activeTurn) {
    return `${state.activeTurn.viewer.displayName} is live on the board`;
  }

  const nextTurn = state.queue[0];
  if (nextTurn) {
    return `${nextTurn.viewer.displayName} is next in the queue`;
  }

  return 'Stand by for the next loot chest turn';
}

function heroCopy(state: LootChestGameState) {
  if (state.activeTurn) {
    return 'Run the turn from this host overlay and stay in sync with the board without waiting on the full operator console.';
  }

  if (state.queue.length > 0) {
    return 'Start the next queued redemption from here when the stream is ready.';
  }

  return 'Keep this surface open on a second monitor or touch device so the host controls stay close to the live overlay.';
}

function boardStatus(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    return 'No active turn is on the board yet.';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Pick exactly three chests, then lock them in.';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return `Reveal ${activeTurn.board.remainingReveals} more chest${activeTurn.board.remainingReveals === 1 ? '' : 's'}.`;
  }

  if (activeTurn.result === 'win') {
    return 'The prize chest has been found. Complete the turn when the stream is ready.';
  }

  return 'All three chests are revealed. Complete the turn to fulfill Twitch and move on.';
}

function controlHint(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    return state.queue[0]
      ? 'Press Enter to start the next queued turn.'
      : 'The host overlay will keep watching for new queue entries.';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Use keys 1-0 to toggle chests, then press Enter to lock your three picks.';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return 'Press Space to reveal the next chest.';
  }

  return 'Press C to complete the turn once the board resolves.';
}

function actionLabel(state: LootChestGameState) {
  const activeTurn = state.activeTurn;
  if (!activeTurn?.board) {
    const nextTurn = state.queue[0];
    return nextTurn ? `Start ${nextTurn.viewer.displayName}` : 'Waiting for queue';
  }

  if (!activeTurn.board.allSelectionsLocked) {
    return 'Lock selections';
  }

  if (activeTurn.board.remainingReveals > 0) {
    return 'Reveal next chest';
  }

  return 'Complete turn';
}

export default function TwitchLootChestHostOverlayClient({
  initialState,
}: {
  initialState: LootChestGameState;
}) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<HostMessage>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draftSelections, setDraftSelections] = useState<number[]>(initialState.activeTurn?.board?.selectedChests ?? []);
  const [lastSyncAt, setLastSyncAt] = useState(() => Date.now());
  const pollInFlightRef = useRef(false);

  const activeTurn = state.activeTurn;
  const activeBoard = activeTurn?.board ?? null;
  const nextQueuedTurn = state.queue[0] ?? null;
  const activeTurnId = activeTurn?.id ?? null;
  const selectedChestKey = activeBoard?.selectedChests.join(',') ?? '';
  const revealedChestKey = activeBoard?.revealedChests.join(',') ?? '';
  const syncPill = `Host sync ${HOST_POLL_INTERVAL_MS}ms`;
  const overlayPill = `OBS sync ${OVERLAY_POLL_INTERVAL_MS}ms`;

  useEffect(() => {
    setDraftSelections(
      selectedChestKey
        ? selectedChestKey.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))
        : [],
    );
  }, [activeTurnId, selectedChestKey, revealedChestKey]);

  async function loadState(quiet = false) {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const nextState = await getJSON<LootChestGameState>('/api/v/giveaways/state');
      startTransition(() => {
        setState(nextState);
        setLastSyncAt(Date.now());
      });
      if (!quiet) {
        setMessage(null);
      }
    } catch (caught) {
      if (!quiet) {
        setMessage({
          text: caught instanceof Error ? caught.message : 'Unable to refresh the host overlay.',
          tone: 'error',
        });
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }

  const pollState = useEffectEvent(() => {
    void loadState(true);
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      pollState();
    }, HOST_POLL_INTERVAL_MS);
    const handleFocus = () => {
      pollState();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollState();
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

  async function runAction(actionKey: string, action: () => Promise<void>, successText?: string) {
    setBusyAction(actionKey);
    try {
      await action();
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

  async function startTurn(turnId: number, viewerName: string) {
    await runAction(`start-${turnId}`, async () => {
      await getJSON(`/api/v/giveaways/turns/${turnId}/start`, { method: 'POST' });
    }, `${viewerName} is now live on the board.`);
  }

  async function lockSelections() {
    if (!activeTurn) return;
    await runAction('lock', async () => {
      await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/select`, {
        method: 'POST',
        body: JSON.stringify({ chests: draftSelections }),
      });
    }, 'Chest picks locked.');
  }

  async function revealNext() {
    if (!activeTurn) return;
    await runAction('reveal', async () => {
      await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/reveal`, { method: 'POST' });
    }, 'Next chest revealed.');
  }

  async function completeTurn() {
    if (!activeTurn) return;
    await runAction('complete', async () => {
      await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/complete`, { method: 'POST' });
    }, 'Turn completed and redemption fulfilled.');
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
    }
  }

  return (
    <main className={styles.hostPage}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Ghosted host overlay</p>
          <h1 className={styles.headline}>{heroHeadline(state)}</h1>
          <p className={styles.heroSummary}>{heroCopy(state)}</p>
          <div className={styles.chipRow}>
            <span className={styles.chip}>{syncPill}</span>
            <span className={styles.chip}>{overlayPill}</span>
            <span className={styles.chip}>{state.queue.length} queued</span>
            <span className={styles.chip}>{formatDate(new Date(lastSyncAt).toISOString())}</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            className="button"
            type="button"
            onClick={() => {
              void performPrimaryAction();
            }}
            disabled={Boolean(busyAction) || (!activeBoard && !nextQueuedTurn) || (!activeBoard ? false : (!activeBoard.allSelectionsLocked && draftSelections.length !== activeBoard.selectionLimit))}
          >
            {busyAction ? 'Working...' : actionLabel(state)}
          </button>
          <Link className="button button--secondary" href="/v/giveaways/">
            Open console
          </Link>
          {state.connection.overlayUrl ? (
            <Link className="button button--secondary" href={state.connection.overlayUrl}>
              Open public overlay
            </Link>
          ) : (
            <span className={styles.chip}>Public overlay not ready</span>
          )}
        </div>
      </section>

      {message ? (
        <section className={`${styles.messageBar} ${message.tone === 'error' ? styles.messageError : styles.messageInfo}`}>
          <strong>{message.tone === 'error' ? 'Host action failed' : 'Live update'}</strong>
          <span>{message.text}</span>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <section className={styles.mainStage}>
          <div className={`${styles.statusBar} ${activeTurn?.result === 'win' ? styles.statusWin : activeTurn?.result === 'miss' ? styles.statusMiss : ''}`}>
            <span className={styles.label}>Board status</span>
            <strong>{boardStatus(state)}</strong>
            <span>{controlHint(state)}</span>
          </div>

          <div className={styles.metaStrip}>
            <article className={styles.metaCard}>
              <span className={styles.label}>Viewer</span>
              <strong>{activeTurn?.viewer.displayName ?? nextQueuedTurn?.viewer.displayName ?? 'Stand by'}</strong>
              <span>{activeTurn ? `@${activeTurn.viewer.login}` : nextQueuedTurn ? `Next: @${nextQueuedTurn.viewer.login}` : 'Queue is clear'}</span>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.label}>Reward</span>
              <strong>{state.connection.reward.title}</strong>
              <span>{state.connection.reward.cost.toLocaleString()} points</span>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.label}>Action</span>
              <strong>{actionLabel(state)}</strong>
              <span>{busyAction ? 'Updating now' : 'Ready for the next host input'}</span>
            </article>
          </div>

          <section className={styles.boardShell} onKeyDown={handleBoardKeyDown} tabIndex={0}>
            {activeBoard ? (
              <LootChestBoardView
                board={activeBoard}
                draftSelections={draftSelections}
                onToggleSelection={toggleSelection}
              />
            ) : (
              <div className={styles.emptyBoard}>
                <p className={styles.label}>No active turn</p>
                <strong>{nextQueuedTurn ? `${nextQueuedTurn.viewer.displayName} is ready to start.` : 'Waiting for the next redemption.'}</strong>
                <span>
                  {nextQueuedTurn
                    ? 'Start the queued turn from this host surface when you are ready to go live.'
                    : 'Keep this surface open and the queue will appear here as Twitch redemptions arrive.'}
                </span>
              </div>
            )}
          </section>

          <div className={styles.controlRail}>
            <button
              className="button"
              type="button"
              disabled={!nextQueuedTurn || Boolean(activeTurn) || busyAction === `start-${nextQueuedTurn?.id ?? 0}`}
              onClick={() => {
                if (nextQueuedTurn) {
                  void startTurn(nextQueuedTurn.id, nextQueuedTurn.viewer.displayName);
                }
              }}
            >
              {busyAction?.startsWith('start-') ? 'Starting...' : nextQueuedTurn ? `Start ${nextQueuedTurn.viewer.displayName}` : 'Queue empty'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!activeBoard || activeBoard.allSelectionsLocked || draftSelections.length !== activeBoard.selectionLimit || busyAction === 'lock'}
              onClick={() => {
                void lockSelections();
              }}
            >
              {busyAction === 'lock' ? 'Locking...' : 'Lock 3 picks'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!activeBoard?.allSelectionsLocked || activeBoard.remainingReveals === 0 || busyAction === 'reveal'}
              onClick={() => {
                void revealNext();
              }}
            >
              {busyAction === 'reveal' ? 'Revealing...' : 'Reveal next chest'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!activeBoard || activeBoard.revealedChests.length !== activeBoard.selectionLimit || busyAction === 'complete'}
              onClick={() => {
                void completeTurn();
              }}
            >
              {busyAction === 'complete' ? 'Completing...' : 'Complete turn'}
            </button>
          </div>
        </section>

        <aside className={styles.sideRail}>
          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Pending queue</p>
                <h2>Next viewers</h2>
              </div>
              <span className={styles.pill}>{state.queue.length}</span>
            </div>
            <div className={styles.queueList}>
              {state.queue.length > 0 ? state.queue.map((turn, index) => (
                <article key={turn.id} className={`${styles.queueCard} ${index === 0 ? styles.queueCardPrimary : ''}`}>
                  <div>
                    <strong>{turn.viewer.displayName}</strong>
                    <p>@{turn.viewer.login}</p>
                  </div>
                  <div className={styles.queueMeta}>
                    <span>{formatDate(turn.redeemedAt)}</span>
                    {turn.userInput ? <span>Input: {turn.userInput}</span> : null}
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
                <article className={styles.queueCard}>
                  <strong>Queue is clear.</strong>
                  <p>New Twitch redemptions will appear here automatically.</p>
                </article>
              )}
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Control hints</p>
                <h2>Quick keys</h2>
              </div>
            </div>
            <div className={styles.hintList}>
              <article className={styles.hintCard}>
                <strong>1-0</strong>
                <p>Toggle chest picks before the board is locked.</p>
              </article>
              <article className={styles.hintCard}>
                <strong>Enter</strong>
                <p>Advance the primary host action: start, lock, reveal, or complete.</p>
              </article>
              <article className={styles.hintCard}>
                <strong>Space</strong>
                <p>Reveal the next chest after selections are locked.</p>
              </article>
              <article className={styles.hintCard}>
                <strong>C</strong>
                <p>Complete the turn once all three reveals are done.</p>
              </article>
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Recent results</p>
                <h2>History</h2>
              </div>
            </div>
            <div className={styles.historyList}>
              {state.recentResults.length > 0 ? state.recentResults.slice(0, 5).map((turn) => (
                <article key={turn.id} className={styles.historyCard}>
                  <strong>{turn.viewer.displayName}</strong>
                  <p>{turn.result === 'win' ? 'Found the prize chest' : 'Missed the prize chest'}</p>
                  <span>{formatDate(turn.completedAt ?? turn.createdAt)}</span>
                </article>
              )) : (
                <article className={styles.historyCard}>
                  <strong>No completed turns yet.</strong>
                  <p>Resolved loot chest turns will appear here.</p>
                </article>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
