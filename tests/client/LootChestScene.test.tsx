/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LootChestScene } from '@/app/v/giveaways/LootChestScene';
import type { LootChestBoard, LootChestBoardChest, LootChestSceneSnapshot, LootChestTurn, TwitchRewardConnectionState } from '@/lib/types';

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

function makeScene(overrides: Partial<LootChestSceneSnapshot> = {}): LootChestSceneSnapshot {
  return {
    revision: overrides.revision ?? 1,
    publishedAt: overrides.publishedAt ?? '2026-04-14T19:31:00.000Z',
    queueCount: overrides.queueCount ?? 0,
    reward: overrides.reward ?? reward,
    focusTurn: overrides.focusTurn ?? null,
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
        scene={makeScene({
          queueCount: 2,
          focusTurn: makeTurn({ board, phase: 'selection' }),
        })}
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

  it('keeps three draft picks in the selected state until the host locks them', () => {
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
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({ board, phase: 'selection' }),
        })}
        draftSelections={[0, 2, 4]}
        onToggleSelection={vi.fn()}
      />,
    );

    const firstChest = container.querySelector('[data-chest-index="0"]');
    const thirdChest = container.querySelector('[data-chest-index="2"]');
    const fifthChest = container.querySelector('[data-chest-index="4"]');

    expect(firstChest?.getAttribute('data-sprite-state')).toBe('selected');
    expect(thirdChest?.getAttribute('data-sprite-state')).toBe('selected');
    expect(fifthChest?.getAttribute('data-sprite-state')).toBe('selected');
  });

  it('can show an inline lock action inside the board when all picks are ready', () => {
    const onLock = vi.fn();
    const board = makeBoard({
      phase: 'selection',
      selectedChests: [],
      revealedChests: [],
      allSelectionsLocked: false,
      remainingSelections: 3,
      remainingReveals: 0,
    });

    const { getByRole } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({ board, phase: 'selection' }),
        })}
        draftSelections={[0, 2, 4]}
        onToggleSelection={vi.fn()}
        boardAction={{
          label: 'Lock',
          onClick: onLock,
        }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Lock' }));
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('can mirror draft picks and a non-interactive lock affordance on the public board', () => {
    const board = makeBoard({
      phase: 'selection',
      selectedChests: [],
      revealedChests: [],
      allSelectionsLocked: false,
      remainingSelections: 3,
      remainingReveals: 0,
    });

    const { container, getByRole } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({ board, phase: 'selection' }),
        })}
        frame="board-only"
        draftSelections={[0, 2, 4]}
        boardAction={{
          label: 'Lock',
          onClick: vi.fn(),
          disabled: true,
        }}
      />,
    );

    expect(container.querySelector('[data-chest-index="0"]')?.getAttribute('data-sprite-state')).toBe('selected');
    expect(container.querySelector('[data-chest-index="2"]')?.getAttribute('data-sprite-state')).toBe('selected');
    expect(container.querySelector('[data-chest-index="4"]')?.getAttribute('data-sprite-state')).toBe('selected');
    expect((getByRole('button', { name: 'Lock' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('stages the locked selections into a centered row before reveals begin', () => {
    const board = makeBoard({
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

    const { container } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({
            board,
            phase: 'locked',
            lastAction: 'chests_selected',
          }),
        })}
      />,
    );

    const firstSelected = container.querySelector('[data-chest-index="1"]');
    const secondSelected = container.querySelector('[data-chest-index="4"]');
    const thirdSelected = container.querySelector('[data-chest-index="8"]');
    const dormantChest = container.querySelector('[data-chest-index="0"]');
    const selectedSprite = firstSelected?.querySelector('[data-sprite-id="chest-locked"]');
    const selectedSpriteStyle = selectedSprite instanceof HTMLElement ? selectedSprite.style.getPropertyValue('--scene-sprite-anchor-x') : '';

    expect(firstSelected?.getAttribute('data-selection-stage')).toBe('true');
    expect(firstSelected?.getAttribute('data-selection-slot')).toBe('0');
    expect(secondSelected?.getAttribute('data-selection-slot')).toBe('1');
    expect(thirdSelected?.getAttribute('data-selection-slot')).toBe('2');
    expect(dormantChest?.getAttribute('data-dormant')).toBe('true');
    expect(selectedSprite?.getAttribute('data-sprite-playback')).toBe('static');
    expect(selectedSpriteStyle).not.toBe('');
  });

  it('lets the host click a locked staged chest to reveal that exact pick', () => {
    const onRevealChest = vi.fn();
    const board = makeBoard({
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

    const { container } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({
            board,
            phase: 'locked',
            lastAction: 'chests_selected',
          }),
        })}
        onRevealChest={onRevealChest}
      />,
    );

    const revealableChest = container.querySelector('[data-chest-index="4"]') as HTMLButtonElement | null;
    const dormantChest = container.querySelector('[data-chest-index="0"]') as HTMLButtonElement | null;

    expect(revealableChest?.disabled).toBe(false);
    expect(revealableChest?.getAttribute('data-clickable')).toBe('true');
    expect(dormantChest?.disabled).toBe(true);

    fireEvent.click(revealableChest!);
    expect(onRevealChest).toHaveBeenCalledWith(4);
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
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({
            board: lockedBoard,
            phase: 'locked',
            lastAction: 'chests_selected',
          }),
        })}
      />,
    );

    rerender(
      <LootChestScene
        scene={makeScene({
          revision: 3,
          queueCount: 1,
          focusTurn: makeTurn({
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
          }),
        })}
      />,
    );

    await waitFor(() => {
      const revealedChest = container.querySelector('[data-chest-index="1"]');
      expect(revealedChest?.getAttribute('data-active-animation')).toBe('true');
      expect(revealedChest?.getAttribute('data-animation-state')).toBe('opening');
    });
  });

  it('uses the winner strip when a prize chest begins opening', async () => {
    const { container, rerender } = render(
      <LootChestScene
        scene={makeScene({
          revision: 2,
          focusTurn: makeTurn({
            board: makeBoard({
              phase: 'locked',
              boardRevision: 2,
              selectedChests: [1, 4, 8],
              revealedChests: [],
              allSelectionsLocked: true,
              remainingSelections: 0,
              remainingReveals: 3,
              lastAction: 'chests_selected',
              prizeChestIndex: 4,
            }, {
              1: { spriteState: 'locked', animationState: 'idle' },
              4: { spriteState: 'locked', animationState: 'idle' },
              8: { spriteState: 'locked', animationState: 'idle' },
            }),
            phase: 'locked',
            lastAction: 'chests_selected',
          }),
        })}
      />,
    );

    rerender(
      <LootChestScene
        scene={makeScene({
          revision: 3,
          focusTurn: makeTurn({
            board: makeBoard({
              phase: 'revealing',
              boardRevision: 3,
              selectedChests: [1, 4, 8],
              revealedChests: [4],
              allSelectionsLocked: true,
              remainingSelections: 0,
              remainingReveals: 2,
              lastAction: 'chest_revealed',
              lastChangedChestIndex: 4,
              activeAnimationChestIndex: 4,
              prizeChestIndex: 4,
            }, {
              1: { spriteState: 'locked', animationState: 'idle' },
              4: {
                revealed: true,
                containsPrize: true,
                spriteState: 'opening',
                animationState: 'opening',
                revealCue: true,
              },
              8: { spriteState: 'locked', animationState: 'idle' },
            }),
            phase: 'revealing',
            lastAction: 'chest_revealed',
          }),
        })}
      />,
    );

    await waitFor(() => {
      const prizeChest = container.querySelector('[data-chest-index="4"]');
      const prizeSprite = prizeChest?.querySelector('[data-sprite-id="chest-opening-winner"]');
      expect(prizeSprite).not.toBeNull();
    });
  });

  it('keeps the opening strip anchored to a stable chest base as frames advance', () => {
    vi.useFakeTimers();

    const { container } = render(
      <LootChestScene
        scene={makeScene({
          revision: 3,
          focusTurn: makeTurn({
            board: makeBoard({
              phase: 'revealing',
              boardRevision: 3,
              selectedChests: [1, 4, 8],
              revealedChests: [4],
              allSelectionsLocked: true,
              remainingSelections: 0,
              remainingReveals: 2,
              lastAction: 'chest_revealed',
              lastChangedChestIndex: 4,
              activeAnimationChestIndex: 4,
            }, {
              1: { spriteState: 'locked', animationState: 'idle' },
              4: {
                revealed: true,
                spriteState: 'opening',
                animationState: 'opening',
                revealCue: true,
              },
              8: { spriteState: 'locked', animationState: 'idle' },
            }),
            phase: 'revealing',
            lastAction: 'chest_revealed',
          }),
        })}
      />,
    );

    const openingSprite = container.querySelector('[data-chest-index="4"] [data-sprite-id="chest-opening"]') as HTMLElement | null;
    expect(openingSprite).not.toBeNull();

    const startAnchor = Number.parseFloat(openingSprite?.style.getPropertyValue('--scene-sprite-anchor-x') ?? '');
    expect(openingSprite?.getAttribute('data-sprite-frame')).toBe('0');

    act(() => {
      vi.advanceTimersByTime(620);
    });

    const laterFrame = Number.parseFloat(openingSprite?.style.getPropertyValue('--scene-sprite-anchor-x') ?? '');
    expect(Number.parseInt(openingSprite?.getAttribute('data-sprite-frame') ?? '0', 10)).toBeGreaterThan(0);
    expect(laterFrame).toBe(startAnchor);
  });

  it('shows the result burst when a resolved board arrives on a new revision', async () => {
    const { container, rerender } = render(
      <LootChestScene
        scene={makeScene({
          revision: 4,
          focusTurn: makeTurn({
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
          }),
        })}
      />,
    );

    rerender(
      <LootChestScene
        scene={makeScene({
          revision: 5,
          focusTurn: makeTurn({
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
          }),
        })}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-result-cue="true"]')).not.toBeNull();
    });

    expect(container.querySelector('[data-sprite-id="board-backdrop"]')).not.toBeNull();
    expect(container.querySelector('[data-sprite-id="board-frame"]')).not.toBeNull();
    expect(container.querySelector('[data-sprite-id="result-win"]')).not.toBeNull();
  });

  it('mirrors a host hover cue onto the shared scene without enabling public controls', () => {
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
        scene={makeScene({
          queueCount: 1,
          focusTurn: makeTurn({ board, phase: 'selection' }),
        })}
        presentationCue={{
          kind: 'hover',
          turnId: 7,
          chestIndex: 4,
          sentAt: '2026-04-14T19:31:05.000Z',
          expiresAt: '2026-04-14T19:31:06.000Z',
        }}
      />,
    );

    const hoveredChest = container.querySelector('[data-chest-index="4"]');
    expect(hoveredChest?.getAttribute('data-hovered')).toBe('true');
  });

  it('can render a board-only public overlay without header or footer chrome', () => {
    const board = makeBoard({
      phase: 'locked',
      selectedChests: [1, 4, 8],
      allSelectionsLocked: true,
      remainingSelections: 0,
      remainingReveals: 3,
    }, {
      1: { spriteState: 'locked', animationState: 'idle' },
      4: { spriteState: 'locked', animationState: 'idle' },
      8: { spriteState: 'locked', animationState: 'idle' },
    });

    const { container } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 2,
          focusTurn: makeTurn({ board, phase: 'locked' }),
        })}
        frame="board-only"
      />,
    );

    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('[data-sprite-id="board-backdrop"]')).toBeNull();
    expect(container.querySelector('[data-sprite-id="board-frame-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-sprite-id="board-frame"]')).toBeNull();
    expect(container.querySelector('[data-chest-index="4"]')).not.toBeNull();
  });

  it('versions sprite asset urls so long-lived overlays pick up new scene art after reload', () => {
    const board = makeBoard({
      phase: 'locked',
      selectedChests: [1, 4, 8],
      allSelectionsLocked: true,
      remainingSelections: 0,
      remainingReveals: 3,
    }, {
      1: { spriteState: 'locked', animationState: 'idle' },
      4: { spriteState: 'locked', animationState: 'idle' },
      8: { spriteState: 'locked', animationState: 'idle' },
    });

    const { container } = render(
      <LootChestScene
        scene={makeScene({
          queueCount: 2,
          focusTurn: makeTurn({ board, phase: 'locked' }),
        })}
        frame="board-only"
        assetVersion="build-123"
      />,
    );

    const frameSprite = container.querySelector('[data-sprite-id="board-frame-overlay"]') as HTMLElement | null;
    const lockedSprite = container.querySelector('[data-chest-index="1"] [data-sprite-id="chest-locked"]') as HTMLElement | null;

    expect(frameSprite?.style.getPropertyValue('--scene-sprite-image')).toContain('board-frame-overlay.svg?v=build-123');
    expect(lockedSprite?.style.getPropertyValue('--scene-sprite-image')).toContain('chest.png?v=build-123');
  });
});
