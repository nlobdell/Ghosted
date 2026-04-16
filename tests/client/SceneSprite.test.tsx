/** @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneSprite } from '@/app/v/giveaways/SceneSprite';
import type { SceneSpriteSpec } from '@/app/v/giveaways/scene-sprite-catalog';

const EMPTY_SPEC: SceneSpriteSpec = {
  id: 'chest-empty',
  src: '/giveaways/sprites/chest-opening-animation.png',
  frames: 10,
  frameWidth: 48,
  frameHeight: 32,
  playback: 'static',
  initialFrame: 9,
  pixelated: true,
};

const OPENING_SPEC: SceneSpriteSpec = {
  id: 'chest-opening',
  src: '/giveaways/sprites/chest-opening-animation.png',
  frames: 10,
  frameWidth: 48,
  frameHeight: 32,
  playback: 'once',
  durationMs: 680,
  pixelated: true,
};

describe('SceneSprite', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('resets to the new sprite initial frame when the spec changes', () => {
    const { container, rerender } = render(<SceneSprite spec={EMPTY_SPEC} />);

    const initialSprite = container.querySelector('[data-sprite-id="chest-empty"]');
    expect(initialSprite?.getAttribute('data-sprite-frame')).toBe('9');

    rerender(<SceneSprite spec={OPENING_SPEC} />);

    const openingSprite = container.querySelector('[data-sprite-id="chest-opening"]');
    expect(openingSprite?.getAttribute('data-sprite-frame')).toBe('0');
  });

  it('advances animated once-playback sprites after mount', () => {
    vi.useFakeTimers();

    const { container } = render(<SceneSprite spec={OPENING_SPEC} />);
    const openingSprite = container.querySelector('[data-sprite-id="chest-opening"]');

    expect(openingSprite?.getAttribute('data-sprite-frame')).toBe('0');

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(Number(openingSprite?.getAttribute('data-sprite-frame'))).toBeGreaterThan(0);
  });
});
