'use client';

import { startTransition, useState } from 'react';
import { getJSON } from '@/lib/api';
import type { LootChestOverlayState, LootChestPresentationCue } from '@/lib/types';
import { LootChestScene } from '../LootChestScene';
import { useGiveawayBuildSync } from '../useGiveawayBuildSync';
import { useLootChestSceneTransport } from '../useLootChestSceneTransport';
import styles from './overlay.module.css';

function normalizeSelectedChests(value: number[] | null | undefined) {
  return Array.isArray(value)
    ? value.filter((entry, index, current) => Number.isInteger(entry) && current.indexOf(entry) === index)
    : [];
}

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
  const [mirroredSelections, setMirroredSelections] = useState<number[]>([]);
  useGiveawayBuildSync(buildId);

  const activeTurn = state.scene.focusTurn;
  const activeBoard = activeTurn?.board ?? null;
  const effectiveMirroredSelections = activeTurn && activeBoard && !activeBoard.allSelectionsLocked && activeBoard.revealedChests.length === 0
    ? mirroredSelections
    : [];
  const showInlineLockAction = Boolean(
    activeTurn
    && activeBoard
    && !activeBoard.allSelectionsLocked
    && activeBoard.revealedChests.length === 0
    && effectiveMirroredSelections.length === activeBoard.selectionLimit,
  );

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
        if (!nextCue) {
          setPresentationCue(null);
          return;
        }

        if (nextCue.selectedChests !== undefined) {
          setMirroredSelections(normalizeSelectedChests(nextCue.selectedChests));
        } else if (nextCue.kind === 'clear') {
          setMirroredSelections([]);
        }

        if (nextCue.kind === 'selection') {
          setPresentationCue(null);
          return;
        }

        if (nextCue.kind === 'clear') {
          setPresentationCue(null);
          return;
        }

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
        draftSelections={effectiveMirroredSelections}
        boardAction={showInlineLockAction ? {
          label: 'Lock',
          onClick: () => {},
          disabled: true,
        } : null}
      />
    </main>
  );
}
