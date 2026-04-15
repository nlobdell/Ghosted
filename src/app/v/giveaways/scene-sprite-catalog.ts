import type {
  LootChestChestAnimationState,
  LootChestChestSpriteState,
  LootChestTurnResult,
} from '@/lib/types';

export type SceneSpritePlayback = 'static' | 'once' | 'loop';

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
  visibleBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
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

const CHEST_SPRITES: Record<LootChestChestSpriteState, SceneSpriteSpec> = {
  closed: {
    ...staticSprite('chest-closed', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: { left: 2, top: 12, right: 29, bottom: 31 },
  },
  selected: {
    ...staticSprite('chest-selected', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: { left: 2, top: 12, right: 29, bottom: 31 },
  },
  locked: {
    ...staticSprite('chest-locked', '/giveaways/sprites/chest.png', { pixelated: true }),
    frameWidth: 48,
    frameHeight: 32,
    visibleBounds: { left: 2, top: 12, right: 29, bottom: 31 },
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
    visibleBounds: { left: 2, top: 12, right: 29, bottom: 31 },
  },
  empty: staticSprite('chest-empty', '/giveaways/sprites/chest-empty.svg', { pixelated: true }),
  prize: staticSprite('chest-prize', '/giveaways/sprites/chest-prize.svg', { pixelated: true }),
  'resolved-empty': staticSprite('chest-resolved-empty', '/giveaways/sprites/chest-empty.svg', { pixelated: true }),
  'resolved-prize': staticSprite('chest-resolved-prize', '/giveaways/sprites/chest-prize.svg', { pixelated: true }),
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

export function getBoardBackdropSpriteSpec() {
  return BOARD_BACKDROP;
}

export function getBoardFrameSpriteSpec() {
  return BOARD_FRAME;
}

export function getChestSpriteSpec(
  spriteState: LootChestChestSpriteState,
  animationState: LootChestChestAnimationState,
): SceneSpriteSpec {
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
