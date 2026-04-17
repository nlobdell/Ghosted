import type {
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestTurnResult,
} from '@/lib/types';
import { CHEST_SPRITE_GEOMETRY } from './generated-sprite-geometry';

export type SceneSpritePlayback = 'static' | 'once' | 'loop';

type SceneSpriteBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SceneSpriteSpec = {
  id: string;
  src: string;
  frames: number;
  frameWidth?: number;
  frameHeight?: number;
  durationMs?: number;
  playback: SceneSpritePlayback;
  initialFrame?: number;
  pixelated?: boolean;
  visibleBounds?: SceneSpriteBounds;
  anchorBounds?: SceneSpriteBounds;
  frameBounds?: ReadonlyArray<SceneSpriteBounds | undefined>;
  frameAnchorBounds?: ReadonlyArray<SceneSpriteBounds | undefined>;
  interactionBounds?: SceneSpriteBounds;
  interactionAnchorBounds?: SceneSpriteBounds;
  frameInteractionBounds?: ReadonlyArray<SceneSpriteBounds | undefined>;
  frameInteractionAnchorBounds?: ReadonlyArray<SceneSpriteBounds | undefined>;
  textureLayer?: SceneSpriteTextureLayer;
  detailLayer?: SceneSpriteDetailLayer;
};

export type SceneSpriteTextureLayer = {
  src: string;
  maskSrc?: string;
  maskFrames?: number;
  repeat?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  size?: string;
  durationMs?: number;
  scrollX?: string;
  scrollY?: string;
  opacity?: number;
  pixelated?: boolean;
};

export type SceneSpriteDetailLayer = {
  src?: string;
  opacity?: number;
  mixBlendMode?: string;
  filter?: string;
  pixelated?: boolean;
};

export type SceneSpriteVisibleRegion = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  anchorShiftPct: number;
};

