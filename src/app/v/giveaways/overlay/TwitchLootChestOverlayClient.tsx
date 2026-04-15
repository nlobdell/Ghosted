'use client';

import { startTransition, useEffect, useState } from 'react';
import { formatDate, getJSON } from '@/lib/api';
import type { LootChestOverlayState } from '@/lib/types';
import { LootChestBoardView } from '../LootChestBoard';
import styles from './overlay.module.css';

export default function TwitchLootChestOverlayClient({
  initialState,
  overlayToken,
}: {
  initialState: LootChestOverlayState;
  overlayToken: string;
}) {
  const [state, setState] = useState(initialState);
  const activeTurn = state.activeTurn;
  const focusTurn = activeTurn ?? state.lastResolvedTurn;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void (async () => {
        const nextState = await getJSON<LootChestOverlayState>(`/api/v/giveaways/state?overlayToken=${encodeURIComponent(overlayToken)}`);
        startTransition(() => {
          setState(nextState);
        });
      })();
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [overlayToken]);

  return (
    <main className={styles.overlayPage}>
      <section className={styles.hero}>
        <p className="kicker">Ghosted loot chest</p>
        <h1 className={styles.headline}>
          {activeTurn
            ? `${activeTurn.viewer.displayName} is on the board`
            : state.lastResolvedTurn
              ? `${state.lastResolvedTurn.viewer.displayName} just finished a turn`
              : 'Waiting for the next turn'}
        </h1>
        <p>
          {activeTurn
            ? `${state.queueCount} more queued after this turn. Reward: ${state.connection.reward.title}.`
            : state.queueCount > 0
              ? `${state.queueCount} queued turn${state.queueCount === 1 ? '' : 's'} waiting for the host.`
              : 'Queue is empty right now.'}
        </p>
      </section>

      {focusTurn ? (
        <>
          <section className={`${styles.statusBar} ${focusTurn.result === 'win' ? styles.statusWin : focusTurn.result === 'miss' ? styles.statusMiss : ''}`}>
            <span className={styles.label}>Turn status</span>
            <strong>
              {focusTurn.result === 'win'
                ? `${focusTurn.viewer.displayName} found the prize chest`
                : focusTurn.result === 'miss'
                  ? `${focusTurn.viewer.displayName} missed the prize chest`
                  : `${focusTurn.viewer.displayName} is revealing chests`}
            </strong>
          </section>

          <section className={styles.metaStrip}>
            <article className={styles.metaCard}>
              <span className={styles.label}>Viewer</span>
              <strong>{focusTurn.viewer.displayName}</strong>
              <span>@{focusTurn.viewer.login}</span>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.label}>Queue</span>
              <strong>{state.queueCount}</strong>
              <span>turns waiting</span>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.label}>Reward</span>
              <strong>{state.connection.reward.title}</strong>
              <span>{state.connection.reward.cost.toLocaleString()} points</span>
            </article>
          </section>

          <section className={styles.stage}>
            <LootChestBoardView board={focusTurn.board} compact />
          </section>

          <section className={styles.statusBar}>
            <span className={styles.label}>Updated</span>
            <strong>{formatDate(focusTurn.completedAt ?? focusTurn.startedAt ?? focusTurn.createdAt)}</strong>
          </section>
        </>
      ) : (
        <section className={styles.statusBar}>
          <span className={styles.label}>Stand by</span>
          <strong>The host has not started a loot chest turn yet.</strong>
        </section>
      )}
    </main>
  );
}
