'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import {
  AppContext,
  Banner,
  EmptyState,
  Highlight,
  Panel,
  SectionHeading,
} from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { TwitchPlatformState } from '@/lib/types';
import styles from './page.module.css';

export default function TwitchPlatformConsoleClient({
  initialState,
  initialMessage,
}: {
  initialState: TwitchPlatformState;
  initialMessage: string | null;
}) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(
    initialMessage ? { text: initialMessage, variant: 'info' } : null,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void (async () => {
        const nextState = await getJSON<TwitchPlatformState>('/api/v/twitch/state');
        startTransition(() => {
          setState(nextState);
        });
      })();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function loadState(quiet = false) {
    const nextState = await getJSON<TwitchPlatformState>('/api/v/twitch/state');
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
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : 'The action failed.',
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
        body: JSON.stringify({ next: '/v/twitch/' }),
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

  const connection = state.connection;
  const deliveryCount = state.recentDeliveries.length;
  const subscriptionCount = state.subscriptions.length;

  return (
    <>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Operator surfaces' },
          { label: 'Twitch platform' },
        ]}
        title="Twitch Platform"
        summary="Manage the shared Ghosted Twitch app, keep broadcaster auth and EventSub healthy, and jump into stream modules like the loot chest giveaway console."
      />

      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <section className={styles.hero}>
        <Highlight
          eyebrow="Control plane"
          title={connection ? `Connected to ${connection.displayName}` : 'Twitch app not connected'}
          copy={connection
            ? 'The Twitch operator home owns the broadcaster connection, EventSub delivery log, and module-level health for Ghosted stream features.'
            : 'Connect the broadcaster account here first, then sync subscriptions and module-specific rewards before going live.'}
          actions={(
            <>
              <button className="button button--small" type="button" onClick={handleConnect} disabled={busyAction === 'connect'}>
                {busyAction === 'connect' ? 'Redirecting...' : connection ? 'Reconnect Twitch' : 'Connect Twitch'}
              </button>
              <button
                className="button button--secondary button--small"
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
              <Link className="button button--secondary button--small" href="/v/giveaways/">
                Open giveaways
              </Link>
            </>
          )}
          stage={{
            label: 'Platform health',
            primary: state.config.oauthReady && state.config.eventSubReady ? 'OAuth and EventSub are configured.' : 'Environment setup is incomplete.',
            secondary: connection
              ? `${subscriptionCount} subscription${subscriptionCount === 1 ? '' : 's'} tracked and ${deliveryCount} recent deliver${deliveryCount === 1 ? 'y' : 'ies'} recorded.`
              : 'No broadcaster token is active yet.',
            chips: [
              state.config.oauthReady ? 'OAuth ready' : 'OAuth missing',
              state.config.eventSubReady ? 'EventSub ready' : 'EventSub missing',
              state.config.operatorAllowlistConfigured ? 'Operator allowlist ready' : 'Operator allowlist missing',
            ],
          }}
        />
      </section>

      <div className={styles.workspace}>
        <div className={styles.column}>
          <Panel
            title="Broadcaster connection"
            eyebrow="Auth"
            body={(
              connection ? (
                <div className={styles.stackList}>
                  <SectionHeading
                    title={connection.displayName}
                    copy={`@${connection.login} is the active broadcaster connection for the shared Ghosted Twitch app.`}
                  />
                  <div className={styles.metricGrid}>
                    <article className={styles.metricCard}>
                      <span className={styles.smallLabel}>Scopes</span>
                      <strong>{connection.scopes.length}</strong>
                      <span>{connection.scopes.join(', ') || 'No scopes recorded'}</span>
                    </article>
                    <article className={styles.metricCard}>
                      <span className={styles.smallLabel}>Token expiry</span>
                      <strong>{connection.tokenExpiresAt ? formatDate(connection.tokenExpiresAt) : 'Unknown'}</strong>
                      <span>{connection.connected ? 'Connected' : 'Reconnect required'}</span>
                    </article>
                    <article className={styles.metricCard}>
                      <span className={styles.smallLabel}>Callback</span>
                      <strong>{state.config.callbackUrl ? 'Configured' : 'Missing'}</strong>
                      <span>{state.config.callbackUrl ?? 'AUTH_URL or PUBLIC_BASE_URL is required.'}</span>
                    </article>
                  </div>
                </div>
              ) : (
                <EmptyState message="No broadcaster is connected yet." />
              )
            )}
          />

          <Panel
            title="EventSub subscriptions"
            eyebrow="Subscriptions"
            chip={`${subscriptionCount} tracked`}
            body={(
              state.subscriptions.length > 0 ? (
                <div className={styles.cardList}>
                  {state.subscriptions.map((subscription) => (
                    <article key={subscription.id} className={styles.recordCard}>
                      <div className={styles.recordHeader}>
                        <strong>{subscription.subscriptionType}</strong>
                        <span className={styles.chip}>{subscription.status}</span>
                      </div>
                      <p className={styles.metaLine}>Module: {subscription.moduleKey}</p>
                      <p className={styles.metaLine}>Broadcaster: {subscription.broadcasterUserId ?? 'n/a'}</p>
                      <p className={styles.metaLine}>Callback: {subscription.callbackUrl ?? 'n/a'}</p>
                      <p className={styles.metaLine}>
                        Last verified: {subscription.lastVerifiedAt ? formatDate(subscription.lastVerifiedAt) : 'Not verified yet'}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState message="Subscriptions will appear here after the broadcaster is connected and the modules have been synced." />
              )
            )}
          />
        </div>

        <div className={styles.stack}>
          <Panel
            title="Recent deliveries"
            eyebrow="Ingress log"
            chip={`${deliveryCount} recent`}
            body={(
              state.recentDeliveries.length > 0 ? (
                <div className={styles.cardList}>
                  {state.recentDeliveries.map((delivery) => (
                    <article key={delivery.messageId} className={styles.recordCard}>
                      <div className={styles.recordHeader}>
                        <strong>{delivery.messageType}</strong>
                        <span className={styles.chip}>{delivery.processingStatus}</span>
                      </div>
                      <p className={styles.metaLine}>Subscription: {delivery.subscriptionType ?? 'unknown'}</p>
                      <p className={styles.metaLine}>Received: {formatDate(delivery.receivedAt)}</p>
                      {delivery.processedAt ? <p className={styles.metaLine}>Processed: {formatDate(delivery.processedAt)}</p> : null}
                      {delivery.lastError ? <p className={styles.errorLine}>{delivery.lastError}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState message="Accepted Twitch deliveries will appear here after the webhook receives its first verification or notification." />
              )
            )}
          />

          <Panel
            title="Modules"
            eyebrow="Feature health"
            chip={`${state.modules.length} loaded`}
            body={(
              state.modules.length > 0 ? (
                <div className={styles.cardList}>
                  {state.modules.map((module) => (
                    <article key={module.key} className={styles.recordCard}>
                      <div className={styles.recordHeader}>
                        <strong>{module.label}</strong>
                        <span className={styles.chip}>{module.status}</span>
                      </div>
                      <p>{module.summary}</p>
                      <p className={styles.metaLine}>{module.chips.join(' - ')}</p>
                      <Link className={styles.inlineLink} href={module.href}>Open module</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState message="No Twitch modules are registered yet." />
              )
            )}
          />
        </div>
      </div>
    </>
  );
}
