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

const TEXTURED_SPEC: SceneSpriteSpec = {
  id: 'chest-textured',
  src: '/giveaways/sprites/chest.png',
  frames: 1,
  frameWidth: 48,
  frameHeight: 32,
  playback: 'static',
  pixelated: true,
  textureLayer: {
    src: '/giveaways/sprites/infernal-cape-texture.png',
    maskSrc: '/giveaways/sprites/chest-opening-animation-mask.png',
    maskFrames: 10,
    repeat: 'repeat',
    size: '128px 128px',
    durationMs: 2200,
    scrollY: '-128px',
    opacity: 0.96,
    pixelated: true,
  },
  detailLayer: {
    opacity: 0.42,
    filter: 'brightness(0.72) contrast(1.28) saturate(0.52)',
    pixelated: true,
  },
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

  it('renders a masked texture layer and detail overlay when texture support is enabled', () => {
    const { container } = render(<SceneSprite spec={TEXTURED_SPEC} />);

    const texturedSprite = container.querySelector('[data-sprite-id="chest-textured"]') as HTMLElement | null;
    const textureMask = container.querySelector('[data-sprite-layer="texture"]') as HTMLElement | null;
    const detailStrip = container.querySelector('[data-sprite-layer="detail"]') as HTMLElement | null;

    expect(texturedSprite?.getAttribute('data-sprite-textured')).toBe('true');
    expect(textureMask).not.toBeNull();
    expect(detailStrip).not.toBeNull();
    expect(texturedSprite?.style.getPropertyValue('--scene-texture-image')).toContain('infernal-cape-texture.png');
    expect(texturedSprite?.style.getPropertyValue('--scene-texture-mask-image')).toContain('chest-opening-animation-mask.png');
    expect(texturedSprite?.style.getPropertyValue('--scene-texture-mask-frames')).toBe('10');
    expect(texturedSprite?.style.getPropertyValue('--scene-texture-mask-position-x')).toBe('0%');
    expect(texturedSprite?.style.getPropertyValue('--scene-texture-sync-delay')).toContain('ms');
    expect(texturedSprite?.style.getPropertyValue('--scene-detail-opacity')).toBe('0.42');
  });
});