function versionedSpriteSrc(src: string, assetVersion?: string) {
  if (!assetVersion) {
    return src;
  }

  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}v=${encodeURIComponent(assetVersion)}`;
}

function withAssetVersion(spec: SceneSpriteSpec, assetVersion?: string): SceneSpriteSpec {
  if (!assetVersion) {
    return spec;
  }

  return {
    ...spec,
    src: versionedSpriteSrc(spec.src, assetVersion),
    textureLayer: spec.textureLayer ? {
      ...spec.textureLayer,
      src: versionedSpriteSrc(spec.textureLayer.src, assetVersion),
      maskSrc: spec.textureLayer.maskSrc ? versionedSpriteSrc(spec.textureLayer.maskSrc, assetVersion) : undefined,
    } : undefined,
    detailLayer: spec.detailLayer ? {
      ...spec.detailLayer,
      src: spec.detailLayer.src ? versionedSpriteSrc(spec.detailLayer.src, assetVersion) : undefined,
    } : undefined,
  };
}

function clampFrameIndex(spec: SceneSpriteSpec, frameIndex: number) {
  if (spec.frames <= 1) {
    return 0;
  }

  return Math.max(0, Math.min(spec.frames - 1, frameIndex));
}

function staticSprite(
  id: string,
  src: string,
  options?: Partial<Pick<SceneSpriteSpec, 'pixelated' | 'initialFrame'>>,
): SceneSpriteSpec {
  return {
    id,
    src,
    frames: 1,
    playback: 'static',
    ...options,
  };
}

const CLOSED_CHEST_BOUNDS = CHEST_SPRITE_GEOMETRY.closed.bounds;
const SELECTED_CHEST_BOUNDS = CHEST_SPRITE_GEOMETRY.selected.bounds;
const EMPTY_CHEST_BOUNDS = CHEST_SPRITE_GEOMETRY.opening.finalBounds;
const PRIZE_CHEST_BOUNDS = CHEST_SPRITE_GEOMETRY.winnerOpening.finalBounds;
const OPENING_CHEST_FRAME_BOUNDS = CHEST_SPRITE_GEOMETRY.opening.frameBounds;
const WINNER_CHEST_FRAME_BOUNDS = CHEST_SPRITE_GEOMETRY.winnerOpening.frameBounds;
const CLOSED_CHEST_INTERACTION_BOUNDS = CHEST_SPRITE_GEOMETRY.openingMask.bounds;
const OPENING_CHEST_INTERACTION_FRAME_BOUNDS = CHEST_SPRITE_GEOMETRY.openingMask.frameBounds;
const OPENED_CHEST_INTERACTION_BOUNDS = CHEST_SPRITE_GEOMETRY.openingMask.finalBounds;
const STABLE_CHEST_ANCHOR_BOUNDS = Array.from(
  { length: CHEST_SPRITE_GEOMETRY.opening.frameBounds.length },
  () => CLOSED_CHEST_BOUNDS,
);

const INFERNAL_CHEST_TEXTURE: SceneSpriteTextureLayer = {
  src: '/giveaways/sprites/infernal-cape-texture.png',
  maskSrc: '/giveaways/sprites/chest-opening-animation-mask.png',
  maskFrames: OPENING_CHEST_FRAME_BOUNDS.length,
  repeat: 'repeat',
  size: '128px 128px',
  durationMs: 2200,
  scrollY: '-128px',
  opacity: 0.84,
  pixelated: true,
};

function withInfernalChestTexture(spec: SceneSpriteSpec): SceneSpriteSpec {
  return {
    ...spec,
    textureLayer: INFERNAL_CHEST_TEXTURE,
  };
}

const CHEST_SPRITES: Record<LootChestChestSpriteState, SceneSpriteSpec> = {
  closed: withInfernalChestTexture({
    ...staticSprite('chest-closed', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: CHEST_SPRITE_GEOMETRY.closed.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.closed.frameHeight,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    interactionBounds: CLOSED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
  }),
  selected: withInfernalChestTexture({
    ...staticSprite('chest-selected', '/giveaways/sprites/chest-selected.png', { pixelated: true }),
    frameWidth: CHEST_SPRITE_GEOMETRY.selected.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.selected.frameHeight,
    visibleBounds: SELECTED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    interactionBounds: CLOSED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
  }),
  locked: withInfernalChestTexture({
    ...staticSprite('chest-locked', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: CHEST_SPRITE_GEOMETRY.closed.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.closed.frameHeight,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    interactionBounds: CLOSED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
  }),
  opening: withInfernalChestTexture({
    id: 'chest-opening',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: OPENING_CHEST_FRAME_BOUNDS.length,
    frameWidth: CHEST_SPRITE_GEOMETRY.opening.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.opening.frameHeight,
    playback: 'once',
    durationMs: 680,
    pixelated: true,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
    interactionBounds: CLOSED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
    frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
    frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  }),
  empty: withInfernalChestTexture({
    id: 'chest-empty',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: OPENING_CHEST_FRAME_BOUNDS.length,
    frameWidth: CHEST_SPRITE_GEOMETRY.opening.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.opening.frameHeight,
    playback: 'static',
    initialFrame: OPENING_CHEST_FRAME_BOUNDS.length - 1,
    pixelated: true,
    visibleBounds: EMPTY_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
    interactionBounds: OPENED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
    frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
    frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  }),
  prize: withInfernalChestTexture({
    id: 'chest-prize',
    src: '/giveaways/sprites/chest-opening-animation-winner.png',
    frames: WINNER_CHEST_FRAME_BOUNDS.length,
    frameWidth: CHEST_SPRITE_GEOMETRY.winnerOpening.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.winnerOpening.frameHeight,
    playback: 'static',
    initialFrame: WINNER_CHEST_FRAME_BOUNDS.length - 1,
    pixelated: true,
    visibleBounds: PRIZE_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: WINNER_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
    interactionBounds: OPENED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
    frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
    frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  }),
  'resolved-empty': withInfernalChestTexture({
    id: 'chest-resolved-empty',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: OPENING_CHEST_FRAME_BOUNDS.length,
    frameWidth: CHEST_SPRITE_GEOMETRY.opening.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.opening.frameHeight,
    playback: 'static',
    initialFrame: OPENING_CHEST_FRAME_BOUNDS.length - 1,
    pixelated: true,
    visibleBounds: EMPTY_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
    interactionBounds: OPENED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
    frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
    frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  }),
  'resolved-prize': withInfernalChestTexture({
    id: 'chest-resolved-prize',
    src: '/giveaways/sprites/chest-opening-animation-winner.png',
    frames: WINNER_CHEST_FRAME_BOUNDS.length,
    frameWidth: CHEST_SPRITE_GEOMETRY.winnerOpening.frameWidth,
    frameHeight: CHEST_SPRITE_GEOMETRY.winnerOpening.frameHeight,
    playback: 'static',
    initialFrame: WINNER_CHEST_FRAME_BOUNDS.length - 1,
    pixelated: true,
    visibleBounds: PRIZE_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: WINNER_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
    interactionBounds: OPENED_CHEST_INTERACTION_BOUNDS,
    interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
    frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
    frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  }),
};

const WINNER_OPENING_SPRITE: SceneSpriteSpec = withInfernalChestTexture({
  id: 'chest-opening-winner',
  src: '/giveaways/sprites/chest-opening-animation-winner.png',
  frames: WINNER_CHEST_FRAME_BOUNDS.length,
  frameWidth: CHEST_SPRITE_GEOMETRY.winnerOpening.frameWidth,
  frameHeight: CHEST_SPRITE_GEOMETRY.winnerOpening.frameHeight,
  playback: 'once',
  durationMs: 680,
  pixelated: true,
  visibleBounds: PRIZE_CHEST_BOUNDS,
  anchorBounds: CLOSED_CHEST_BOUNDS,
  frameBounds: WINNER_CHEST_FRAME_BOUNDS,
  frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  interactionBounds: CLOSED_CHEST_INTERACTION_BOUNDS,
  interactionAnchorBounds: CLOSED_CHEST_BOUNDS,
  frameInteractionBounds: OPENING_CHEST_INTERACTION_FRAME_BOUNDS,
  frameInteractionAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
});

const RESULT_SPRITES: Record<Exclude<LootChestTurnResult, 'pending'>, SceneSpriteSpec> = {
  win: {
    id: 'result-win',
    src: '/giveaways/sprites/result-win.svg',
    frames: 1,
    playback: 'once',
    durationMs: 480,
  },
  miss: {
    id: 'result-miss',
    src: '/giveaways/sprites/result-miss.svg',
    frames: 1,
    playback: 'once',
    durationMs: 480,
  },
};

const BOARD_BACKDROP = staticSprite('board-backdrop', '/giveaways/sprites/jad-scene-backdrop.webp');
const BOARD_FRAME = staticSprite('board-frame', '/giveaways/sprites/board-frame.svg');
const BOARD_FRAME_OVERLAY = staticSprite('board-frame-overlay', '/giveaways/sprites/board-frame-overlay.svg');

export function getBoardBackdropSpriteSpec(assetVersion?: string) {
  return withAssetVersion(BOARD_BACKDROP, assetVersion);
}

export function getBoardFrameSpriteSpec(
  variant: 'default' | 'overlay' = 'default',
  assetVersion?: string,
) {
  return withAssetVersion(variant === 'overlay' ? BOARD_FRAME_OVERLAY : BOARD_FRAME, assetVersion);
}

export function getChestSpriteSpec(
  spriteState: LootChestChestSpriteState,
  animationState: LootChestChestAnimationState,
  options?: {
    winner?: boolean;
    assetVersion?: string;
  },
): SceneSpriteSpec {
  if (spriteState === 'opening' && options?.winner) {
    return withAssetVersion(WINNER_OPENING_SPRITE, options.assetVersion);
  }

  const base = CHEST_SPRITES[spriteState];

  if (base.frames > 1) {
    return withAssetVersion(base, options?.assetVersion);
  }

  if (animationState === 'opening') {
    return withAssetVersion({
      ...base,
      playback: 'once',
      durationMs: 560,
    }, options?.assetVersion);
  }

  if (animationState === 'pulse') {
    return withAssetVersion({
      ...base,
      playback: 'loop',
      durationMs: 860,
    }, options?.assetVersion);
  }

  if (animationState === 'burst') {
    return withAssetVersion({
      ...base,
      playback: 'once',
      durationMs: 520,
    }, options?.assetVersion);
  }

  return withAssetVersion(base, options?.assetVersion);
}

export function getResultSpriteSpec(
  result: Exclude<LootChestTurnResult, 'pending'> | null | undefined,
  assetVersion?: string,
) {
  if (!result) {
    return null;
  }

  return withAssetVersion(RESULT_SPRITES[result], assetVersion);
}

function getSceneSpriteRegion(
  spec: SceneSpriteSpec,
  frameIndex: number,
  kind: 'visible' | 'interaction',
): SceneSpriteVisibleRegion | null {
  if (!spec.frameWidth || !spec.frameHeight) {
    return null;
  }

  const resolvedFrameIndex = clampFrameIndex(spec, frameIndex);
  const bounds = kind === 'interaction'
    ? (spec.frameInteractionBounds?.[resolvedFrameIndex] ?? spec.interactionBounds ?? spec.frameBounds?.[resolvedFrameIndex] ?? spec.visibleBounds)
    : (spec.frameBounds?.[resolvedFrameIndex] ?? spec.visibleBounds);
  if (!bounds) {
    return null;
  }

  const anchorBounds = kind === 'interaction'
    ? (spec.frameInteractionAnchorBounds?.[resolvedFrameIndex]
      ?? spec.interactionAnchorBounds
      ?? spec.frameAnchorBounds?.[resolvedFrameIndex]
      ?? spec.anchorBounds
      ?? bounds)
    : (spec.frameAnchorBounds?.[resolvedFrameIndex] ?? spec.anchorBounds ?? bounds);
  const visibleCenter = (anchorBounds.left + anchorBounds.right + 1) / 2;
  const frameCenter = spec.frameWidth / 2;

  return {
    leftPct: (bounds.left / spec.frameWidth) * 100,
    topPct: (bounds.top / spec.frameHeight) * 100,
    widthPct: (((bounds.right - bounds.left) + 1) / spec.frameWidth) * 100,
    heightPct: (((bounds.bottom - bounds.top) + 1) / spec.frameHeight) * 100,
    anchorShiftPct: ((frameCenter - visibleCenter) / spec.frameWidth) * 100,
  };
}

export function getSceneSpriteVisibleRegion(
  spec: SceneSpriteSpec,
  frameIndex = spec.initialFrame ?? 0,
): SceneSpriteVisibleRegion | null {
  return getSceneSpriteRegion(spec, frameIndex, 'visible');
}

export function getSceneSpriteInteractionRegion(
  spec: SceneSpriteSpec,
  frameIndex = spec.initialFrame ?? 0,
): SceneSpriteVisibleRegion | null {
  return getSceneSpriteRegion(spec, frameIndex, 'interaction');
}
