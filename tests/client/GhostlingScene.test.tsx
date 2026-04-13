/** @vitest-environment jsdom */

import { act, cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GhostlingScene } from '@/components/GhostlingScene';
import {
  DEFAULT_GHOSTLING_ACTOR_METRICS,
  resolveGhostlingActorMetrics,
  scaledGhostlingVisibleBounds,
  scaledGhostlingVisibleExtents,
} from '@/lib/ghostling-actor';
import { createGhostlingSceneCameraMetrics, projectGhostlingWorldPoint } from '@/lib/ghostling-camera';
import { resolveGhostlingSceneProfile } from '@/lib/ghostling-scene';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';
import type {
  CompanionActorMetrics,
  CompanionPreviewSummary,
  CompanionRenderManifest,
  ScenePresenceMember,
  ScenePresencePayload,
  SceneSharedEntityState,
  ScenePresenceSocketMessage,
} from '@/lib/types';

const { animatedStageMock } = vi.hoisted(() => ({
  animatedStageMock: vi.fn(),
}));

vi.mock('@/components/companion/AnimatedCompanionStage', () => ({
  AnimatedCompanionStage: ({
    alt,
    presentation,
    seedKey,
  }: {
    alt: string;
    presentation?: string;
    seedKey?: string;
  }) => {
    animatedStageMock({ alt, presentation, seedKey });
    return (
      <div data-testid="animated-stage" data-presentation={presentation} data-seed-key={seedKey}>
        {alt}
      </div>
    );
  },
}));

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
let viewportWidth = 1200;
let viewportHeight = 560;

class FakeSceneWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeSceneWebSocket[] = [];

  url: string;
  readyState = FakeSceneWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSceneWebSocket.instances.push(this);
  }

  close() {
    this.emitClose();
  }

  emitOpen() {
    this.readyState = FakeSceneWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitMessage(message: ScenePresenceSocketMessage) {
    this.onmessage?.(new MessageEvent('message', {
      data: JSON.stringify(message),
    }));
  }

  emitClose() {
    this.readyState = FakeSceneWebSocket.CLOSED;
    this.onclose?.(new Event('close'));
  }
}

function installSceneStubs(options: {
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  coarsePointer?: boolean;
  noHover?: boolean;
  webSocketClass?: typeof FakeSceneWebSocket;
} = {}) {
  frameQueue.length = 0;
  FakeSceneWebSocket.instances = [];
  viewportWidth = options.width ?? 1200;
  viewportHeight = options.height ?? 560;
  let requestId = 0;

  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frameQueue.push(callback);
    requestId += 1;
    return requestId;
  });
  const cancelAnimationFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: requestAnimationFrame,
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: cancelAnimationFrame,
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ members: [], source: 'empty' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })));

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });

  const matchMedia = vi.fn((query: string): MatchMediaStub => ({
    matches: query.includes('prefers-reduced-motion')
      ? Boolean(options.reducedMotion)
      : query.includes('pointer: coarse')
        ? Boolean(options.coarsePointer)
        : query.includes('hover: none')
          ? Boolean(options.noHover)
          : false,
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

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    get() {
      return viewportWidth;
    },
  });

  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get() {
      return viewportHeight;
    },
  });

  Object.defineProperty(window, 'WebSocket', {
    configurable: true,
    value: options.webSocketClass,
  });

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn().mockReturnValue(true),
  });

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return viewportWidth;
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return viewportHeight;
    },
  });
}

function flushFrame(timestamp: number) {
  const callbacks = frameQueue.splice(0);
  act(() => {
    callbacks.forEach((callback) => callback(timestamp));
  });
}

function extractTranslate3d(styleValue: string) {
  const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)/.exec(styleValue);
  if (!match) {
    throw new Error(`Expected translate3d style, received "${styleValue}".`);
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function getHeroStage(container: HTMLElement) {
  const stage = container.querySelector('div[data-world="shared-commons"][data-preset="public-hero"]');
  if (!(stage instanceof HTMLDivElement)) {
    throw new Error('Expected hero scene stage.');
  }
  return stage;
}

function expectedWrapPosition(
  x: number,
  y: number,
  renderScale: number,
  actorMetrics: CompanionActorMetrics = DEFAULT_GHOSTLING_ACTOR_METRICS,
  panXWorld = 0,
) {
  const profile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
  const camera = createGhostlingSceneCameraMetrics(
    SHARED_COMMONS_WORLD,
    viewportWidth,
    viewportHeight,
    profile.bucket,
    'fixed-crop',
    { panXWorld },
  );
  const point = projectGhostlingWorldPoint(camera, x, y);
  const visibleExtents = scaledGhostlingVisibleExtents(renderScale * camera.scale, actorMetrics);

  return {
    x: point.x - visibleExtents.left,
    y: point.y - visibleExtents.top,
  };
}

function expectedWorldDragDelta(screenDx: number, screenDy = 0) {
  const profile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
  const camera = createGhostlingSceneCameraMetrics(
    SHARED_COMMONS_WORLD,
    viewportWidth,
    viewportHeight,
    profile.bucket,
    'fixed-crop',
  );

  return {
    x: Math.round(screenDx / Math.max(0.001, camera.scaleX)),
    y: Math.round(screenDy / Math.max(0.001, camera.scaleY)),
  };
}

function makePreview(
  overrides: Partial<CompanionPreviewSummary['renderManifest']> = {},
): CompanionPreviewSummary {
  const renderManifest: CompanionRenderManifest = {
    width: 32,
    height: 32,
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
      key: 'base',
      role: 'base-body',
      src: '/ghost.png',
      zIndex: 10,
      motionGroup: 'root',
      animation: {
        mode: 'static',
        fps: 0,
        frameCount: 1,
        frameWidth: 32,
        frameHeight: 32,
        loop: false,
      },
    }],
    ...overrides,
  };

  return {
    user: null,
    renderUrl: '/api/companion/render',
    animatedRenderUrl: '/api/companion/render-animated',
    renderManifest,
    actorMetrics: resolveGhostlingActorMetrics(renderManifest),
  };
}

