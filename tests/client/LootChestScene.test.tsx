/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LootChestScene } from '@/app/v/giveaways/LootChestScene';
import type { LootChestBoard, LootChestBoardChest, LootChestTurn, TwitchRewardConnectionState } from '@/lib/types';

const reward: TwitchRewardConnectionState['reward'] = {
  id: 'reward-1',
  title: 'Loot Chest Spin',
  prompt: 'Redeem for a host-run Ghosted loot chest turn.',
  cost: 1000,
  isPaused: false,
  isEnabled: true,
};

function makeBoard(
  overrides: Partial<LootChestBoard> = {},
  chestOverrides: Partial<Record<number, Partial<LootChestBoardChest>>> = {},
): LootChestBoard {
  const selectedChests = overrides.selectedChests ?? [];
  const revealedChests = overrides.revealedChests ?? [];
  const boardRevision = overrides.boardRevision ?? 1;
  const phase = overrides.phase ?? 'selection';
  const lastChangedChestIndex = overrides.lastChangedChestIndex ?? null;
  const activeAnimationChestIndex = overrides.activeAnimationChestIndex ?? null;
  const lastAction = overrides.lastAction ?? 'turn_started';

  return {
    totalChests: 10,
    selectionLimit: 3,
    phase,
    boardRevision,
    prizeChestIndex: overrides.prizeChestIndex ?? null,
    selectedChests,
    revealedChests,
    remainingSelections: overrides.remainingSelections ?? Math.max(0, 3 - selectedChests.length),
    remainingReveals: overrides.remainingReveals ?? Math.max(0, selectedChests.length - revealedChests.length),
    prizeFound: overrides.prizeFound ?? false,
    allSelectionsLocked: overrides.allSelectionsLocked ?? selectedChests.length === 3,
    lastAction,
    lastActionAt: overrides.lastActionAt ?? '2026-04-14T19:30:00.000Z',
    lastChangedChestIndex,
    activeAnimationChestIndex,
    chests: Array.from({ length: 10 }, (_, index) => ({
      index,
      label: String(index + 1),
      selected: selectedChests.includes(index),
      revealed: revealedChests.includes(index),
      containsPrize: Boolean((overrides.prizeChestIndex ?? null) === index && (revealedChests.includes(index) || overrides.prizeFound)),
      revealState: revealedChests.includes(index)
        ? ((overrides.prizeChestIndex ?? null) === index ? 'prize' : 'empty')
        : (selectedChests.includes(index) ? 'selected' : 'closed'),
      spriteState: revealedChests.includes(index)
        ? ((overrides.prizeChestIndex ?? null) === index ? 'prize' : 'empty')
        : (selectedChests.includes(index) ? 'selected' : 'closed'),
      animationState: selectedChests.includes(index) ? 'pulse' : 'idle',
      revealCue: lastChangedChestIndex === index && lastAction === 'chest_revealed',
      ...chestOverrides[index],
    })),
  };
}

function makeTurn(overrides: Partial<LootChestTurn> = {}): LootChestTurn {
  return {
    id: overrides.id ?? 7,
    redemptionId: overrides.redemptionId ?? 'redemption-7',
    rewardId: overrides.rewardId ?? 'reward-1',
    status: overrides.status ?? 'active',
    result: overrides.result ?? 'pending',
    redeemedAt: overrides.redeemedAt ?? '2026-04-14T19:30:00.000Z',
    createdAt: overrides.createdAt ?? '2026-04-14T19:30:00.000Z',
    startedAt: overrides.startedAt ?? '2026-04-14T19:31:00.000Z',
    completedAt: overrides.completedAt ?? null,
    phase: overrides.phase ?? 'selection',
    lastAction: overrides.lastAction ?? 'turn_started',
    lastActionAt: overrides.lastActionAt ?? '2026-04-14T19:31:00.000Z',
    resolutionCue: overrides.resolutionCue ?? null,
    userInput: overrides.userInput ?? null,
    viewer: overrides.viewer ?? {
      twitchId: 'viewer-1',
      login: 'viewer_login',
      displayName: 'Viewer Login',
    },
    board: overrides.board ?? makeBoard(),
  };
}

