'use client';

import type { LootChestBoard } from '@/lib/types';
import styles from './loot-chest-ui.module.css';

export function LootChestBoardView({
  board,
  draftSelections,
  onToggleSelection,
  compact = false,
}: {
  board: LootChestBoard | null | undefined;
  draftSelections?: number[];
  onToggleSelection?: (index: number) => void;
  compact?: boolean;
}) {
  if (!board) return null;

  const canPick = Boolean(onToggleSelection && !board.allSelectionsLocked && board.revealedChests.length === 0);
  const selectedSet = new Set(canPick ? (draftSelections ?? []) : board.selectedChests);

  return (
    <div className={styles.board}>
      <div className={styles.boardMeta}>
        <span className={styles.boardMetaItem}>{selectedSet.size} / {board.selectionLimit} chests selected</span>
        <span className={styles.boardMetaItem}>{board.revealedChests.length} revealed</span>
        <span className={styles.boardMetaItem}>{board.prizeFound ? 'Prize found' : 'Prize still hidden'}</span>
      </div>

      <div className={`${styles.boardGrid} ${compact ? styles.boardGridCompact : ''}`}>
        {board.chests.map((chest) => {
          const selected = selectedSet.has(chest.index);
          const revealState = chest.revealed
            ? chest.revealState
            : selected
              ? 'selected'
              : 'closed';
          const className = [
            styles.chest,
            canPick ? styles.chestInteractive : '',
            revealState === 'selected' ? styles.chestSelected : '',
            revealState === 'empty' ? styles.chestRevealed : '',
            revealState === 'prize' ? styles.chestPrize : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={chest.index}
              type="button"
              className={className}
              disabled={!canPick}
              onClick={() => onToggleSelection?.(chest.index)}
            >
              <span className={styles.chestNumber}>{chest.label}</span>
              <span className={styles.chestLabel}>
                {revealState === 'prize'
                  ? 'Prize'
                  : revealState === 'empty'
                    ? 'Empty'
                    : selected
                      ? 'Locked'
                      : 'Chest'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