function makeSharedEntity(
  overrides: Partial<SceneSharedEntityState> & Pick<
    SceneSharedEntityState,
    'key' | 'x' | 'y' | 'targetX' | 'targetY' | 'safeZoneKey' | 'pointKey'
  >,
): SceneSharedEntityState {
  return {
    speed: 24,
    velocityX: 0,
    velocityY: 0,
    pauseRemainingMs: 2000,
    phaseRemainingMs: 2000,
    scaleTier: 2,
    renderScale: 2,
    targetSerial: 0,
    movementPhase: 'paused',
    facingLeft: true,
    opacity: 1,
    jammedMs: 0,
    fallback: false,
    source: 'voice',
    activeUntilTs: 0,
    lastSeenSignature: '2026-04-10T12:00:00.000Z:voice',
    actorMetrics: DEFAULT_GHOSTLING_ACTOR_METRICS,
    ...overrides,
  };
}

function makeTallHatPreview() {
  return makePreview({
    width: 70,
    height: 70,
    layers: [{
      key: 'base',
      role: 'base-body',
      src: '/ghost.png',
      zIndex: 10,
      motionGroup: 'root',
      animation: {
        mode: 'static',
        fps: 0,
        frameCount: 1,
        frameWidth: 70,
        frameHeight: 70,
        loop: false,
      },
    }, {
      key: 'hat-front',
      role: 'hat-front',
      src: '/hat.png',
      zIndex: 40,
      slot: 'hat',
      motionGroup: 'head',
      animation: {
        mode: 'static',
        fps: 0,
        frameCount: 1,
        frameWidth: 70,
        frameHeight: 70,
        loop: false,
      },
      slices: [{
        key: 'hat-front',
        sourceX: 0,
        sourceY: 0,
        sourceWidth: 34,
        sourceHeight: 18,
        targetX: 18,
        targetY: 4,
        targetWidth: 34,
        targetHeight: 18,
        motionGroup: 'head',
      }],
    }],
  });
}

function makeMember(
  key: string,
  username: string,
  overrides: Partial<ScenePresenceMember> = {},
): ScenePresenceMember {
  return {
    key,
    userId: 1,
    username,
    displayName: overrides.displayName ?? username,
    source: 'voice',
    activity: {
      firstSeenAt: '2026-04-10T12:00:00.000Z',
      lastSeenAt: '2026-04-10T12:00:00.000Z',
      freshness: 'steady',
      strength: 'high',
    },
    companion: makePreview(),
    ...overrides,
  };
}

function makePayload(members: ScenePresenceMember[]): ScenePresencePayload {
  return {
    members,
    source: members.some((member) => member.source === 'voice') ? 'voice' : (members.length ? 'wom' : 'empty'),
  };
}