describe('LootChestScene', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the host scene with interactive draft chest selections', () => {
    const onToggleSelection = vi.fn();
    const board = makeBoard({
      phase: 'selection',
      selectedChests: [],
      revealedChests: [],
      allSelectionsLocked: false,
      remainingSelections: 3,
      remainingReveals: 0,
    });

    const { container } = render(
      <LootChestScene
        turn={makeTurn({ board, phase: 'selection' })}
        queueCount={2}
        reward={reward}
        variant="host"
        draftSelections={[0, 2]}
        onToggleSelection={onToggleSelection}
      />,
    );

    const firstChest = container.querySelector('[data-chest-index="0"]') as HTMLButtonElement | null;
    const thirdChest = container.querySelector('[data-chest-index="2"]') as HTMLButtonElement | null;
    const fifthChest = container.querySelector('[data-chest-index="4"]') as HTMLButtonElement | null;

    expect(firstChest?.getAttribute('data-sprite-state')).toBe('selected');
    expect(thirdChest?.getAttribute('data-sprite-state')).toBe('selected');
    expect(fifthChest?.disabled).toBe(false);

    fireEvent.click(fifthChest!);
    expect(onToggleSelection).toHaveBeenCalledWith(4);
  });

  it('animates the revealed chest when the board revision advances', async () => {
    const lockedBoard = makeBoard({
      phase: 'locked',
      boardRevision: 2,
      selectedChests: [1, 4, 8],
      revealedChests: [],
      allSelectionsLocked: true,
      remainingSelections: 0,
      remainingReveals: 3,
      lastAction: 'chests_selected',
    }, {
      1: { spriteState: 'locked', animationState: 'idle' },
      4: { spriteState: 'locked', animationState: 'idle' },
      8: { spriteState: 'locked', animationState: 'idle' },
    });

    const { container, rerender } = render(
      <LootChestScene
        turn={makeTurn({
          board: lockedBoard,
          phase: 'locked',
          lastAction: 'chests_selected',
        })}
        queueCount={1}
        reward={reward}
        variant="overlay"
      />,
    );

    rerender(
      <LootChestScene
        turn={makeTurn({
          board: makeBoard({
            phase: 'revealing',
            boardRevision: 3,
            selectedChests: [1, 4, 8],
            revealedChests: [1],
            allSelectionsLocked: true,
            remainingSelections: 0,
            remainingReveals: 2,
            lastAction: 'chest_revealed',
            lastChangedChestIndex: 1,
            activeAnimationChestIndex: 1,
          }, {
            1: { revealed: true, spriteState: 'opening', animationState: 'opening', revealCue: true },
            4: { spriteState: 'locked', animationState: 'idle' },
            8: { spriteState: 'locked', animationState: 'idle' },
          }),
          phase: 'revealing',
          lastAction: 'chest_revealed',
        })}
        queueCount={1}
        reward={reward}
        variant="overlay"
      />,
    );

    await waitFor(() => {
      const revealedChest = container.querySelector('[data-chest-index="1"]');
      expect(revealedChest?.getAttribute('data-active-animation')).toBe('true');
      expect(revealedChest?.getAttribute('data-animation-state')).toBe('opening');
    });
  });

  it('shows the result burst when a resolved board arrives on a new revision', async () => {
    const { container, rerender } = render(
      <LootChestScene
        turn={makeTurn({
          board: makeBoard({
            phase: 'revealing',
            boardRevision: 4,
            selectedChests: [1, 4, 8],
            revealedChests: [1, 4],
            allSelectionsLocked: true,
            remainingSelections: 0,
            remainingReveals: 1,
            lastAction: 'chest_revealed',
            lastChangedChestIndex: 4,
            activeAnimationChestIndex: 4,
            prizeChestIndex: 4,
          }),
          phase: 'revealing',
          lastAction: 'chest_revealed',
        })}
        queueCount={0}
        reward={reward}
        variant="overlay"
      />,
    );

    rerender(
      <LootChestScene
        turn={makeTurn({
          status: 'completed',
          result: 'win',
          phase: 'resolved',
          lastAction: 'turn_completed',
          completedAt: '2026-04-14T19:33:00.000Z',
          resolutionCue: {
            result: 'win',
            highlightChestIndex: 4,
          },
          board: makeBoard({
            phase: 'resolved',
            boardRevision: 5,
            selectedChests: [1, 4, 8],
            revealedChests: [1, 4, 8],
            allSelectionsLocked: true,
            remainingSelections: 0,
            remainingReveals: 0,
            prizeFound: true,
            lastAction: 'turn_completed',
            lastChangedChestIndex: 4,
            prizeChestIndex: 4,
          }, {
            1: { revealed: true, spriteState: 'resolved-empty', animationState: 'settled' },
            4: { revealed: true, spriteState: 'resolved-prize', animationState: 'burst' },
            8: { revealed: true, spriteState: 'resolved-empty', animationState: 'settled' },
          }),
        })}
        queueCount={0}
        reward={reward}
        variant="overlay"
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-result-cue="true"]')).not.toBeNull();
    });
  });
});
