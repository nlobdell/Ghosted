'use client';

import Link from 'next/link';
import { startTransition, useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatDate, getJSON } from '@/lib/api';
import type { LootChestGameState, LootChestSceneSnapshot, LootChestTurn } from '@/lib/types';
import { LootChestScene } from '../LootChestScene';
import { useLootChestSceneTransport } from '../useLootChestSceneTransport';
import styles from './page.module.css';

const HOST_STATE_POLL_MS = 2500;

type HostMessage = {
  text: string;
  tone: 'info' | 'error';
} | null;

type TurnActionResponse = {
  ok: boolean;
  result: LootChestTurn;
  scene: LootChestSceneSnapshot;
};

function hostTitle(state: LootChestGameState) {
  if (state.activeTurn) {
    return `${state.activeTurn.viewer.displayName} live on board`;
  }

  const nextTurn = state.queue[0];
  if (nextTurn) {
    return `${nextTurn.viewer.displayName} ready in queue`;
  }

  return 'Host surface ready';
}

function hostSummary(state: LootChestGameState) {
  if (state.activeTurn?.board) {
    return state.activeTurn.board.allSelectionsLocked
      ? 'Advance reveals from here while the public overlay stays in lockstep.'
      : 'Pick exactly three chests, lock them, then reveal one at a time.';
  }

  if (state.queue.length > 0) {
    return 'Start the next queued redemption from this surface when stream timing is right.';
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
    return 'Space reveals the next chest.';
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
  const overlayToken = state.connection.overlayToken ?? null;

  useEffect(() => {
    setDraftSelections(
      selectedChestKey
        ? selectedChestKey.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))
        : [],
    );
  }, [activeTurnId, selectedChestKey, revealedChestKey]);

  function applyLoadedState(nextState: LootChestGameState) {
    startTransition(() => {
      setState(nextState);
      setLastSyncAt(Date.now());
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

  useLootChestSceneTransport({
    overlayToken,
    currentScene: state.scene,
    fetchState: () => getJSON<LootChestGameState>('/api/v/giveaways/state'),
    applyState: (nextState) => {
      applyLoadedState(nextState);
    },
    applyScene: (nextScene) => {
      startTransition(() => {
        setState((current) => ({ ...current, scene: nextScene }));
      });
    },
  });

  async function runAction(
    actionKey: string,
    action: () => Promise<TurnActionResponse>,
    successText?: string,
  ) {
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
    }
  }

  return (
    <main className={styles.hostPage}>
      <section className={styles.topBar}>
        <div className={styles.topCopy}>
          <p className={styles.routeLabel}>Ghosted / giveaways / host</p>
          <h1 className={styles.pageTitle}>{hostTitle(state)}</h1>
          <p className={styles.pageSummary}>{hostSummary(state)}</p>
        </div>

        <div className={styles.topActions}>
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
            Console
          </Link>
          {state.connection.overlayUrl ? (
            <Link className="button button--secondary" href={state.connection.overlayUrl}>
              Public overlay
            </Link>
          ) : (
            <span className={styles.metaChip}>Overlay pending</span>
          )}
        </div>
      </section>

      <section className={styles.metaBar}>
        <span className={styles.metaChip}>{boardStatus(state)}</span>
        <span className={styles.metaChip}>{state.queue.length} queued</span>
        <span className={styles.metaChip}>{controlHint(state)}</span>
        <span className={styles.metaChip}>State sync {HOST_STATE_POLL_MS}ms</span>
        <span className={styles.metaChip}>{formatDate(new Date(lastSyncAt).toISOString())}</span>
      </section>

      {message ? (
        <section className={`${styles.messageBar} ${message.tone === 'error' ? styles.messageError : styles.messageInfo}`}>
          <strong>{message.tone === 'error' ? 'Action failed' : 'Live update'}</strong>
          <span>{message.text}</span>
        </section>
      ) : null}

      <section className={styles.sceneStage} onKeyDown={handleBoardKeyDown} tabIndex={0}>
        <LootChestScene
          scene={state.scene}
          draftSelections={draftSelections}
          onToggleSelection={toggleSelection}
        />
      </section>

      <section className={styles.controlBand}>
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
          {busyAction === 'reveal' ? 'Revealing...' : 'Reveal next'}
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
      </section>

      <section className={styles.utilityGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.routeLabel}>Queue</p>
              <h2>Next viewers</h2>
            </div>
            <span className={styles.metaChip}>{state.queue.length}</span>
          </div>
          <div className={styles.recordList}>
            {state.queue.length > 0 ? state.queue.map((turn, index) => (
              <article key={turn.id} className={styles.recordCard}>
                <div className={styles.recordHeader}>
                  <strong>{turn.viewer.displayName}</strong>
                  <span className={styles.metaChip}>{index === 0 ? 'Next' : `#${index + 1}`}</span>
                </div>
                <p>@{turn.viewer.login}</p>
                <p>{formatDate(turn.redeemedAt)}</p>
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
              <article className={styles.recordCard}>
                <strong>Queue clear.</strong>
                <p>New Twitch redemptions appear here automatically.</p>
              </article>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.routeLabel}>History</p>
              <h2>Recent results</h2>
            </div>
          </div>
          <div className={styles.recordList}>
            {state.recentResults.length > 0 ? state.recentResults.slice(0, 5).map((turn) => (
              <article key={turn.id} className={styles.recordCard}>
                <div className={styles.recordHeader}>
                  <strong>{turn.viewer.displayName}</strong>
                  <span className={styles.metaChip}>{turn.result}</span>
                </div>
                <p>{turn.result === 'win' ? 'Prize chest found.' : 'Prize chest missed.'}</p>
                <p>{formatDate(turn.completedAt ?? turn.createdAt)}</p>
              </article>
            )) : (
              <article className={styles.recordCard}>
                <strong>No completed turns yet.</strong>
                <p>Resolved runs will land here.</p>
              </article>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.routeLabel}>Keys</p>
              <h2>Shortcuts</h2>
            </div>
          </div>
          <div className={styles.recordList}>
            <article className={styles.recordCard}>
              <strong>1-0</strong>
              <p>Toggle chest picks before lock.</p>
            </article>
            <article className={styles.recordCard}>
              <strong>Enter</strong>
              <p>Run the primary action for the current board state.</p>
            </article>
            <article className={styles.recordCard}>
              <strong>Space / C</strong>
              <p>Reveal the next chest, then complete once the board resolves.</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
