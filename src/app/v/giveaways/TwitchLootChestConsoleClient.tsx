'use client';

import Link from 'next/link';
import { startTransition, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AppContext,
  Banner,
  EmptyState,
  FormField,
  Panel,
  SectionHeading,
} from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { LootChestGameState, LootChestTurn } from '@/lib/types';
import { LootChestBoardView } from './LootChestBoard';
import styles from './page.module.css';

function resultCopy(turn: LootChestTurn) {
  if (turn.result === 'win') return `${turn.viewer.displayName} found the prize chest.`;
  if (turn.result === 'miss') return `${turn.viewer.displayName} missed the prize chest.`;
  return `${turn.viewer.displayName} is still mid-turn.`;
}

function statusBannerClass(turn: LootChestTurn | null) {
  if (!turn) return styles.statusBanner;
  if (turn.result === 'win') return `${styles.statusBanner} ${styles.statusBannerWin}`;
  if (turn.result === 'miss') return `${styles.statusBanner} ${styles.statusBannerMiss}`;
  return styles.statusBanner;
}

export default function TwitchLootChestConsoleClient({
  initialState,
  initialMessage,
}: {
  initialState: LootChestGameState;
  initialMessage: string | null;
}) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(
    initialMessage ? { text: initialMessage, variant: 'info' } : null,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draftSelections, setDraftSelections] = useState<number[]>(initialState.activeTurn?.board?.selectedChests ?? []);
  const [rewardForm, setRewardForm] = useState({
    title: initialState.connection.reward.title,
    prompt: initialState.connection.reward.prompt,
    cost: String(initialState.connection.reward.cost),
  });

  const activeTurn = state.activeTurn;
  const queueCount = state.queue.length;
  const rewardReady = Boolean(state.connection.reward.id);
  const activeTurnId = state.activeTurn?.id ?? null;
  const selectedChestKey = state.activeTurn?.board?.selectedChests.join(',') ?? '';
  const revealedChestKey = state.activeTurn?.board?.revealedChests.join(',') ?? '';

  useEffect(() => {
    setDraftSelections(
      selectedChestKey
        ? selectedChestKey.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))
        : [],
    );
  }, [activeTurnId, selectedChestKey, revealedChestKey]);

  useEffect(() => {
    setRewardForm({
      title: state.connection.reward.title,
      prompt: state.connection.reward.prompt,
      cost: String(state.connection.reward.cost),
    });
  }, [
    state.connection.reward.title,
    state.connection.reward.prompt,
    state.connection.reward.cost,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void (async () => {
        const nextState = await getJSON<LootChestGameState>('/api/v/giveaways/state');
        startTransition(() => {
          setState(nextState);
        });
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function loadState(quiet = false) {
    const nextState = await getJSON<LootChestGameState>('/api/v/giveaways/state');
    startTransition(() => {
      setState(nextState);
    });
    if (!quiet) {
      setMessage(null);
    }
  }

  async function runAction(actionKey: string, action: () => Promise<void>, successText?: string) {
    setBusyAction(actionKey);
    try {
      await action();
      await loadState(true);
      if (successText) {
        setMessage({ text: successText, variant: 'info' });
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'The action failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnect() {
    setBusyAction('connect');
    try {
      const result = await getJSON<{ authorizeUrl: string }>('/api/v/twitch/connect', {
        method: 'POST',
        body: JSON.stringify({ next: '/v/giveaways/' }),
      });
      window.location.assign(result.authorizeUrl);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to start Twitch auth.',
        variant: 'error',
      });
      setBusyAction(null);
    }
  }

  function copyOverlayUrl() {
    if (!state.connection.overlayUrl) return;
    void navigator.clipboard.writeText(state.connection.overlayUrl);
    setMessage({ text: 'Overlay URL copied.', variant: 'info' });
  }

  async function handleRewardSync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('reward-sync', async () => {
      await getJSON('/api/v/giveaways/twitch/reward/sync', {
        method: 'POST',
        body: JSON.stringify({
          title: rewardForm.title,
          prompt: rewardForm.prompt,
          cost: Number(rewardForm.cost),
        }),
      });
    }, 'Twitch reward synced.');
  }

  const recentResultItems = useMemo(() => {
    return state.recentResults.map((turn) => ({
      title: turn.viewer.displayName,
      meta: `${turn.result.toUpperCase()} - ${formatDate(turn.completedAt ?? turn.createdAt)}`,
      body: resultCopy(turn),
    }));
  }, [state.recentResults]);

  return (
    <>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Operator surfaces' },
          { label: 'Twitch loot chest' },
        ]}
        title="Twitch Loot Chest"
        summary="Queue control, reward sync, and operator actions for the Ghosted loot chest game."
      />

      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <section className={styles.toolbar}>
        <div className={styles.toolbarCopy}>
          <p className={styles.eyebrow}>Giveaway control</p>
          <h2>{activeTurn ? `${activeTurn.viewer.displayName} active` : queueCount > 0 ? `${queueCount} queued turn${queueCount === 1 ? '' : 's'}` : 'Queue clear'}</h2>
          <p>
            {activeTurn
              ? 'Reveal the selected chests one at a time, then complete the turn to fulfill Twitch.'
              : 'New redemptions land here as queued turns. Start each turn manually when stream timing is right.'}
          </p>
        </div>

        <div className={styles.toolbarActions}>
          <button className="button button--small" type="button" onClick={handleConnect} disabled={busyAction === 'connect'}>
            {busyAction === 'connect' ? 'Redirecting...' : state.connection.connected ? 'Reconnect Twitch' : 'Connect Twitch'}
          </button>
          <Link className="button button--secondary button--small" href="/v/giveaways/host/">
            Open host
          </Link>
          <button
            className="button button--secondary button--small"
            type="button"
            disabled={!state.connection.overlayUrl}
            onClick={copyOverlayUrl}
          >
            Copy overlay URL
          </button>
        </div>
      </section>

      <section className={styles.statusBoard}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Setup</span>
          <strong className={styles.statusValue}>{state.connection.configured ? 'Ready' : 'Missing env'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Channel</span>
          <strong className={styles.statusValue}>{state.connection.connected ? 'Connected' : 'Not linked'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Webhooks</span>
          <strong className={styles.statusValue}>{state.connection.eventSub.status ?? 'Unsynced'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Queue</span>
          <strong className={styles.statusValue}>{queueCount} waiting</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Board</span>
          <strong className={styles.statusValue}>{activeTurn ? `${activeTurn.viewer.displayName} live` : 'Idle'}</strong>
        </div>
      </section>

      <div className={styles.workspace}>
        <div className={styles.column}>
          <Panel
            title="Reward and Twitch connection"
            eyebrow="Control"
            body={(
              <form className={styles.rewardForm} onSubmit={handleRewardSync}>
                <SectionHeading
                  title="Managed reward"
                  copy="One Ghosted-owned custom reward powers the full loot chest flow."
                />

                <div className={styles.rewardSummary}>
                  <div className={styles.rewardStat}>
                    <span className={styles.rewardLabel}>Reward</span>
                    <strong className={styles.rewardValue}>{state.connection.reward.title}</strong>
                  </div>
                  <div className={styles.rewardStat}>
                    <span className={styles.rewardLabel}>Cost</span>
                    <strong className={styles.rewardValue}>{state.connection.reward.cost.toLocaleString()} points</strong>
                  </div>
                  <div className={styles.rewardStat}>
                    <span className={styles.rewardLabel}>Status</span>
                    <strong className={styles.rewardValue}>{state.connection.reward.isPaused ? 'Paused' : 'Live'}</strong>
                  </div>
                </div>

                <FormField label="Reward title">
                  <input
                    className={styles.input}
                    value={rewardForm.title}
                    onChange={(event) => setRewardForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </FormField>

                <div className={styles.fieldPair}>
                  <FormField label="Reward prompt">
                    <textarea
                      className={styles.textarea}
                      value={rewardForm.prompt}
                      onChange={(event) => setRewardForm((current) => ({ ...current, prompt: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Reward cost">
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      value={rewardForm.cost}
                      onChange={(event) => setRewardForm((current) => ({ ...current, cost: event.target.value }))}
                    />
                  </FormField>
                </div>

                <div className={styles.overlayRow}>
                  <input className={styles.overlayUrl} readOnly value={state.connection.overlayUrl ?? 'Overlay URL will appear after setup.'} />
                  <Link className="button button--secondary button--small" href="/v/giveaways/host/">
                    Host
                  </Link>
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    disabled={!state.connection.overlayUrl}
                    onClick={copyOverlayUrl}
                  >
                    Copy
                  </button>
                </div>

                <div className={styles.actionRow}>
                  <button className="button" type="submit" disabled={busyAction === 'reward-sync'}>
                    {busyAction === 'reward-sync' ? 'Syncing...' : 'Sync reward'}
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={!rewardReady || busyAction === 'reward-pause'}
                    onClick={() => {
                      void runAction('reward-pause', async () => {
                        await getJSON('/api/v/giveaways/twitch/reward/pause', {
                          method: 'POST',
                          body: JSON.stringify({ paused: !state.connection.reward.isPaused }),
                        });
                      }, state.connection.reward.isPaused ? 'Reward resumed.' : 'Reward paused.');
                    }}
                  >
                    {busyAction === 'reward-pause'
                      ? 'Updating...'
                      : state.connection.reward.isPaused
                        ? 'Resume reward'
                        : 'Pause reward'}
                  </button>
                </div>
              </form>
            )}
          />

          <Panel
            title={activeTurn ? `Active turn: ${activeTurn.viewer.displayName}` : 'Active turn'}
            eyebrow="Board"
            body={activeTurn ? (
              <div className={styles.turnStage}>
                <div className={styles.turnSummary}>
                  <article className={styles.metricCard}>
                    <span className={styles.smallLabel}>Viewer</span>
                    <strong>{activeTurn.viewer.displayName}</strong>
                    <span>@{activeTurn.viewer.login}</span>
                  </article>
                  <article className={styles.metricCard}>
                    <span className={styles.smallLabel}>Redeemed</span>
                    <strong>{formatDate(activeTurn.redeemedAt)}</strong>
                    <span>{activeTurn.result === 'pending' ? 'Turn in progress' : activeTurn.result.toUpperCase()}</span>
                  </article>
                  <article className={styles.metricCard}>
                    <span className={styles.smallLabel}>Board flow</span>
                    <strong>{activeTurn.board?.revealedChests.length ?? 0} / 3 opened</strong>
                    <span>{activeTurn.board?.allSelectionsLocked ? 'Selections locked' : 'Pick three chests'}</span>
                  </article>
                </div>

                <LootChestBoardView
                  board={activeTurn.board}
                  draftSelections={draftSelections}
                  onToggleSelection={(index) => {
                    if (activeTurn.board?.allSelectionsLocked || activeTurn.board?.revealedChests.length) return;
                    setDraftSelections((current) => (
                      current.includes(index)
                        ? current.filter((entry) => entry !== index)
                        : current.length >= 3
                          ? current
                          : [...current, index]
                    ));
                  }}
                />

                <div className={statusBannerClass(activeTurn)}>
                  {activeTurn.result === 'pending'
                    ? 'Lock three picks, reveal the selected chests, then complete the turn.'
                    : activeTurn.result === 'win'
                      ? 'Prize chest found. Finish any remaining reveals, then complete the turn.'
                      : 'All selected chests are empty. Complete the turn to fulfill Twitch and move on.'}
                </div>

                <div className={styles.actionRow}>
                  <button
                    className="button"
                    type="button"
                    disabled={activeTurn.board?.allSelectionsLocked || draftSelections.length !== 3 || busyAction === 'lock'}
                    onClick={() => {
                      void runAction('lock', async () => {
                        await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/select`, {
                          method: 'POST',
                          body: JSON.stringify({ chests: draftSelections }),
                        });
                      }, 'Chest selections locked.');
                    }}
                  >
                    {busyAction === 'lock' ? 'Locking...' : 'Lock selections'}
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={!activeTurn.board?.allSelectionsLocked || activeTurn.board.remainingReveals === 0 || busyAction === 'reveal'}
                    onClick={() => {
                      void runAction('reveal', async () => {
                        await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/reveal`, { method: 'POST' });
                      });
                    }}
                  >
                    {busyAction === 'reveal' ? 'Opening...' : 'Reveal next'}
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={activeTurn.board?.revealedChests.length !== 3 || busyAction === 'complete'}
                    onClick={() => {
                      void runAction('complete', async () => {
                        await getJSON(`/api/v/giveaways/turns/${activeTurn.id}/complete`, { method: 'POST' });
                      }, 'Turn completed and Twitch redemption fulfilled.');
                    }}
                  >
                    {busyAction === 'complete' ? 'Completing...' : 'Complete turn'}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState message="No active turn is on the board. Start the next queued redemption when the stream is ready." />
            )}
          />
        </div>

        <div className={styles.stack}>
          <Panel
            title="Pending queue"
            eyebrow="Queue"
            body={state.queue.length > 0 ? (
              <div className={styles.queueList}>
                {state.queue.map((turn) => (
                  <article key={turn.id} className={styles.queueCard}>
                    <div className={styles.queueHeader}>
                      <div>
                        <div className={styles.cardTitle}>{turn.viewer.displayName}</div>
                        <div className={styles.cardMeta}>@{turn.viewer.login}</div>
                      </div>
                      <span className={styles.recordMeta}>{formatDate(turn.redeemedAt)}</span>
                    </div>
                    {turn.userInput ? <div className={styles.cardMeta}>Viewer input: {turn.userInput}</div> : null}
                    <div className={styles.actionRow}>
                      <button
                        className="button button--small"
                        type="button"
                        disabled={Boolean(activeTurn) || busyAction === `start-${turn.id}`}
                        onClick={() => {
                          void runAction(`start-${turn.id}`, async () => {
                            await getJSON(`/api/v/giveaways/turns/${turn.id}/start`, { method: 'POST' });
                          }, `${turn.viewer.displayName} is now on the board.`);
                        }}
                      >
                        {busyAction === `start-${turn.id}` ? 'Starting...' : 'Start turn'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="No queued Twitch redemptions yet." />
            )}
          />

          <Panel
            title="Recent results"
            eyebrow="History"
            body={recentResultItems.length > 0 ? (
              <div className={styles.resultList}>
                {recentResultItems.map((item) => (
                  <article key={`${item.title}-${item.meta}`} className={styles.historyCard}>
                    <div className={styles.historyHeader}>
                      <strong>{item.title}</strong>
                      <span className={styles.recordMeta}>{item.meta}</span>
                    </div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="Completed turns will appear here after the first redemption resolves." />
            )}
          />
        </div>
      </div>
    </>
  );
}
