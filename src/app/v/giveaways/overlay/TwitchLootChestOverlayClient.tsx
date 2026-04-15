'use client';

import { startTransition, useState } from 'react';
import { getJSON } from '@/lib/api';
import type { LootChestOverlayState, LootChestPresentationCue } from '@/lib/types';
import { LootChestScene } from '../LootChestScene';
import { useGiveawayBuildSync } from '../useGiveawayBuildSync';
import { useLootChestSceneTransport } from '../useLootChestSceneTransport';
import styles from './overlay.module.css';

export default function TwitchLootChestOverlayClient({
  initialState,
  overlayToken,
  buildId,
}: {
  initialState: LootChestOverlayState;
  overlayToken: string;
  buildId: string;
}) {
  const [state, setState] = useState(initialState);
  const [presentationCue, setPresentationCue] = useState<LootChestPresentationCue | null>(null);
  useGiveawayBuildSync(buildId);

  useLootChestSceneTransport({
    overlayToken,
    currentScene: state.scene,
    currentCue: presentationCue,
    fetchState: () => getJSON<LootChestOverlayState>(`/api/v/giveaways/state?overlayToken=${encodeURIComponent(overlayToken)}`),
    applyState: (nextState) => {
      startTransition(() => {
        setState(nextState);
      });
    },
    applyScene: (nextScene) => {
      startTransition(() => {
        setState((current) => ({ ...current, scene: nextScene }));
      });
    },
    applyCue: (nextCue) => {
      startTransition(() => {
        setPresentationCue(nextCue);
      });
    },
  });

  return (
    <main className={styles.overlayPage}>
      <LootChestScene
        scene={state.scene}
        presentationCue={presentationCue}
        frame="board-only"
        boardSizing="viewport"
        assetVersion={buildId}
      />
    </main>
  );
}
