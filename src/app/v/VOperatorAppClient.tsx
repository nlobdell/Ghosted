'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState, type FormEvent } from 'react';
import { formatDate, getJSON } from '@/lib/api';
import type {
  LootChestTurn,
  VOperatorAppState,
  VOperatorAppTab,
} from '@/lib/types';
import { LootChestBoardView } from './giveaways/LootChestBoard';
import styles from './page.module.css';

const APP_TABS: VOperatorAppTab[] = ['live', 'queue', 'setup', 'diagnostics'];
const APP_STATE_POLL_MS = 4000;

function resultCopy(turn: LootChestTurn) {
  if (turn.result === 'win') return `${turn.viewer.displayName} found the prize chest.`;
  if (turn.result === 'miss') return `${turn.viewer.displayName} missed the prize chest.`;
  return `${turn.viewer.displayName} is still mid-turn.`;
}

function topStatusCopy(state: VOperatorAppState) {
  const activeTurn = state.giveaway.activeTurn;
  if (activeTurn) {
    return `${activeTurn.viewer.displayName} is live on the board.`;
  }

  if (state.giveaway.queue.length > 0) {
    return `${state.giveaway.queue.length} queued redemption${state.giveaway.queue.length === 1 ? '' : 's'} waiting.`;
  }

  if (state.giveaway.connection.connected) {
    return 'Broadcaster linked and ready for the next session.';
  }

  return 'Connect Twitch to bring the live queue online.';
}

