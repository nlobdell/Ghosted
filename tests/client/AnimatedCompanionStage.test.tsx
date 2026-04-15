/** @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import type { CompanionRenderManifest } from '@/lib/types';

type MatchMediaStub = {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
};

const frameQueue: FrameRequestCallback[] = [];

function installAnimationStubs(reducedMotion: boolean) {
  frameQueue.length = 0;
  let requestId = 0;

  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frameQueue.push(callback);
    requestId += 1;
    return requestId;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}

    observe() {
      this.callback([{ isIntersecting: true }]);
    }

    disconnect() {}
  });

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });

  const matchMedia = vi.fn((query: string): MatchMediaStub => ({
    matches: reducedMotion,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: matchMedia,
  });
}

function flushFrame(timestamp: number) {
  const callbacks = frameQueue.splice(0);
  act(() => {
    callbacks.forEach((callback) => callback(timestamp));
  });
}

function parseMatrix(transform: string) {
  const match = /matrix\(([^)]+)\)/.exec(transform);
  if (!match?.[1]) throw new Error(`Expected matrix transform, received: ${transform}`);
  return match[1].split(',').map((value) => Number.parseFloat(value.trim()));
}

function pieceNode(container: HTMLElement) {
  const node = container.querySelector('div[style*="background-image"]');
  if (!(node instanceof HTMLDivElement)) {
    throw new Error('Expected rendered Ghostling piece node.');
  }
  return node;
}

function makeManifest(overrides: Partial<CompanionRenderManifest> = {}): CompanionRenderManifest {
  return {
    width: 32,
    height: 32,
    motion: {
      shadowOpacity: 0.2,
      rootGroup: 'root',
      channels: {
        root: {
          offsetX: { amplitude: 2, durationMs: 1000, phase: 0 },
        },
      },
      slotGroups: {},
      accents: [],
      ...(overrides.motion ?? {}),
    },
    layers: [{
      key: 'base',
      role: 'base-body',
      src: '/ghost.png',
      zIndex: 10,
      sceneFacingFlip: 'allow',
      motionGroup: 'root',
      animation: {
        mode: 'static',
        fps: 0,
        frameCount: 1,
        frameWidth: 32,
        frameHeight: 32,
        loop: false,
      },
      slices: [{
        key: 'full',
        sourceX: 0,
        sourceY: 0,
        sourceWidth: 32,
        sourceHeight: 32,
        targetX: 0,
        targetY: 0,
        targetWidth: 32,
        targetHeight: 32,
        motionGroup: 'root',
      }],
    }],
    ...overrides,
  };
}

describe('AnimatedCompanionStage', () => {
  beforeEach(() => {
    installAnimationStubs(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('freezes to the base pose when reduced motion is requested', () => {
    installAnimationStubs(true);
    const manifest = makeManifest({
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: {
          root: {
            offsetX: { amplitude: 3, durationMs: 1000, phase: 0.25 },
            rotateDeg: { amplitude: 8, durationMs: 1000, phase: 0.1 },
          },
        },
        slotGroups: {},
        accents: [{
          key: 'tilt',
          groups: ['root'],
          intervalMsMin: 400,
          intervalMsMax: 400,
          durationMs: 600,
          overrides: {
            root: {
              offsetX: { amplitude: 4, durationMs: 600, phase: 0 },
            },
          },
        }],
      },
    });

    const { container } = render(
      <AnimatedCompanionStage manifest={manifest} fallbackSrc="/ghost.png" alt="Reduced Ghostling" targetSize={64} />,
    );

    flushFrame(0);
    flushFrame(250);

    expect(pieceNode(container).style.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  it('applies presentation presets as motion multipliers', () => {
    const manifest = makeManifest();
    const ambient = render(
      <AnimatedCompanionStage
        manifest={manifest}
        fallbackSrc="/ghost.png"
        alt="Ambient Ghostling"
        targetSize={64}
        presentation="ambient"
        seedKey="ambient"
      />,
    );
    const hero = render(
      <AnimatedCompanionStage
        manifest={manifest}
        fallbackSrc="/ghost.png"
        alt="Hero Ghostling"
        targetSize={64}
        presentation="hero"
        seedKey="hero"
      />,
    );

    flushFrame(0);
    flushFrame(250);

    const ambientMatrix = parseMatrix(pieceNode(ambient.container).style.transform);
    const heroMatrix = parseMatrix(pieceNode(hero.container).style.transform);

    expect(Math.abs(heroMatrix[4] ?? 0)).toBeGreaterThan(Math.abs(ambientMatrix[4] ?? 0));
  });

  it('uses seed keys to keep accent timing deterministic per instance', () => {
    const manifest = makeManifest({
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: {
          root: {},
        },
        slotGroups: {},
        accents: [{
          key: 'pulse',
          groups: ['root'],
          intervalMsMin: 400,
          intervalMsMax: 400,
          durationMs: 600,
          overrides: {
            root: {
              offsetX: { amplitude: 3, durationMs: 600, phase: 0 },
            },
          },
        }],
      },
    });

    const first = render(
      <AnimatedCompanionStage manifest={manifest} fallbackSrc="/ghost.png" alt="Seed A" targetSize={64} seedKey="seed-a" />,
    );
    const second = render(
      <AnimatedCompanionStage manifest={manifest} fallbackSrc="/ghost.png" alt="Seed A clone" targetSize={64} seedKey="seed-a" />,
    );
    const third = render(
      <AnimatedCompanionStage manifest={manifest} fallbackSrc="/ghost.png" alt="Seed B" targetSize={64} seedKey="seed-b" />,
    );

    flushFrame(0);
    flushFrame(100);
    flushFrame(200);
    flushFrame(300);
    flushFrame(400);
    flushFrame(500);

    const firstTransform = pieceNode(first.container).style.transform;
    const secondTransform = pieceNode(second.container).style.transform;
    const thirdTransform = pieceNode(third.container).style.transform;

    expect(firstTransform).toBe(secondTransform);
    expect(thirdTransform).not.toBe(firstTransform);
  });

  it('cancels the parent scene flip for ignore layers when the ghostling faces right', () => {
    const manifest = makeManifest({
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: {
          root: {},
        },
        slotGroups: {},
        accents: [],
      },
      layers: [{
        key: 'hat-front',
        role: 'hat-front',
        src: '/hat.png',
        zIndex: 20,
        sceneFacingFlip: 'ignore',
        motionGroup: 'head',
        animation: {
          mode: 'static',
          fps: 0,
          frameCount: 1,
          frameWidth: 32,
          frameHeight: 32,
          loop: false,
        },
        slices: [{
          key: 'hat-front',
          sourceX: 0,
          sourceY: 0,
          sourceWidth: 32,
          sourceHeight: 32,
          targetX: 0,
          targetY: 0,
          targetWidth: 32,
          targetHeight: 32,
          motionGroup: 'head',
        }],
      }],
    });

    const { container } = render(
      <AnimatedCompanionStage
        manifest={manifest}
        fallbackSrc="/ghost.png"
        alt="Ignore flip"
        targetSize={64}
        sceneFacingScaleX={-1}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(parseMatrix(pieceNode(container).style.transform)[0]).toBeCloseTo(-1, 4);
  });

  it('only applies invert layers when a scene-facing scale is provided', () => {
    const manifest = makeManifest({
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: {
          root: {},
        },
        slotGroups: {},
        accents: [],
      },
      layers: [{
        key: 'hat-front',
        role: 'hat-front',
        src: '/hat.png',
        zIndex: 20,
        sceneFacingFlip: 'invert',
        motionGroup: 'head',
        animation: {
          mode: 'static',
          fps: 0,
          frameCount: 1,
          frameWidth: 32,
          frameHeight: 32,
          loop: false,
        },
        slices: [{
          key: 'hat-front',
          sourceX: 0,
          sourceY: 0,
          sourceWidth: 32,
          sourceHeight: 32,
          targetX: 0,
          targetY: 0,
          targetWidth: 32,
          targetHeight: 32,
          motionGroup: 'head',
        }],
      }],
    });

    const ambient = render(
      <AnimatedCompanionStage manifest={manifest} fallbackSrc="/ghost.png" alt="Ambient invert" targetSize={64} />,
    );
    const scene = render(
      <AnimatedCompanionStage
        manifest={manifest}
        fallbackSrc="/ghost.png"
        alt="Scene invert"
        targetSize={64}
        sceneFacingScaleX={1}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(parseMatrix(pieceNode(ambient.container).style.transform)[0]).toBeCloseTo(1, 4);
    expect(parseMatrix(pieceNode(scene.container).style.transform)[0]).toBeCloseTo(-1, 4);
  });
});
