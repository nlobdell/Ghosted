'use client';

import { startTransition, useEffect, useState } from 'react';
import { getJSON } from '@/lib/api';
import type { LootChestOverlayState } from '@/lib/types';
import { LootChestScene } from '../LootChestScene';
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
      <LootChestScene
        turn={focusTurn}
        queueCount={state.queueCount}
        reward={state.connection.reward}
        variant="overlay"
      />
    </main>
  );
}
