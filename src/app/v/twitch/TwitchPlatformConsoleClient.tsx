'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import {
  AppContext,
  Banner,
  EmptyState,
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
        summary="Broadcaster auth, EventSub health, and module routing for Ghosted stream tooling."
      />

      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <section className={styles.toolbar}>
        <div className={styles.toolbarCopy}>
          <p className={styles.eyebrow}>Control plane</p>
          <h2>{connection ? `Connected to ${connection.displayName}` : 'Broadcaster not connected'}</h2>
          <p>
            {connection
              ? `${subscriptionCount} subscription${subscriptionCount === 1 ? '' : 's'} tracked and ${deliveryCount} recent deliver${deliveryCount === 1 ? 'y' : 'ies'} logged.`
              : 'Connect the shared Ghosted broadcaster before syncing EventSub or opening modules.'}
          </p>
        </div>

        <div className={styles.toolbarActions}>
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
        </div>
      </section>

      <section className={styles.statusBoard}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>App auth</span>
          <strong className={styles.statusValue}>{state.config.oauthReady ? 'Ready' : 'Missing'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Webhooks</span>
          <strong className={styles.statusValue}>{state.config.eventSubReady ? 'Ready' : 'Missing'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Operators</span>
          <strong className={styles.statusValue}>{state.config.operatorAllowlistConfigured ? 'Allowlisted' : 'Setup needed'}</strong>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Channel</span>
          <strong className={styles.statusValue}>{connection ? connection.displayName : 'Not connected'}</strong>
        </div>
      </section>

      <div className={styles.workspace}>
        <div className={styles.column}>
          <Panel
            title="Broadcaster connection"
            eyebrow="Auth"
            body={connection ? (
              <div className={styles.stackList}>
                <SectionHeading
                  title={connection.displayName}
                  copy={`@${connection.login} is the active broadcaster for the shared Ghosted Twitch app.`}
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
                    <span className={styles.smallLabel}>Webhook callback</span>
                    <strong>{state.config.callbackUrl ? 'Configured' : 'Missing'}</strong>
                    <span>{state.config.callbackUrl ?? 'AUTH_URL or PUBLIC_BASE_URL is required.'}</span>
                  </article>
                </div>
              </div>
            ) : (
              <EmptyState message="No broadcaster is connected yet." />
            )}
          />

          <Panel
            title="EventSub subscriptions"
            eyebrow="Subscriptions"
            body={state.subscriptions.length > 0 ? (
              <div className={styles.cardList}>
                {state.subscriptions.map((subscription) => (
                  <article key={subscription.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{subscription.subscriptionType}</strong>
                      <span className={styles.recordState}>{subscription.status}</span>
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
              <EmptyState message="Subscriptions will appear here after the broadcaster is connected and the modules are synced." />
            )}
          />
        </div>

        <div className={styles.stack}>
          <Panel
            title="Recent deliveries"
            eyebrow="Ingress"
            body={state.recentDeliveries.length > 0 ? (
              <div className={styles.cardList}>
                {state.recentDeliveries.map((delivery) => (
                  <article key={delivery.messageId} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{delivery.messageType}</strong>
                      <span className={styles.recordState}>{delivery.processingStatus}</span>
                    </div>
                    <p className={styles.metaLine}>Subscription: {delivery.subscriptionType ?? 'unknown'}</p>
                    <p className={styles.metaLine}>Received: {formatDate(delivery.receivedAt)}</p>
                    {delivery.processedAt ? <p className={styles.metaLine}>Processed: {formatDate(delivery.processedAt)}</p> : null}
                    {delivery.lastError ? <p className={styles.errorLine}>{delivery.lastError}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="Accepted Twitch deliveries will appear here after the first verification or notification." />
            )}
          />

          <Panel
            title="Modules"
            eyebrow="Feature health"
            body={state.modules.length > 0 ? (
              <div className={styles.cardList}>
                {state.modules.map((module) => (
                  <article key={module.key} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{module.label}</strong>
                      <span className={styles.recordState}>{module.status}</span>
                    </div>
                    <p>{module.summary}</p>
                    <p className={styles.metaLine}>{module.chips.join(' - ')}</p>
                    <Link className={styles.inlineLink} href={module.href}>Open module</Link>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="No Twitch modules are registered yet." />
            )}
          />
        </div>
      </div>
    </>
  );
}