describe('GhostlingScene', () => {
  beforeEach(() => {
    installSceneStubs();
    vi.stubEnv('NODE_ENV', 'test');
    window.sessionStorage.clear();
    animatedStageMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders the world-backed hero and featured mascot fallback when no live members are present', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        fallbackMode="single"
        initialPayload={{ members: [], source: 'empty' }}
        fallbackCompanion={makePreview()}
        world="shared-commons"
        preset="public-hero"
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('[data-world="shared-commons"]')).not.toBeNull();
    expect(container.querySelector('[data-layer="sky"]')).not.toBeNull();
    expect(container.querySelector('[data-scene-state="featured-mascot"]')).not.toBeNull();
    expect(container.querySelector('[data-backdrop-mode]')).toBeNull();
    expect(screen.getByTestId('animated-stage').getAttribute('data-presentation')).toBe('hero');
  });

  it('upgrades hovered members to the strongest presentation preset', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected voice Ghostling wrapper.');
    }

    fireEvent.mouseEnter(wrap);

    expect(wrap.dataset.sceneState).toBe('hovered');
    expect(screen.getByTestId('animated-stage').getAttribute('data-presentation')).toBe('hero');
  });

  it('prefers the Discord display name for voice labels and reveals the raw handle in metadata', () => {
    const payload = makePayload([
      makeMember('user:1', 'smirk', {
        displayName: 'Ghosted Smirk',
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected voice Ghostling wrapper.');
    }

    const nameplate = wrap.children.item(2);
    const metadata = wrap.children.item(3);
    if (!(nameplate instanceof HTMLSpanElement) || !(metadata instanceof HTMLSpanElement)) {
      throw new Error('Expected nameplate and metadata elements.');
    }

    expect(nameplate.textContent).toBe('Ghosted Smirk');
    expect(metadata.getAttribute('aria-hidden')).toBe('true');

    fireEvent.mouseEnter(wrap);

    expect(metadata.getAttribute('aria-hidden')).toBe('false');
    expect(metadata.textContent).toContain('@smirk');
    expect(metadata.textContent).toContain('Voice');
  });

  it('renders live unmatched members through the base companion preview summary', () => {
    const payload = makePayload([
      makeMember('voice:wanderer', 'wanderer', {
        userId: null,
        displayName: 'Wanderer',
        companion: makePreview(),
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('[data-source="voice"]')).not.toBeNull();
    expect(screen.getByTestId('animated-stage').textContent).toContain("Wanderer's Ghostling");
  });

  it('uses static ghostling renders for the hero on mobile layouts to reduce animation cost', () => {
    cleanup();
    installSceneStubs({
      width: 390,
      height: 420,
      coarsePointer: true,
      noHover: true,
    });
    animatedStageMock.mockClear();

    const payload = makePayload([makeMember('user:1', 'Member One')]);
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = screen.getByRole('img', { name: 'Ghostlings representing live members and recent clan activity' }).closest('div[data-world="shared-commons"][data-preset="public-hero"]');
    expect(stage?.getAttribute('data-mobile-performance')).toBe('true');
    expect(screen.queryByTestId('animated-stage')).toBeNull();
    const ghostImg = screen.getByAltText("Member One's Ghostling");
    expect(ghostImg).not.toBeNull();
    expect((ghostImg as HTMLImageElement).src).toContain('/api/companion/render');
    expect((ghostImg as HTMLImageElement).src).not.toContain('/api/companion/render-animated');
    expect(animatedStageMock).not.toHaveBeenCalled();
  });

  it('uses the measured visible ghost bounds as the interactive wrapper', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }
    const visual = wrap.children.item(1);
    if (!(visual instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling visual.');
    }

    const profile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
    const camera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      viewportWidth,
      viewportHeight,
      profile.bucket,
      'fixed-crop',
    );
    const visibleExtents = scaledGhostlingVisibleExtents(2 * camera.scale);
    const visibleBounds = scaledGhostlingVisibleBounds(2 * camera.scale);

    expect(parseFloat(wrap.style.width)).toBeCloseTo(visibleExtents.width, 4);
    expect(parseFloat(wrap.style.height)).toBeCloseTo(visibleExtents.height, 4);
    expect(parseFloat(visual.style.left)).toBeCloseTo(-visibleBounds.x, 1);
    expect(parseFloat(visual.style.top)).toBeCloseTo(-visibleBounds.y, 1);
  });

  it('keeps decorative aura layers out of the interactive hit area', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }

    const aura = wrap.firstElementChild;
    if (!(aura instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling aura layer.');
    }

    expect(window.getComputedStyle(aura).pointerEvents).toBe('none');
  });

  it('raises the wrapper and label anchor for companions with taller cosmetic bounds', () => {
    const preview = makeTallHatPreview();
    const payload = makePayload([
      makeMember('user:1', 'Member One', {
        companion: preview,
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }
    const actorMetrics = resolveGhostlingActorMetrics(preview.renderManifest);
    const profile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
    const camera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      viewportWidth,
      viewportHeight,
      profile.bucket,
      'fixed-crop',
    );
    const visibleExtents = scaledGhostlingVisibleExtents(2 * camera.scale, actorMetrics);

    expect(parseFloat(wrap.style.height)).toBeCloseTo(visibleExtents.height, 4);
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-label-anchor-x'))).toBeCloseTo(visibleExtents.left, 1);
  });

  it('marks fresh members as live-active and bumps them to the stronger stage preset', () => {
    const payload = makePayload([
      makeMember('user:1', 'Member One', {
        activity: {
          firstSeenAt: '2026-04-10T12:00:00.000Z',
          lastSeenAt: '2026-04-10T12:00:00.000Z',
          freshness: 'new',
          strength: 'high',
        },
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('[data-scene-state="live-active"]')).not.toBeNull();
    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected live-active Ghostling wrapper.');
    }
    expect(wrap.dataset.presenceActive).toBe('true');
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-opacity'))).toBeCloseTo(1, 4);
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-grayscale'))).toBeCloseTo(0, 4);
    expect(screen.getByTestId('animated-stage').getAttribute('data-presentation')).toBe('studio');
  });

  it('slightly dims non-voice ghostlings without dimming the username label', () => {
    const payload = makePayload([
      makeMember('user:1', 'Member One', {
        source: 'wom',
        activity: {
          firstSeenAt: '2026-04-10T12:00:00.000Z',
          lastSeenAt: '2026-04-10T12:00:00.000Z',
          freshness: 'steady',
          strength: 'high',
        },
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="wom"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected WOM Ghostling wrapper.');
    }
    const visual = wrap.children.item(1);
    const nameplate = wrap.children.item(2);
    if (!(visual instanceof HTMLDivElement) || !(nameplate instanceof HTMLSpanElement)) {
      throw new Error('Expected Ghostling visual and nameplate.');
    }

    expect(wrap.dataset.presenceActive).toBe('false');
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-opacity'))).toBeCloseTo(0.85, 4);
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-grayscale'))).toBeGreaterThan(0.3);
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-saturate'))).toBeLessThan(0.6);
    expect(visual.style.opacity).toBe('');
    expect(window.getComputedStyle(nameplate).opacity).toBe('1');
  });

  it('restores full opacity for inactive ghostlings on hover', () => {
    const payload = makePayload([
      makeMember('user:1', 'Member One', {
        source: 'wom',
      }),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="wom"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected inactive Ghostling wrapper.');
    }

    expect(wrap.style.getPropertyValue('--ghost-presence-opacity')).toBe('0.85');
    fireEvent.mouseEnter(wrap);
    expect(wrap.dataset.sceneState).toBe('hovered');
    expect(wrap.style.getPropertyValue('--ghost-presence-opacity')).toBe('1');
    expect(parseFloat(wrap.style.getPropertyValue('--ghost-presence-grayscale'))).toBeCloseTo(0, 4);
  });

  it('keeps fallback and scene-lab ghostlings fully opaque', () => {
    const payload = makePayload([
      makeMember('user:1', 'Member One', {
        source: 'wom',
      }),
      makeMember('fallback:house', 'Ghosted House', {
        userId: null,
        source: 'fallback',
      }),
    ]);
    const { container, rerender } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const fallbackWrap = container.querySelector('[data-source="fallback"]');
    if (!(fallbackWrap instanceof HTMLDivElement)) {
      throw new Error('Expected fallback Ghostling wrapper.');
    }
    expect(fallbackWrap.dataset.presenceActive).toBe('true');
    expect(parseFloat(fallbackWrap.style.getPropertyValue('--ghost-presence-opacity'))).toBeCloseTo(1, 4);

    rerender(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One', { source: 'wom' })])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(32);
    flushFrame(48);

    const editorWrap = container.querySelector('[data-source="wom"]');
    if (!(editorWrap instanceof HTMLDivElement)) {
      throw new Error('Expected scene-lab Ghostling wrapper.');
    }
    expect(editorWrap.dataset.presenceActive).toBe('true');
    expect(parseFloat(editorWrap.style.getPropertyValue('--ghost-presence-opacity'))).toBeCloseTo(1, 4);
  });

  it('condenses the crowd on mobile by capping visible members', () => {
    installSceneStubs({ width: 420, height: 520 });
    const payload = makePayload([
      makeMember('user:1', 'One'),
      makeMember('user:2', 'Two'),
      makeMember('user:3', 'Three'),
      makeMember('user:4', 'Four'),
      makeMember('user:5', 'Five'),
      makeMember('user:6', 'Six'),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelectorAll('[data-source="voice"]').length).toBe(6);
  });

  it('switches to the grouped reduced-motion layout without dropping the scene content', () => {
    installSceneStubs({ reducedMotion: true, width: 420, height: 520 });
    const payload = makePayload([
      makeMember('user:1', 'One'),
      makeMember('user:2', 'Two'),
    ]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('[data-reduced-motion="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-source="voice"]').length).toBe(2);
  });

  it('restores shared motion state from the presence payload for matching members', () => {
    const payload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1245,
            y: 242,
            targetX: 1305,
            targetY: 246,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-right-inner',
          })],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected restored Ghostling wrapper.');
    }

    const restored = extractTranslate3d(wrap.style.transform);
    const expected = expectedWrapPosition(1245, 242, 2, payload.members[0]?.companion?.actorMetrics);
    expect(restored.x).toBeCloseTo(expected.x, 2);
    expect(restored.y).toBeCloseTo(expected.y, 2);
  });

  it('rehomes restored entities whose point is not part of the canonical hero point set', () => {
    installSceneStubs({ width: 420, height: 520 });
    const payload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: SHARED_COMMONS_WORLD.fallbackAnchor.x,
            y: SHARED_COMMONS_WORLD.fallbackAnchor.y,
            targetX: SHARED_COMMONS_WORLD.fallbackAnchor.x,
            targetY: SHARED_COMMONS_WORLD.fallbackAnchor.y,
            safeZoneKey: SHARED_COMMONS_WORLD.fallbackAnchor.safeZoneKey,
            pointKey: SHARED_COMMONS_WORLD.fallbackAnchor.key,
            scaleTier: SHARED_COMMONS_WORLD.fallbackAnchor.scaleTier,
            renderScale: SHARED_COMMONS_WORLD.fallbackAnchor.scaleTier,
          })],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected restored Ghostling wrapper.');
    }

    expect(wrap.dataset.zone).toBe('shared-floor');
    expect(wrap.dataset.scaleTier).toBe('2');
  });

  it('re-applies the latest shared scene snapshot for existing members on refresh fetches', async () => {
    const initialPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1245,
            y: 242,
            targetX: 1305,
            targetY: 246,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-right-inner',
          })],
        },
      },
    };

    const updatedPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1000,
            y: 220,
            targetX: 1060,
            targetY: 224,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-mid-right',
            targetSerial: 2,
            facingLeft: false,
            pauseRemainingMs: 1500,
          })],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={initialPayload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(updatedPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    flushFrame(32);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected refreshed Ghostling wrapper.');
    }

    const refreshed = extractTranslate3d(wrap.style.transform);
    const expected = expectedWrapPosition(1000, 220, 2, updatedPayload.members[0]?.companion?.actorMetrics);
    expect(refreshed.x).toBeCloseTo(expected.x, 2);
    expect(refreshed.y).toBeCloseTo(expected.y, 2);
  });

  it('restores shared-scene snapshots from their saved position without client fast-forwarding', () => {
    const savedAt = Date.now() - 30_000;
    const payload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt,
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 980,
            y: 220,
            targetX: 1060,
            targetY: 224,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-mid-right',
            velocityX: 3,
            velocityY: 0.3,
            movementPhase: 'travel',
            pauseRemainingMs: 0,
            phaseRemainingMs: 0,
          })],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected restored Ghostling wrapper.');
    }

    const restored = extractTranslate3d(wrap.style.transform);
    const expected = expectedWrapPosition(980, 220, 2, payload.members[0]?.companion?.actorMetrics);
    expect(restored.x).toBeCloseTo(expected.x, 2);
    expect(restored.y).toBeCloseTo(expected.y, 2);
  });

  it('uses websocket snapshots as the primary transport when the realtime socket is healthy', async () => {
    vi.useFakeTimers();
    installSceneStubs({
      webSocketClass: FakeSceneWebSocket,
    });

    const initialPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1245,
            y: 242,
            targetX: 1305,
            targetY: 246,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-right-inner',
          })],
        },
      },
    };

    const updatedPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1000,
            y: 220,
            targetX: 1060,
            targetY: 224,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-mid-right',
            targetSerial: 2,
            facingLeft: false,
            pauseRemainingMs: 1500,
          })],
        },
      },
    };

    const fetchMock = vi.mocked(fetch);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={initialPayload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const socket = FakeSceneWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected realtime websocket to be created.');
    }

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'scene:snapshot',
        payload: updatedPayload,
        sentAt: new Date().toISOString(),
      });
    });

    flushFrame(32);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected refreshed Ghostling wrapper.');
    }

    expect(wrap.style.transform).not.toContain('translate3d(741.71px, 275.20px, 0)');

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not rerender the Ghostling stage for websocket position-only sync ticks', async () => {
    vi.useFakeTimers();
    installSceneStubs({
      webSocketClass: FakeSceneWebSocket,
    });

    const initialPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1245,
            y: 242,
            targetX: 1305,
            targetY: 246,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-right-inner',
          })],
        },
      },
    };

    render(
      <GhostlingScene
        variant="hero"
        initialPayload={initialPayload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const initialRenderCount = animatedStageMock.mock.calls.length;
    const socket = FakeSceneWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected realtime websocket to be created.');
    }

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'scene:snapshot',
        payload: {
          ...initialPayload,
          sharedScene: {
            hero: {
              ...initialPayload.sharedScene!.hero!,
              savedAt: Date.now(),
              entities: [{
                ...initialPayload.sharedScene!.hero!.entities[0],
                x: 1210,
                y: 238,
                targetX: 1280,
                targetY: 244,
                velocityX: -2,
                velocityY: -1,
              }],
            },
          },
        },
        sentAt: new Date().toISOString(),
      });
    });

    flushFrame(32);

    expect(animatedStageMock.mock.calls.length).toBe(initialRenderCount);
  });

  it('ignores stale websocket snapshots that arrive out of order', async () => {
    vi.useFakeTimers();
    installSceneStubs({
      webSocketClass: FakeSceneWebSocket,
    });

    const initialSavedAt = Date.now();
    const initialPayload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: initialSavedAt,
          payloadSource: 'voice',
          liveCount: 1,
          entities: [makeSharedEntity({
            key: 'user:1',
            x: 1245,
            y: 242,
            targetX: 1305,
            targetY: 246,
            safeZoneKey: 'shared-floor',
            pointKey: 'floor-right-inner',
          })],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={initialPayload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const socket = FakeSceneWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected realtime websocket to be created.');
    }

    const newerSavedAt = initialSavedAt + 1_000;
    const newerEntity = makeSharedEntity({
      key: 'user:1',
      x: 1000,
      y: 220,
      targetX: 1080,
      targetY: 224,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-mid-right',
      targetSerial: 2,
      facingLeft: false,
      movementPhase: 'travel',
      pauseRemainingMs: 0,
      phaseRemainingMs: 0,
    });
    const olderSavedAt = initialSavedAt + 500;
    const olderEntity = makeSharedEntity({
      key: 'user:1',
      x: 1340,
      y: 236,
      targetX: 1400,
      targetY: 240,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-right-outer',
      targetSerial: 1,
      facingLeft: true,
      movementPhase: 'travel',
      pauseRemainingMs: 0,
      phaseRemainingMs: 0,
    });

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'scene:snapshot',
        payload: {
          ...initialPayload,
          sharedScene: {
            hero: {
              ...initialPayload.sharedScene!.hero!,
              savedAt: newerSavedAt,
              entities: [newerEntity],
            },
          },
        },
        sentAt: new Date().toISOString(),
      });
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    flushFrame(432);

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected websocket Ghostling wrapper.');
    }
    const beforeOlder = extractTranslate3d(wrap.style.transform);

    act(() => {
      socket.emitMessage({
        type: 'scene:snapshot',
        payload: {
          ...initialPayload,
          sharedScene: {
            hero: {
              ...initialPayload.sharedScene!.hero!,
              savedAt: olderSavedAt,
              entities: [olderEntity],
            },
          },
        },
        sentAt: new Date().toISOString(),
      });
    });

    act(() => {
      vi.advanceTimersByTime(64);
    });
    flushFrame(496);

    const current = extractTranslate3d(wrap.style.transform);
    expect(Math.hypot(current.x - beforeOlder.x, current.y - beforeOlder.y)).toBeLessThan(20);
  });

  it('keeps websocket-corrected motion close to the authoritative snapshot over long runs', async () => {
    vi.useFakeTimers();
    installSceneStubs({
      webSocketClass: FakeSceneWebSocket,
    });

    const authoritativeEntity = makeSharedEntity({
      key: 'user:1',
      x: 1080,
      y: 222,
      targetX: 1200,
      targetY: 226,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-mid-right',
      velocityX: 1.8,
      velocityY: 0.2,
      pauseRemainingMs: 0,
    });

    const payload: ScenePresencePayload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1,
          variant: 'hero',
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          savedAt: Date.now(),
          payloadSource: 'voice',
          liveCount: 1,
          entities: [authoritativeEntity],
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const socket = FakeSceneWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected realtime websocket to be created.');
    }

    act(() => {
      socket.emitOpen();
    });

    for (let tick = 1; tick <= 120; tick += 1) {
      act(() => {
        socket.emitMessage({
          type: 'scene:snapshot',
          payload: {
            ...payload,
            sharedScene: {
              hero: {
                ...payload.sharedScene!.hero!,
                savedAt: Date.now(),
                entities: [authoritativeEntity],
              },
            },
          },
          sentAt: new Date().toISOString(),
        });
      });
      flushFrame(tick * 1000);
    }

    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected corrected Ghostling wrapper.');
    }

    const corrected = extractTranslate3d(wrap.style.transform);
    const expected = expectedWrapPosition(
      authoritativeEntity.x,
      authoritativeEntity.y,
      authoritativeEntity.renderScale,
      payload.members[0]?.companion?.actorMetrics,
    );
    expect(Math.abs(corrected.x - expected.x)).toBeLessThan(16);
    expect(Math.abs(corrected.y - expected.y)).toBeLessThan(16);
  });

  it('reconnects the websocket after disconnects and keeps fallback polling stopped once the socket recovers', async () => {
    vi.useFakeTimers();
    installSceneStubs({
      webSocketClass: FakeSceneWebSocket,
    });

    const fetchMock = vi.mocked(fetch);
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const firstSocket = FakeSceneWebSocket.instances[0];
    if (!firstSocket) {
      throw new Error('Expected first realtime websocket instance.');
    }

    act(() => {
      firstSocket.emitOpen();
      firstSocket.emitClose();
      vi.advanceTimersByTime(31_000);
    });

    expect(FakeSceneWebSocket.instances.length).toBeGreaterThan(1);

    const secondSocket = FakeSceneWebSocket.instances.at(-1);
    if (!secondSocket) {
      throw new Error('Expected replacement realtime websocket instance.');
    }

    act(() => {
      secondSocket.emitOpen();
    });

    const fetchCallCount = fetchMock.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(fetchCallCount);
  });

  it('renders the interactive scene lab panel in development when sceneEditorEnabled is set', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(screen.getByTestId('scene-lab-panel')).not.toBeNull();
    expect(screen.getByTestId('scene-lab-tab-authored')).not.toBeNull();
    expect(screen.getByTestId('scene-lab-tab-members')).not.toBeNull();
    expect(screen.getByTestId('scene-lab-object-browser')).not.toBeNull();
  });

  it('defaults the scene lab to live preview when the homepage already has a live payload', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(screen.getByText('mode=live bucket=desktop playing=yes')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh live' })).not.toBeNull();
  });

  it('lets the scene lab toggle overlay guide visibility while keeping safe zones editable from the browser', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelectorAll('[data-scene-lab-role="guide-line"]').length).toBe(2);
    expect(container.querySelectorAll('[data-scene-lab-role="safe-zone"]').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('scene-lab-visibility-guide-lines'));
    fireEvent.click(screen.getByTestId('scene-lab-visibility-safe-zones'));

    expect(container.querySelectorAll('[data-scene-lab-role="guide-line"]').length).toBe(0);
    expect(container.querySelectorAll('[data-scene-lab-role="safe-zone"]').length).toBe(0);

    fireEvent.click(screen.getByText('Shared floor'));

    expect(screen.getByDisplayValue(String(SHARED_COMMONS_WORLD.safeZones[0]?.bounds.x))).not.toBeNull();
    expect(screen.getByDisplayValue(String(SHARED_COMMONS_WORLD.safeZones[0]?.roamRadius))).not.toBeNull();
  });

  it('shows a dedicated export-frame preview for hero crop and updates it visually for world export', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('[data-scene-lab-role="hero-crop-stage-frame"]')).not.toBeNull();
    fireEvent.click(within(screen.getByTestId('scene-lab-object-browser')).getByText('Hero crop'));

    const guideX = screen.getByLabelText('Guide X') as HTMLInputElement;
    expect(screen.getByTestId('scene-lab-hero-crop-preview')).not.toBeNull();
    expect(guideX.value).toBe(String(SHARED_COMMONS_WORLD.guides.heroCrop?.x));

    const previewRect = document.querySelector('[data-scene-lab-role="hero-crop-preview-rect"]');
    if (!(previewRect instanceof Element)) {
      throw new Error('Expected hero crop preview rect.');
    }

    fireEvent.pointerDown(previewRect, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 124, clientY: 112 });
    fireEvent.pointerUp(window, { clientX: 124, clientY: 112 });

    expect(Number(guideX.value)).toBe((SHARED_COMMONS_WORLD.guides.heroCrop?.x ?? 0) + 24);
  });

  it('materializes editable hero crop values in the scene lab even when the loaded world omitted them', () => {
    const worldWithoutHeroCrop = {
      ...SHARED_COMMONS_WORLD,
      guides: {
        ...SHARED_COMMONS_WORLD.guides,
        heroCrop: undefined,
      },
    };

    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
        worldSpec={worldWithoutHeroCrop}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    fireEvent.click(within(screen.getByTestId('scene-lab-object-browser')).getByText('Hero crop'));

    expect(screen.getByLabelText('Guide X')).not.toBeNull();
    expect(screen.getByLabelText('Guide Width')).not.toBeNull();
    expect(screen.getByTestId('scene-lab-hero-crop-preview')).not.toBeNull();
  });

  it('matches the hero stage aspect ratio to the authored hero crop', () => {
    const customWorld = {
      ...SHARED_COMMONS_WORLD,
      guides: {
        ...SHARED_COMMONS_WORLD.guides,
        heroCrop: {
          x: 820,
          y: 54,
          width: 840,
          height: 420,
        },
      },
    };

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={{ members: [], source: 'empty' }}
        realtimeDisabled
        worldSpec={customWorld}
      />,
    );

    const stage = getHeroStage(container);
    expect(stage.getAttribute('data-hero-crop-aspect')).toBe('840 / 420');
  });

  it('pans the hero horizontally from a ghostling drag and recenters on double-click', () => {
    const sharedEntity = makeSharedEntity({
      key: 'user:1',
      x: 1245,
      y: 242,
      targetX: 1305,
      targetY: 246,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-right-inner',
    });
    const payload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1 as const,
          variant: 'hero' as const,
          savedAt: Date.now(),
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          payloadSource: 'voice' as const,
          liveCount: 1,
          entities: [sharedEntity],
        },
      },
    };
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    const wrap = container.querySelector('[data-source="voice"]');
    const skyLayer = container.querySelector('[data-layer="sky"]');
    const floorLayer = container.querySelector('[data-layer="floor"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }
    if (!(skyLayer instanceof HTMLImageElement)) {
      throw new Error('Expected sky layer.');
    }
    if (!(floorLayer instanceof HTMLImageElement)) {
      throw new Error('Expected floor layer.');
    }

    const initialPosition = extractTranslate3d(wrap.style.transform);
    const initialSkyPosition = extractTranslate3d(skyLayer.style.transform);
    const initialFloorPosition = extractTranslate3d(floorLayer.style.transform);

    const dragPixels = 120;
    fireEvent.pointerDown(wrap, {
      pointerId: 1,
      clientX: 420,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 420 + dragPixels,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    flushFrame(32);

    const draggedPosition = extractTranslate3d(wrap.style.transform);
    const draggedSkyPosition = extractTranslate3d(skyLayer.style.transform);
    const draggedFloorPosition = extractTranslate3d(floorLayer.style.transform);
    expect(stage.getAttribute('data-pan-dragging')).toBe('true');
    expect(draggedPosition.x).toBeGreaterThan(initialPosition.x + 80);
    expect(draggedSkyPosition.x).toBeGreaterThan(initialSkyPosition.x + 20);
    expect(draggedFloorPosition.x).toBeGreaterThan(initialFloorPosition.x + 80);
    expect(draggedFloorPosition.x - initialFloorPosition.x).toBeGreaterThan(
      draggedSkyPosition.x - initialSkyPosition.x,
    );

    fireEvent.pointerUp(stage, {
      pointerId: 1,
      clientX: 420 + dragPixels,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });

    fireEvent.doubleClick(stage);
    flushFrame(96);
    flushFrame(192);
    flushFrame(320);

    const recenteredPosition = extractTranslate3d(wrap.style.transform);
    const recenteredSkyPosition = extractTranslate3d(skyLayer.style.transform);
    const recenteredFloorPosition = extractTranslate3d(floorLayer.style.transform);
    expect(stage.getAttribute('data-pan-dragging')).toBe('false');
    expect(Math.abs(recenteredPosition.x - initialPosition.x)).toBeLessThan(1);
    expect(Math.abs(recenteredSkyPosition.x - initialSkyPosition.x)).toBeLessThan(1);
    expect(Math.abs(recenteredFloorPosition.x - initialFloorPosition.x)).toBeLessThan(1);
  });

  it('reclamps hero panning after resize and disables it while the scene editor is open', () => {
    const sharedEntity = makeSharedEntity({
      key: 'user:1',
      x: 1245,
      y: 242,
      targetX: 1305,
      targetY: 246,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-right-inner',
    });
    const payload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1 as const,
          variant: 'hero' as const,
          savedAt: Date.now(),
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          payloadSource: 'voice' as const,
          liveCount: 1,
          entities: [sharedEntity],
        },
      },
    };

    const { container, rerender } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    let stage = getHeroStage(container);
    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }

    fireEvent.pointerDown(stage, {
      pointerId: 2,
      clientX: 620,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(stage, {
      pointerId: 2,
      clientX: -2400,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    flushFrame(48);
    fireEvent.pointerUp(stage, {
      pointerId: 2,
      clientX: -2400,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });

    viewportWidth = 1680;
    viewportHeight = 420;
    fireEvent(window, new Event('resize'));
    flushFrame(64);

    const floorLayerAfterResize = container.querySelector('[data-layer="floor"]');
    if (!(floorLayerAfterResize instanceof HTMLImageElement)) {
      throw new Error('Expected floor layer.');
    }
    const resizedProfile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
    const resizedCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      viewportWidth,
      viewportHeight,
      resizedProfile.bucket,
      'fixed-crop',
      { panXWorld: 99_999 },
    );
    expect(extractTranslate3d(floorLayerAfterResize.style.transform).x).toBeCloseTo(resizedCamera.offsetX, 2);

    rerender(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(80);
    flushFrame(96);

    stage = getHeroStage(container);
    const floorLayer = container.querySelector('[data-layer="floor"]');
    if (!(floorLayer instanceof HTMLImageElement)) {
      throw new Error('Expected floor layer.');
    }
    const beforeDisabledDrag = floorLayer.style.transform;

    fireEvent.pointerDown(stage, {
      pointerId: 3,
      clientX: 360,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(stage, {
      pointerId: 3,
      clientX: 520,
      clientY: 160,
      button: 0,
      pointerType: 'mouse',
    });
    flushFrame(112);

    const afterDisabledDrag = floorLayer.style.transform;
    expect(stage.getAttribute('data-pan-enabled')).toBe('false');
    expect(afterDisabledDrag).toBe(beforeDisabledDrag);
  });

  it('pans the hero from wheel and trackpad input, including vertical-only wheel gestures', () => {
    const sharedEntity = makeSharedEntity({
      key: 'user:1',
      x: 1245,
      y: 242,
      targetX: 1305,
      targetY: 246,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-right-inner',
    });
    const payload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1 as const,
          variant: 'hero' as const,
          savedAt: Date.now(),
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          payloadSource: 'voice' as const,
          liveCount: 1,
          entities: [sharedEntity],
        },
      },
    };
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    const wrap = container.querySelector('[data-source="voice"]');
    const floorLayer = container.querySelector('[data-layer="floor"]');
    if (!(wrap instanceof HTMLDivElement) || !(floorLayer instanceof HTMLImageElement)) {
      throw new Error('Expected hero pan elements.');
    }

    const initialWrap = extractTranslate3d(wrap.style.transform);
    const initialFloor = extractTranslate3d(floorLayer.style.transform);

    fireEvent.wheel(stage, {
      deltaX: 160,
      deltaY: 0,
      deltaMode: 0,
    });
    flushFrame(32);
    flushFrame(64);

    const horizontalWheelWrap = extractTranslate3d(wrap.style.transform);
    const horizontalWheelFloor = extractTranslate3d(floorLayer.style.transform);
    expect(horizontalWheelWrap.x).toBeLessThan(initialWrap.x - 20);
    expect(horizontalWheelFloor.x).toBeLessThan(initialFloor.x - 20);

    fireEvent.wheel(stage, {
      deltaX: 0,
      deltaY: -140,
      deltaMode: 0,
    });
    flushFrame(96);
    flushFrame(128);

    const verticalWheelWrap = extractTranslate3d(wrap.style.transform);
    const verticalWheelFloor = extractTranslate3d(floorLayer.style.transform);
    expect(verticalWheelWrap.x).toBeGreaterThan(horizontalWheelWrap.x + 16);
    expect(verticalWheelFloor.x).toBeGreaterThan(horizontalWheelFloor.x + 16);
  });

  it('prevents default page scrolling when wheel panning the desktop hero', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    const wheelEvent = createEvent.wheel(stage, {
      deltaX: 0,
      deltaY: 140,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(stage, wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it('ignores wheel panning while the scene editor owns the hero stage', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    const floorLayer = container.querySelector('[data-layer="floor"]');
    if (!(floorLayer instanceof HTMLImageElement)) {
      throw new Error('Expected floor layer.');
    }
    const beforeWheel = floorLayer.style.transform;

    fireEvent.wheel(stage, {
      deltaX: 160,
      deltaY: 0,
      deltaMode: 0,
    });
    flushFrame(32);
    flushFrame(64);

    expect(stage.getAttribute('data-pan-enabled')).toBe('false');
    expect(floorLayer.style.transform).toBe(beforeWheel);
  });

  it('shows the mobile recenter button only on touch/mobile layouts and recenters the hero', () => {
    cleanup();
    installSceneStubs({
      width: 390,
      height: 420,
      coarsePointer: true,
      noHover: true,
    });

    const sharedEntity = makeSharedEntity({
      key: 'user:1',
      x: 1245,
      y: 242,
      targetX: 1305,
      targetY: 246,
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-right-inner',
    });
    const payload = {
      ...makePayload([makeMember('user:1', 'Member One')]),
      sharedScene: {
        hero: {
          version: 1 as const,
          variant: 'hero' as const,
          savedAt: Date.now(),
          width: SHARED_COMMONS_WORLD.sourceWidth,
          height: SHARED_COMMONS_WORLD.sourceHeight,
          payloadSource: 'voice' as const,
          liveCount: 1,
          entities: [sharedEntity],
        },
      },
    };
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    const wrap = container.querySelector('[data-source="voice"]');
    if (!(wrap instanceof HTMLDivElement)) {
      throw new Error('Expected Ghostling wrapper.');
    }
    const initialWrap = extractTranslate3d(wrap.style.transform);
    expect(screen.queryByRole('button', { name: 'Recenter scene' })).toBeNull();

    fireEvent.wheel(stage, {
      deltaY: 180,
      deltaMode: 0,
    });
    flushFrame(32);
    flushFrame(64);
    flushFrame(96);

    const recenterButton = screen.getByRole('button', { name: 'Recenter scene' });
    expect(recenterButton).not.toBeNull();

    fireEvent.click(recenterButton);
    flushFrame(128);
    flushFrame(176);
    flushFrame(224);
    flushFrame(288);

    const recenteredWrap = extractTranslate3d(wrap.style.transform);
    expect(Math.abs(recenteredWrap.x - initialWrap.x)).toBeLessThan(1);
    expect(screen.queryByRole('button', { name: 'Recenter scene' })).toBeNull();
  });

  it('keeps the mobile recenter button hidden on desktop layouts', () => {
    const payload = makePayload([makeMember('user:1', 'Member One')]);
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={payload}
        fallbackCompanion={makePreview()}
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const stage = getHeroStage(container);
    expect(stage.getAttribute('data-mobile-performance')).toBe('false');
    fireEvent.wheel(stage, {
      deltaY: 180,
      deltaMode: 0,
    });
    flushFrame(32);
    flushFrame(64);

    expect(screen.queryByRole('button', { name: 'Recenter scene' })).toBeNull();
  });

  it('updates anchor values from the scene lab controls and supports keyboard nudging', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    fireEvent.click(screen.getByText('Floor left outer'));
    const anchorX = screen.getByTestId('scene-lab-anchor-x') as HTMLInputElement;
    expect(anchorX.value).toBe(String(SHARED_COMMONS_WORLD.points[0]?.x));

    fireEvent.change(anchorX, { target: { value: '1042' } });
    expect(anchorX.value).toBe('1042');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(anchorX.value).toBe('1043');
  });

  it('drags scene lab anchors without snapping back to their origin', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    fireEvent.click(screen.getByText('Floor left outer'));
    const anchorX = screen.getByTestId('scene-lab-anchor-x') as HTMLInputElement;
    const selectedAnchor = container.querySelector('svg circle[r="7"][data-selected="true"]');
    if (!(selectedAnchor instanceof Element) || selectedAnchor.tagName.toLowerCase() !== 'circle') {
      throw new Error('Expected selected scene lab anchor circle.');
    }

    const originX = Number(anchorX.value);
    const expectedDelta = expectedWorldDragDelta(28, 12);

    fireEvent.pointerDown(selectedAnchor, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 128, clientY: 112 });
    fireEvent.pointerUp(window, { clientX: 128, clientY: 112 });

    expect(Number(anchorX.value)).toBe(originX + expectedDelta.x);
  });

  it('adds and removes anchors from the scene lab authored browser', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const initialAnchorCount = container.querySelectorAll('[data-scene-lab-role="anchor"]').length;
    fireEvent.click(screen.getByTestId('scene-lab-add-anchor'));

    expect(container.querySelectorAll('[data-scene-lab-role="anchor"]').length).toBe(initialAnchorCount + 1);
    expect(screen.getByTestId('scene-lab-anchor-x')).not.toBeNull();
    expect((screen.getByTestId('scene-lab-remove-anchor') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('scene-lab-remove-anchor'));

    expect(container.querySelectorAll('[data-scene-lab-role="anchor"]').length).toBe(initialAnchorCount);
  });

  it('copies a world draft from the scene lab export controls', async () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    await act(async () => {
      fireEvent.click(screen.getByText('Copy world'));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByTestId('scene-lab-export-status').textContent).toBe('World draft copied.');
  });

  it('filters authored objects in the scene lab browser search', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const search = screen.getByTestId('scene-lab-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'center safe' } });

    expect(screen.getByText('Center safe')).not.toBeNull();
    expect(screen.queryByText('Floor left outer')).toBeNull();
  });

  it('supports tabbed member diagnostics in the scene lab browser', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    fireEvent.click(screen.getByTestId('scene-lab-tab-members'));
    fireEvent.click(within(screen.getByTestId('scene-lab-object-browser')).getByText('Member One'));

    expect(screen.getByTestId('scene-lab-member-diagnostics')).not.toBeNull();
    expect(screen.queryByTestId('scene-lab-anchor-x')).toBeNull();
  });

  it('supports keyboard selection through the scene lab browser', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const search = screen.getByTestId('scene-lab-search');
    fireEvent.change(search, { target: { value: 'right outer' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    const anchorX = screen.getByTestId('scene-lab-anchor-x') as HTMLInputElement;
    const rightOuter = SHARED_COMMONS_WORLD.points.find((point) => point.key === 'floor-right-outer');
    expect(anchorX.value).toBe(String(rightOuter?.x));
  });

  it('undoes and redoes an anchor drag from the scene lab', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    fireEvent.click(screen.getByText('Floor left outer'));
    const anchorX = screen.getByTestId('scene-lab-anchor-x') as HTMLInputElement;
    const selectedAnchor = container.querySelector('svg circle[r="7"][data-selected="true"]');
    if (!(selectedAnchor instanceof Element) || selectedAnchor.tagName.toLowerCase() !== 'circle') {
      throw new Error('Expected selected scene lab anchor circle.');
    }

    const originX = Number(anchorX.value);
    const expectedDelta = expectedWorldDragDelta(28, 12);
    fireEvent.pointerDown(selectedAnchor, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 128, clientY: 112 });
    fireEvent.pointerUp(window, { clientX: 128, clientY: 112 });

    expect(Number(anchorX.value)).toBe(originX + expectedDelta.x);

    fireEvent.click(screen.getByTestId('scene-lab-undo'));
    expect(Number(anchorX.value)).toBe(originX);

    fireEvent.click(screen.getByTestId('scene-lab-redo'));
    expect(Number(anchorX.value)).toBe(originX + expectedDelta.x);
  });

  it('undos a tuning change with the standard keyboard shortcut', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const speedMin = screen.getByTestId('scene-lab-speed-min') as HTMLInputElement;
    const origin = speedMin.value;
    fireEvent.focus(speedMin);
    fireEvent.change(speedMin, { target: { value: '33' } });
    fireEvent.blur(speedMin);

    expect(speedMin.value).toBe('33');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(speedMin.value).toBe(origin);
  });

  it('does not add preview-only ghost count changes to scene lab history', () => {
    render(
      <GhostlingScene
        variant="hero"
        initialPayload={makePayload([makeMember('user:1', 'Member One')])}
        fallbackCompanion={makePreview()}
        sceneEditorEnabled
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const undo = screen.getByTestId('scene-lab-undo') as HTMLButtonElement;
    const ghostCount = screen.getByTestId('scene-lab-ghost-count') as HTMLInputElement;
    expect(undo.disabled).toBe(true);

    fireEvent.change(ghostCount, { target: { value: '4' } });

    expect(ghostCount.value).toBe('4');
    expect(undo.disabled).toBe(true);
  });

  it('shows the world debug overlay only when enabled in development-like environments', () => {
    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={{ members: [], source: 'empty' }}
        fallbackCompanion={makePreview()}
        debugWorldOverlay
      />,
    );

    flushFrame(0);
    flushFrame(16);

    const overlay = container.querySelector('svg');
    const profile = resolveGhostlingSceneProfile(viewportWidth, 'hero');
    const camera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      viewportWidth,
      viewportHeight,
      profile.bucket,
      'fixed-crop',
    );
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('viewBox')).toBe(`0 0 ${SHARED_COMMONS_WORLD.sourceWidth} ${SHARED_COMMONS_WORLD.sourceHeight}`);
    expect((overlay as SVGElement | null)?.style.left).toBe(`${camera.offsetX}px`);
  });

  it('suppresses the world debug overlay in production even if the flag is set', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { container } = render(
      <GhostlingScene
        variant="hero"
        initialPayload={{ members: [], source: 'empty' }}
        fallbackCompanion={makePreview()}
        debugWorldOverlay
      />,
    );

    flushFrame(0);
    flushFrame(16);

    expect(container.querySelector('svg')).toBeNull();
  });
});