export default function VOperatorAppClient({
  initialState,
  initialTab,
  initialMessage,
}: {
  initialState: VOperatorAppState;
  initialTab: VOperatorAppTab;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState(initialState);
  const [currentTab, setCurrentTab] = useState<VOperatorAppTab>(initialTab);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(
    initialMessage ? { text: initialMessage, variant: 'info' } : null,
  );
  const [draftSelections, setDraftSelections] = useState<number[]>(initialState.giveaway.activeTurn?.board?.selectedChests ?? []);
  const [rewardForm, setRewardForm] = useState({
    title: initialState.giveaway.connection.reward.title,
    prompt: initialState.giveaway.connection.reward.prompt,
    cost: String(initialState.giveaway.connection.reward.cost),
  });

  const giveaway = state.giveaway;
  const platform = state.platform;
  const activeTurn = giveaway.activeTurn;
  const activeBoard = activeTurn?.board ?? null;
  const queueCount = giveaway.queue.length;
  const rewardReady = Boolean(giveaway.connection.reward.id);
  const activeTurnId = activeTurn?.id ?? null;
  const selectedChestKey = activeBoard?.selectedChests.join(',') ?? '';
  const revealedChestKey = activeBoard?.revealedChests.join(',') ?? '';
  const connection = platform.connection;
  const topStatus = topStatusCopy(state);

  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setDraftSelections(
      selectedChestKey
        ? selectedChestKey.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))
        : [],
    );
  }, [activeTurnId, selectedChestKey, revealedChestKey]);

  useEffect(() => {
    setRewardForm({
      title: giveaway.connection.reward.title,
      prompt: giveaway.connection.reward.prompt,
      cost: String(giveaway.connection.reward.cost),
    });
  }, [
    giveaway.connection.reward.title,
    giveaway.connection.reward.prompt,
    giveaway.connection.reward.cost,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void (async () => {
        const nextState = await getJSON<VOperatorAppState>('/api/v/state');
        startTransition(() => {
          setState(nextState);
        });
      })();
    }, APP_STATE_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  async function loadState(quiet = false) {
    const nextState = await getJSON<VOperatorAppState>('/api/v/state');
    startTransition(() => {
      setState(nextState);
    });
    if (!quiet) {
      setMessage(null);
    }
  }

  function selectTab(tab: VOperatorAppTab) {
    setCurrentTab(tab);
    const next = new URLSearchParams(window.location.search);
    next.set('tab', tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function runAction(actionKey: string, action: () => Promise<void>, successText?: string) {
    setBusyAction(actionKey);
    try {
      await action();
      await loadState(true);
      if (successText) {
        setMessage({ text: successText, variant: 'info' });
      }
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : 'The action failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnect(nextTab: VOperatorAppTab = currentTab) {
    setBusyAction('connect');
    try {
      const result = await getJSON<{ authorizeUrl: string }>('/api/v/twitch/connect', {
        method: 'POST',
        body: JSON.stringify({ next: `/v?tab=${nextTab}` }),
      });
      window.location.assign(result.authorizeUrl);
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : 'Unable to start Twitch auth.',
        variant: 'error',
      });
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    await runAction('disconnect', async () => {
      await getJSON('/api/v/twitch/disconnect', {
        method: 'POST',
      });
    }, 'Twitch disconnected. Reconnect before the next session starts.');
  }

  function copyOverlayUrl() {
    if (!giveaway.connection.overlayUrl) return;
    void navigator.clipboard.writeText(giveaway.connection.overlayUrl);
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

  async function handleClearCache() {
    setBusyAction('clear-cache');
    try {
      const result = await getJSON<{
        removedCount: number;
        importedCount: number;
        pendingCount: number;
      }>('/api/v/giveaways/twitch/cache/clear', {
        method: 'POST',
      });

      const parts: string[] = [];
      if (result.removedCount > 0) {
        parts.push(`removed ${result.removedCount} stale turn${result.removedCount === 1 ? '' : 's'}`);
      }
      if (result.importedCount > 0) {
        parts.push(`restored ${result.importedCount} Twitch redemption${result.importedCount === 1 ? '' : 's'}`);
      }

      await loadState(true);
      setMessage({
        text: parts.length > 0
          ? `Cache cleared: ${parts.join(', ')}. ${result.pendingCount} pending turn${result.pendingCount === 1 ? '' : 's'} remain.`
          : 'Cache cleared. Local giveaway state already matched Twitch.',
        variant: 'info',
      });
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : 'Unable to clear the giveaway cache.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function startTurn(turnId: number, viewerName: string) {
    setDraftSelections([]);
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
    }, 'Turn completed and Twitch redemption fulfilled.');
  }

  const recentResultItems = useMemo(() => (
    giveaway.recentResults.map((turn) => ({
      title: turn.viewer.displayName,
      meta: `${turn.result.toUpperCase()} - ${formatDate(turn.completedAt ?? turn.createdAt)}`,
      body: resultCopy(turn),
    }))
  ), [giveaway.recentResults]);

  return (
    <div className={styles.appShell}>
      <header className={styles.topbar}>
        <div className={styles.topbarCopy}>
          <p className={styles.eyebrow}>Ghosted operator app</p>
          <h1 className={styles.pageTitle}>Stream control</h1>
          <p className={styles.pageSummary}>{topStatus}</p>
        </div>

        <div className={styles.topbarStats}>
          <div className={styles.topbarStat}>
            <span className={styles.topbarLabel}>Channel</span>
            <strong>{connection?.displayName ?? 'Not linked'}</strong>
          </div>
          <div className={styles.topbarStat}>
            <span className={styles.topbarLabel}>Queue</span>
            <strong>{queueCount} waiting</strong>
          </div>
          <div className={styles.topbarStat}>
            <span className={styles.topbarLabel}>Webhooks</span>
            <strong>{giveaway.connection.eventSub.status ?? 'Unsynced'}</strong>
          </div>
        </div>

        <div className={styles.topbarActions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              if (giveaway.connection.connected) {
                selectTab('live');
              } else {
                void handleConnect('setup');
              }
            }}
            disabled={busyAction === 'connect'}
          >
            {busyAction === 'connect' ? 'Redirecting...' : giveaway.connection.connected ? 'Open live board' : 'Connect Twitch'}
          </button>
          <Link className={styles.secondaryButton} href="/v/host">
            Host
          </Link>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!giveaway.connection.overlayUrl}
            onClick={copyOverlayUrl}
          >
            Copy overlay
          </button>
        </div>
      </header>

      <nav className={styles.tabRail} aria-label="Operator modes">
        {APP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === currentTab ? styles.tabButtonActive : styles.tabButton}
            onClick={() => selectTab(tab)}
          >
            {tab === 'live' ? 'Live' : tab === 'queue' ? 'Queue' : tab === 'setup' ? 'Setup' : 'Diagnostics'}
          </button>
        ))}
      </nav>

      {message ? (
        <section className={message.variant === 'error' ? styles.bannerError : styles.bannerInfo}>
          {message.text}
        </section>
      ) : null}

      {currentTab === 'live' ? (
        <section className={styles.liveLayout}>
          <div className={styles.boardStage}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Live board</p>
                <h2>{activeTurn ? activeTurn.viewer.displayName : queueCount > 0 ? 'Queue ready' : 'No active turn'}</h2>
              </div>
              <span className={styles.inlineMeta}>
                {activeTurn
                  ? activeTurn.result === 'pending'
                    ? 'Turn in progress'
                    : activeTurn.result.toUpperCase()
                  : queueCount > 0
                    ? `${queueCount} queued`
                    : 'Idle'}
              </span>
            </div>

            {activeTurn ? (
              <>
                <div className={styles.boardShell}>
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
                </div>

                <div className={styles.controlCluster}>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={activeTurn.board?.allSelectionsLocked || draftSelections.length !== 3 || busyAction === 'lock'}
                    onClick={() => {
                      void lockSelections();
                    }}
                  >
                    {busyAction === 'lock' ? 'Locking...' : 'Lock selections'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={!activeTurn.board?.allSelectionsLocked || activeTurn.board.remainingReveals === 0 || busyAction === 'reveal'}
                    onClick={() => {
                      void revealNext();
                    }}
                  >
                    {busyAction === 'reveal' ? 'Opening...' : 'Reveal next'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={activeTurn.board?.revealedChests.length !== 3 || busyAction === 'complete'}
                    onClick={() => {
                      void completeTurn();
                    }}
                  >
                    {busyAction === 'complete' ? 'Completing...' : 'Complete turn'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.emptyStage}>
                <strong>{queueCount > 0 ? 'Start the next queued redemption.' : 'Waiting for a new redemption.'}</strong>
                <p>
                  {queueCount > 0
                    ? 'The board is clear and ready. Kick off the next viewer when stream timing is right.'
                    : 'New Twitch redemptions will appear here automatically.'}
                </p>
                {giveaway.queue[0] ? (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={busyAction === `start-${giveaway.queue[0].id}`}
                    onClick={() => {
                      void startTurn(giveaway.queue[0].id, giveaway.queue[0].viewer.displayName);
                    }}
                  >
                    {busyAction === `start-${giveaway.queue[0].id}` ? 'Starting...' : `Start ${giveaway.queue[0].viewer.displayName}`}
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <aside className={styles.sidePanel}>
            <section className={styles.sideSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Up next</p>
                  <h3>Queue</h3>
                </div>
                <span className={styles.inlineMeta}>{queueCount}</span>
              </div>
              <div className={styles.rowList}>
                {giveaway.queue.length > 0 ? giveaway.queue.slice(0, 4).map((turn, index) => (
                  <article key={turn.id} className={styles.rowCard}>
                    <div className={styles.rowMain}>
                      <strong>{turn.viewer.displayName}</strong>
                      <span>@{turn.viewer.login} - {index === 0 ? 'Next up' : `Queue #${index + 1}`}</span>
                    </div>
                    <button
                      className={styles.ghostButton}
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
                  <article className={styles.rowCard}>
                    <div className={styles.rowMain}>
                      <strong>Queue clear</strong>
                      <span>New redemptions will land here automatically.</span>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className={styles.sideSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Session tools</p>
                  <h3>Quick access</h3>
                </div>
              </div>
              <div className={styles.utilityStack}>
                <Link className={styles.secondaryButton} href="/v/host">
                  Open host
                </Link>
                <button className={styles.secondaryButton} type="button" onClick={copyOverlayUrl} disabled={!giveaway.connection.overlayUrl}>
                  Copy public overlay
                </button>
                <button className={styles.secondaryButton} type="button" onClick={() => selectTab('setup')}>
                  Open setup
                </button>
              </div>
            </section>
          </aside>
        </section>
      ) : null}

      {currentTab === 'queue' ? (
        <section className={styles.splitLayout}>
          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Queue</p>
                <h2>Pending turns</h2>
              </div>
              <span className={styles.inlineMeta}>{queueCount} waiting</span>
            </div>
            <div className={styles.rowList}>
              {giveaway.queue.length > 0 ? giveaway.queue.map((turn, index) => (
                <article key={turn.id} className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>{turn.viewer.displayName}</strong>
                    <span>@{turn.viewer.login} - {formatDate(turn.redeemedAt)} - {index === 0 ? 'Next up' : `Queue #${index + 1}`}</span>
                    {turn.userInput ? <p className={styles.rowDetail}>Viewer input: {turn.userInput}</p> : null}
                  </div>
                  <button
                    className={styles.ghostButton}
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
                <article className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>No queued Twitch redemptions yet</strong>
                    <span>The queue will populate automatically during stream.</span>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>History</p>
                <h2>Recent results</h2>
              </div>
            </div>
            <div className={styles.rowList}>
              {recentResultItems.length > 0 ? recentResultItems.map((item) => (
                <article key={`${item.title}-${item.meta}`} className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                    <p className={styles.rowDetail}>{item.body}</p>
                  </div>
                </article>
              )) : (
                <article className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>No completed turns yet</strong>
                    <span>Resolved runs will land here after the first session finishes.</span>
                  </div>
                </article>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {currentTab === 'setup' ? (
        <section className={styles.splitLayout}>
          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Broadcaster</p>
                <h2>Twitch setup</h2>
              </div>
              <span className={styles.inlineMeta}>{connection ? connection.displayName : 'Not linked'}</span>
            </div>

            <div className={styles.metricRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>OAuth</span>
                <strong>{platform.config.oauthReady ? 'Ready' : 'Missing'}</strong>
                <span>{connection?.connected ? 'Broadcaster linked' : 'Connect Twitch to continue'}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Webhooks</span>
                <strong>{platform.config.eventSubReady ? 'Ready' : 'Missing'}</strong>
                <span>{giveaway.connection.eventSub.status ?? 'Waiting for sync'}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Scopes</span>
                <strong>{connection?.scopes.length ?? 0}</strong>
                <span>{connection?.tokenExpiresAt ? `Token ${formatDate(connection.tokenExpiresAt)}` : 'No token expiry recorded'}</span>
              </div>
            </div>

            <div className={styles.actionBar}>
              <button className={styles.primaryButton} type="button" onClick={() => { void handleConnect('setup'); }} disabled={busyAction === 'connect'}>
                {busyAction === 'connect' ? 'Redirecting...' : connection ? 'Reconnect Twitch' : 'Connect Twitch'}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => { void handleDisconnect(); }} disabled={!connection || busyAction === 'disconnect'}>
                {busyAction === 'disconnect' ? 'Disconnecting...' : 'Disconnect Twitch'}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={!connection || busyAction === 'sync-subscriptions'}
                onClick={() => {
                  void runAction('sync-subscriptions', async () => {
                    await getJSON('/api/v/twitch/subscriptions/sync', { method: 'POST' });
                  }, 'Subscriptions synced.');
                }}
              >
                {busyAction === 'sync-subscriptions' ? 'Syncing...' : 'Sync subscriptions'}
              </button>
            </div>
          </section>

          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Managed reward</p>
                <h2>Giveaway setup</h2>
              </div>
              <span className={styles.inlineMeta}>{giveaway.connection.reward.isPaused ? 'Paused' : 'Live'}</span>
            </div>

            <form className={styles.formStack} onSubmit={handleRewardSync}>
              <label className={styles.formField}>
                <span>Reward title</span>
                <input
                  className={styles.input}
                  value={rewardForm.title}
                  onChange={(event) => setRewardForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span>Reward prompt</span>
                  <textarea
                    className={styles.textarea}
                    value={rewardForm.prompt}
                    onChange={(event) => setRewardForm((current) => ({ ...current, prompt: event.target.value }))}
                  />
                </label>

                <label className={styles.formField}>
                  <span>Reward cost</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={rewardForm.cost}
                    onChange={(event) => setRewardForm((current) => ({ ...current, cost: event.target.value }))}
                  />
                </label>
              </div>

              <div className={styles.formField}>
                <span>Public overlay URL</span>
                <div className={styles.overlayRow}>
                  <input className={styles.input} readOnly value={giveaway.connection.overlayUrl ?? 'Overlay URL will appear after setup.'} />
                  <button className={styles.secondaryButton} type="button" onClick={copyOverlayUrl} disabled={!giveaway.connection.overlayUrl}>
                    Copy
                  </button>
                </div>
              </div>

              <div className={styles.actionBar}>
                <button className={styles.primaryButton} type="submit" disabled={busyAction === 'reward-sync'}>
                  {busyAction === 'reward-sync' ? 'Syncing...' : 'Sync reward'}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!rewardReady || busyAction === 'reward-pause'}
                  onClick={() => {
                    void runAction('reward-pause', async () => {
                      await getJSON('/api/v/giveaways/twitch/reward/pause', {
                        method: 'POST',
                        body: JSON.stringify({ paused: !giveaway.connection.reward.isPaused }),
                      });
                    }, giveaway.connection.reward.isPaused ? 'Reward resumed.' : 'Reward paused.');
                  }}
                >
                  {busyAction === 'reward-pause'
                    ? 'Updating...'
                    : giveaway.connection.reward.isPaused
                      ? 'Resume reward'
                      : 'Pause reward'}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={!rewardReady || !giveaway.connection.connected || busyAction === 'clear-cache'}
                  onClick={() => {
                    void handleClearCache();
                  }}
                >
                  {busyAction === 'clear-cache' ? 'Clearing...' : 'Clear cache'}
                </button>
              </div>
            </form>
          </section>
        </section>
      ) : null}

      {currentTab === 'diagnostics' ? (
        <section className={styles.splitLayout}>
          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Platform</p>
                <h2>Modules and subscriptions</h2>
              </div>
            </div>

            <div className={styles.rowList}>
              {platform.modules.map((module) => (
                <article key={module.key} className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>{module.label}</strong>
                    <span>{module.summary}</span>
                    <p className={styles.rowDetail}>{module.chips.join(' - ')}</p>
                  </div>
                </article>
              ))}

              {platform.subscriptions.map((subscription) => (
                <article key={subscription.id} className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>{subscription.subscriptionType}</strong>
                    <span>{subscription.status}</span>
                    <p className={styles.rowDetail}>
                      Broadcaster: {subscription.broadcasterUserId ?? 'n/a'} · Callback: {subscription.callbackUrl ?? 'n/a'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.surfacePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionLabel}>Ingress</p>
                <h2>Recent deliveries</h2>
              </div>
            </div>

            <div className={styles.rowList}>
              {platform.recentDeliveries.length > 0 ? platform.recentDeliveries.map((delivery) => (
                <article key={delivery.messageId} className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>{delivery.messageType}</strong>
                    <span>{delivery.processingStatus} · {formatDate(delivery.receivedAt)}</span>
                    <p className={styles.rowDetail}>
                      Subscription: {delivery.subscriptionType ?? 'unknown'}
                      {delivery.lastError ? ` · ${delivery.lastError}` : ''}
                    </p>
                  </div>
                </article>
              )) : (
                <article className={styles.rowCard}>
                  <div className={styles.rowMain}>
                    <strong>No deliveries yet</strong>
                    <span>Accepted Twitch notifications will appear here after the first verification or redemption.</span>
                  </div>
                </article>
              )}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
