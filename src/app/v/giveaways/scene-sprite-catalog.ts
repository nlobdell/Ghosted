import type {
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestTurnResult,
} from '@/lib/types';

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
  frameBounds?: Array<SceneSpriteBounds | undefined>;
  frameAnchorBounds?: Array<SceneSpriteBounds | undefined>;
};

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

const CLOSED_CHEST_BOUNDS = { left: 2, top: 12, right: 29, bottom: 31 } as const;
const SELECTED_CHEST_BOUNDS = { left: 2, top: 2, right: 29, bottom: 31 } as const;
const EMPTY_CHEST_BOUNDS = { left: 2, top: 21, right: 40, bottom: 31 } as const;
const PRIZE_CHEST_BOUNDS = { left: 2, top: 2, right: 40, bottom: 31 } as const;
const OPENING_CHEST_FRAME_BOUNDS = [
  { left: 2, top: 12, right: 29, bottom: 31 },
  { left: 2, top: 12, right: 29, bottom: 31 },
  { left: 1, top: 13, right: 29, bottom: 31 },
  { left: 1, top: 13, right: 29, bottom: 31 },
  { left: 2, top: 11, right: 29, bottom: 31 },
  { left: 2, top: 11, right: 30, bottom: 31 },
  { left: 2, top: 9, right: 31, bottom: 31 },
  { left: 2, top: 23, right: 41, bottom: 31 },
  { left: 2, top: 21, right: 40, bottom: 31 },
  { left: 2, top: 21, right: 40, bottom: 31 },
] as const satisfies SceneSpriteBounds[];
const WINNER_CHEST_FRAME_BOUNDS = [
  { left: 2, top: 12, right: 29, bottom: 31 },
  { left: 2, top: 12, right: 29, bottom: 31 },
  { left: 1, top: 13, right: 29, bottom: 31 },
  { left: 1, top: 13, right: 29, bottom: 31 },
  { left: 2, top: 11, right: 29, bottom: 31 },
  { left: 2, top: 11, right: 30, bottom: 31 },
  { left: 2, top: 9, right: 31, bottom: 31 },
  { left: 2, top: 12, right: 41, bottom: 31 },
  { left: 2, top: 8, right: 40, bottom: 31 },
  { left: 2, top: 2, right: 40, bottom: 31 },
] as const satisfies SceneSpriteBounds[];
const STABLE_CHEST_ANCHOR_BOUNDS = Array.from({ length: 10 }, () => CLOSED_CHEST_BOUNDS);

const CHEST_SPRITES: Record<LootChestChestSpriteState, SceneSpriteSpec> = {
  closed: {
    ...staticSprite('chest-closed', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
  },
  selected: {
    ...staticSprite('chest-selected', '/giveaways/sprites/chest-selected.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: SELECTED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
  },
  locked: {
    ...staticSprite('chest-locked', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
  },
  opening: {
    id: 'chest-opening',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: 10,
    frameWidth: 48,
    frameHeight: 32,
    playback: 'once',
    durationMs: 680,
    pixelated: true,
    visibleBounds: CLOSED_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  },
  empty: {
    id: 'chest-empty',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: 10,
    frameWidth: 48,
    frameHeight: 32,
    playback: 'static',
    initialFrame: 9,
    pixelated: true,
    visibleBounds: EMPTY_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  },
  prize: {
    id: 'chest-prize',
    src: '/giveaways/sprites/chest-opening-animation-winner.png',
    frames: 10,
    frameWidth: 48,
    frameHeight: 32,
    playback: 'static',
    initialFrame: 9,
    pixelated: true,
    visibleBounds: PRIZE_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: WINNER_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  },
  'resolved-empty': {
    id: 'chest-resolved-empty',
    src: '/giveaways/sprites/chest-opening-animation.png',
    frames: 10,
    frameWidth: 48,
    frameHeight: 32,
    playback: 'static',
    initialFrame: 9,
    pixelated: true,
    visibleBounds: EMPTY_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: OPENING_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  },
  'resolved-prize': {
    id: 'chest-resolved-prize',
    src: '/giveaways/sprites/chest-opening-animation-winner.png',
    frames: 10,
    frameWidth: 48,
    frameHeight: 32,
    playback: 'static',
    initialFrame: 9,
    pixelated: true,
    visibleBounds: PRIZE_CHEST_BOUNDS,
    anchorBounds: CLOSED_CHEST_BOUNDS,
    frameBounds: WINNER_CHEST_FRAME_BOUNDS,
    frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
  },
};

const WINNER_OPENING_SPRITE: SceneSpriteSpec = {
  id: 'chest-opening-winner',
  src: '/giveaways/sprites/chest-opening-animation-winner.png',
  frames: 10,
  frameWidth: 48,
  frameHeight: 32,
  playback: 'once',
  durationMs: 680,
  pixelated: true,
  visibleBounds: PRIZE_CHEST_BOUNDS,
  anchorBounds: CLOSED_CHEST_BOUNDS,
  frameBounds: WINNER_CHEST_FRAME_BOUNDS,
  frameAnchorBounds: STABLE_CHEST_ANCHOR_BOUNDS,
};

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

const BOARD_BACKDROP = staticSprite('board-backdrop', '/giveaways/sprites/backdrop.svg');
const BOARD_FRAME = staticSprite('board-frame', '/giveaways/sprites/board-frame.svg');
const BOARD_FRAME_OVERLAY = staticSprite('board-frame-overlay', '/giveaways/sprites/board-frame-overlay.svg');

export function getBoardBackdropSpriteSpec() {
  return BOARD_BACKDROP;
}

export function getBoardFrameSpriteSpec(variant: 'default' | 'overlay' = 'default') {
  return variant === 'overlay' ? BOARD_FRAME_OVERLAY : BOARD_FRAME;
}

export function getChestSpriteSpec(
  spriteState: LootChestChestSpriteState,
  animationState: LootChestChestAnimationState,
  options?: {
    winner?: boolean;
  },
): SceneSpriteSpec {
  if (spriteState === 'opening' && options?.winner) {
    return WINNER_OPENING_SPRITE;
  }

  const base = CHEST_SPRITES[spriteState];

  if (base.frames > 1) {
    return base;
  }

  if (animationState === 'opening') {
    return {
      ...base,
      playback: 'once',
      durationMs: 560,
    };
  }

  if (animationState === 'pulse') {
    return {
      ...base,
      playback: 'loop',
      durationMs: 860,
    };
  }

  if (animationState === 'burst') {
    return {
      ...base,
      playback: 'once',
      durationMs: 520,
    };
  }

  return base;
}

export function getResultSpriteSpec(result: Exclude<LootChestTurnResult, 'pending'> | null | undefined) {
  if (!result) {
    return null;
  }

  return RESULT_SPRITES[result];
}
