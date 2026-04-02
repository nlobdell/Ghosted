import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { SlotAudio } from '../audio';
import { SYMBOL_TEXTURES } from '../assets';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type ReelView = {
  frame: Graphics;
  glow: Graphics;
  mask: Graphics;
  strip: Container;
  x: number;
  y: number;
};

type SymbolTile = Container & {
  body?: Graphics;
  badge?: Graphics;
  glyph?: Text;
  labelText?: Text;
  sprite?: Sprite;
  symbolKey: string;
};

type MotionProfile = {
  baseDuration: number;
  cycles: number;
  overshoot: number;
  settleEase: (value: number) => number;
  spinEase: (value: number) => number;
  stagger: number;
};

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 960;
const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;
const REEL_WIDTH = 228;
const REEL_HEIGHT = 600;
const REEL_GAP = 24;
const ROW_HEIGHT = 190;
const TILE_WIDTH = 202;
const TILE_HEIGHT = 176;
const STRIP_PADDING_LEFT = 13;
const STRIP_PADDING_TOP = 12;
const CABINET_X = 42;
const CABINET_Y = 32;
const CABINET_WIDTH = STAGE_WIDTH - 84;
const CABINET_HEIGHT = STAGE_HEIGHT - 64;
const WINDOW_X = 74;
const WINDOW_Y = 88;
const WINDOW_WIDTH = STAGE_WIDTH - 148;
const WINDOW_HEIGHT = STAGE_HEIGHT - 176;
const INNER_X = 124;
const INNER_Y = 140;
const INNER_WIDTH = STAGE_WIDTH - 248;
const INNER_HEIGHT = STAGE_HEIGHT - 280;
const HEADER_HEIGHT = 98;

const MOTION_BY_GAME: Record<string, MotionProfile> = {
  'ghost-lanterns': { baseDuration: 1180, cycles: 8, overshoot: 24, settleEase: easeOutBack, spinEase: easeInOutSine, stagger: 210 },
  'jigsaw-jackpot': { baseDuration: 980, cycles: 7, overshoot: 18, settleEase: easeOutCubic, spinEase: easeOutCubic, stagger: 180 },
  'royal-heist': { baseDuration: 1220, cycles: 9, overshoot: 26, settleEase: easeOutQuart, spinEase: easeInOutQuart, stagger: 220 },
};

let preloadPromise: Promise<void> | null = null;

export class SlotRenderer {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private root: Container | null = null;
  private fxLayer: Container | null = null;
  private reels: ReelView[] = [];
  private activeGame: SlotGame | null = null;
  private readonly audio = new SlotAudio();
  private readonly effects: Array<Graphics | Text | Sprite> = [];

  async mount(host: HTMLElement) {
    if (this.host === host && this.app) return;
    this.destroy();

    this.host = host;
    this.app = new Application();
    await this.app.init({
      antialias: true,
      backgroundAlpha: 0,
      height: STAGE_HEIGHT,
      preference: 'webgl',
      resolution: Math.max(1, Math.min(window.devicePixelRatio || 1, 2)),
      width: STAGE_WIDTH,
    });

    host.innerHTML = '';
    host.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';

    await preloadAssets();
    this.root = new Container();
    this.fxLayer = new Container();
    this.app.stage.addChild(this.root);
    this.paintBackdrop();
  }

  destroy() {
    this.effects.splice(0).forEach((item) => item.destroy());
    this.reels = [];
    this.root = null;
    this.fxLayer = null;
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    if (this.host) {
      this.host.innerHTML = '';
    }
    this.host = null;
  }

  armAudio() {
    this.audio.arm();
  }

  async showMachine(game: SlotGame, result: SpinResult | null) {
    if (!this.root || !this.fxLayer) return;
    this.activeGame = game;
    this.buildMachine(game);
    this.setIdleState(result?.grid?.length ? result.grid : idleGrid(game));
    this.applyHighlights(result);
  }

  async playSpin(game: SlotGame, result: SpinResult) {
    if (!this.activeGame || this.activeGame.slug !== game.slug) {
      await this.showMachine(game, result);
      return;
    }

    this.armAudio();
    this.clearEffects();
    this.applyHighlights(null);
    this.audio.play('spinStart', { volume: 0.55 });

    await Promise.all(
      this.reels.map((reel, reelIndex) =>
        this.spinReel(reel, reelIndex, game.reelSymbols, result.grid[reelIndex] || [], result)
      )
    );

    if (result.freeSpinsAwarded) {
      this.audio.play('feature', { volume: 0.68 });
      await this.playFeatureTransition(`${result.freeSpinsAwarded} FREE SPINS`);
    } else if (result.payout > 0) {
      this.audio.play('win', { volume: Math.min(1, 0.45 + result.payout / 1200) });
    } else {
      this.audio.play('miss', { volume: 0.38 });
    }

    this.applyHighlights(result);
  }

  private paintBackdrop() {
    if (!this.root) return;
    const background = new Graphics();
    background.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill({ color: 0x12071f });
    this.root.addChild(background);
  }

  private buildMachine(game: SlotGame) {
    if (!this.root || !this.fxLayer) return;
    this.root.removeChildren().forEach((child) => child.destroy());
    this.root.addChild(new Graphics().rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill({ color: 0x12071f }));
    this.fxLayer.removeChildren().forEach((child) => child.destroy());
    this.effects.splice(0).forEach((item) => item.destroy());

    const accent = parseColor(game.accent, 0xb989ff);
    const reelWindowX = INNER_X + 42;
    const reelWindowY = INNER_Y + HEADER_HEIGHT + 42;
    const reelsStartX = reelWindowX + (INNER_WIDTH - 84 - (REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP)) * 0.5;
    const reelsStartY = reelWindowY;
    const paylineY = reelsStartY + STRIP_PADDING_TOP + ROW_HEIGHT + TILE_HEIGHT * 0.5;
    const reelShelfX = reelsStartX - 18;
    const reelShelfY = reelsStartY - 18;
    const reelShelfWidth = REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP + 36;
    const reelShelfHeight = REEL_HEIGHT + 36;

    this.root.addChild(
      roundedRect(CABINET_X, CABINET_Y, CABINET_WIDTH, CABINET_HEIGHT, 36, 0x160d24, 0.98, accent, 0.42, 6),
      roundedRect(WINDOW_X, WINDOW_Y, WINDOW_WIDTH, WINDOW_HEIGHT, 20, 0x0a0711, 0.98, 0x74d8ff, 0.72, 6),
      roundedRect(INNER_X, INNER_Y, INNER_WIDTH, INNER_HEIGHT, 14, 0x140d21, 0.95, 0xffffff, 0.08, 2),
      roundedRect(INNER_X, INNER_Y + 2, INNER_WIDTH, HEADER_HEIGHT, 10, 0x231137, 0.98, 0x5e4a86, 0.65, 2),
      roundedRect(reelShelfX, reelShelfY, reelShelfWidth, reelShelfHeight, 22, 0x0b0913, 0.92, accent, 0.16, 2),
      new Graphics().rect(reelsStartX - 10, paylineY - 3, REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP + 20, 6).fill({ color: 0xff5d8f, alpha: 0.94 }),
    );
    this.root.addChild(
      makeText(game.name.toUpperCase(), INNER_X + 38, INNER_Y + HEADER_HEIGHT * 0.5 + 2, '#fff4dc', 58, 0),
      makeText(`${game.paylinesCount} LINES`, INNER_X + INNER_WIDTH - 36, INNER_Y + HEADER_HEIGHT * 0.5 + 4, '#ffd68a', 28, 1),
      this.fxLayer,
    );

    this.reels = [];

    for (let reelIndex = 0; reelIndex < REEL_COUNT; reelIndex += 1) {
      const x = reelsStartX + reelIndex * (REEL_WIDTH + REEL_GAP);
      const y = reelsStartY;
      const glow = roundedRect(x - 8, y - 8, REEL_WIDTH + 16, REEL_HEIGHT + 16, 22, accent, 0, accent, 0.7, 0);
      const symbolBack = roundedRect(x, y, REEL_WIDTH, REEL_HEIGHT, 18, 0x0d0a14, 0.98, accent, 0.18, 2);
      const frame = roundedRect(x, y, REEL_WIDTH, REEL_HEIGHT, 18, 0x09070f, 0.98, 0xffffff, 0.12, 2);
      const strip = new Container();
      strip.x = x + STRIP_PADDING_LEFT;
      strip.y = y + STRIP_PADDING_TOP;
      const mask = new Graphics();
      mask.rect(x, y, REEL_WIDTH, REEL_HEIGHT).fill(0xffffff);
      strip.mask = mask;
      this.root.addChild(glow, symbolBack, frame, strip, mask);
      this.reels.push({ frame, glow, mask, strip, x, y });
    }
  }

  private setIdleState(grid: string[][]) {
    const game = this.activeGame;
    if (!game) return;

    this.reels.forEach((reel, reelIndex) => {
      this.renderStrip(reel, normalizeReel(grid[reelIndex] || [], game.reelSymbols));
      reel.strip.y = reel.y + STRIP_PADDING_TOP;
    });
  }

  private applyHighlights(result: SpinResult | null) {
    this.clearEffects();
    this.reels.forEach((reel) => {
      reel.glow.alpha = 0;
      resetReelFrame(reel.frame, reel.x, reel.y, 0xffffff, 0.12);
      reel.strip.children.forEach((child) => this.resetTile(child as SymbolTile));
    });

    if (!result) return;
    this.renderPaylines(result);
    result.lineWins.forEach((win) => win.positions.forEach(([reelIndex, rowIndex]) => this.highlightTile(reelIndex, rowIndex, 0xffd166)));
    (result.scatter?.positions || []).forEach(([reelIndex, rowIndex]) => this.highlightTile(reelIndex, rowIndex, 0x8cffc1));
  }

  private resetTile(tile: SymbolTile) {
    tile.scale.set(1);
    if (tile.body) {
      redrawTileBody(tile.body, 0x1a1028, 0xffffff, 0.08);
    }
    if (tile.badge) {
      redrawTileBadge(tile.badge, symbolMeta(tile.symbolKey).tint, 0.18, 0.45);
    }
    if (tile.sprite) {
      tile.sprite.scale.set(1);
      tile.sprite.rotation = 0;
      tile.sprite.alpha = 1;
      tile.sprite.tint = 0xffffff;
      tile.sprite.x = TILE_WIDTH * 0.5;
      tile.sprite.y = 54;
    }
  }

  private highlightTile(reelIndex: number, rowIndex: number, color: number) {
    const reel = this.reels[reelIndex];
    if (!reel) return;
    reel.glow.alpha = 1;
    resetReelFrame(reel.frame, reel.x, reel.y, color, 0.92, 3);

    const tile = reel.strip.children[rowIndex] as SymbolTile | undefined;
    if (!tile) return;
    if (tile.body) redrawTileBody(tile.body, 0x241832, color, 0.9);
    if (tile.badge) redrawTileBadge(tile.badge, color, 0.22, 0.88);
    void animate(320, (progress) => {
      tile.scale.set(1 + Math.sin(progress * Math.PI * 3) * 0.05);
    }, easeInOutSine);
    this.animateSymbolWin(tile, symbolMeta(tile.symbolKey).winEffect, color);
  }

  private animateSymbolWin(tile: SymbolTile, effect: ReturnType<typeof symbolMeta>['winEffect'], color: number) {
    const sprite = tile.sprite;
    if (!sprite) return;
    const baseX = TILE_WIDTH * 0.5;
    const baseY = 54;

    switch (effect) {
      case 'coin':
        void animate(560, (progress) => { sprite.rotation = progress * Math.PI * 2; }, easeOutCubic);
        break;
      case 'ghost':
        void animate(540, (progress) => { sprite.x = baseX + Math.sin(progress * Math.PI * 4) * 8; }, easeInOutSine);
        break;
      case 'lantern':
        void animate(520, (progress) => { sprite.rotation = Math.sin(progress * Math.PI * 4) * 0.16; }, easeInOutSine);
        break;
      case 'wild':
        sprite.tint = color;
        void animate(520, (progress) => { sprite.y = baseY - Math.sin(progress * Math.PI * 5) * 16; }, easeInOutSine);
        break;
      default:
        if (effect === 'gem' || effect === 'rune') sprite.tint = color;
        void animate(520, (progress) => { sprite.scale.set(1 + Math.sin(progress * Math.PI * 4) * 0.1); }, easeInOutSine);
        break;
    }
  }

  private async spinReel(reel: ReelView, reelIndex: number, poolSource: string[], finalReel: string[], result: SpinResult) {
    const profile = motionProfile(this.activeGame);
    const pool = poolSource.length ? poolSource : ['coin', 'moon', 'ghost'];
    const target = normalizeReel(finalReel, pool);
    const stripSymbols = [...Array.from({ length: (profile.cycles + reelIndex) * pool.length }, (_, index) => pool[(index + reelIndex) % pool.length]), ...target];
    const startY = reel.y + STRIP_PADDING_TOP;
    const targetY = startY - ((stripSymbols.length - VISIBLE_ROWS) * ROW_HEIGHT);

    this.renderStrip(reel, stripSymbols);
    reel.strip.y = startY;

    await animate(profile.baseDuration + reelIndex * profile.stagger, (progress) => {
      reel.strip.y = lerp(startY, targetY - profile.overshoot, profile.spinEase(progress));
      reel.glow.alpha = 0.08 + Math.sin(progress * Math.PI * 6) * 0.12;
    }, profile.spinEase);

    await animate(140, (progress) => {
      reel.strip.y = lerp(targetY - profile.overshoot, targetY, profile.settleEase(progress));
    }, profile.settleEase);

    this.audio.play('reelStop', { playbackRate: 1 + reelIndex * 0.04, volume: 0.44 });
    this.flashReelStop(reelIndex);
    this.renderStrip(reel, target);
    reel.strip.y = startY;
    reel.glow.alpha = 0;
  }

  private renderStrip(reel: ReelView, symbols: string[]) {
    reel.strip.removeChildren().forEach((child) => child.destroy());
    symbols.forEach((symbol, index) => {
      const tile = this.createSymbolTile(symbol);
      tile.x = 0;
      tile.y = index * ROW_HEIGHT;
      reel.strip.addChild(tile);
    });
  }

  private createSymbolTile(symbol: string) {
    const meta = symbolMeta(symbol);
    const tile = new Container() as SymbolTile;
    tile.symbolKey = symbol;

    const shadow = roundedRect(0, 8, TILE_WIDTH, TILE_HEIGHT, 28, 0x000000, 0.22, 0x000000, 0, 0);
    const body = roundedRect(0, 0, TILE_WIDTH, TILE_HEIGHT, 28, 0x1a1028, 1, 0xffffff, 0.08, 2);
    const badge = new Graphics();
    redrawTileBadge(badge, meta.tint, 0.18, 0.45);
    const sprite = Sprite.from(Texture.from(meta.textureUrl));
    sprite.width = 76;
    sprite.height = 76;
    sprite.anchor.set(0.5);
    sprite.x = TILE_WIDTH * 0.5;
    sprite.y = 54;
    const glyph = makeText(meta.glyph, TILE_WIDTH * 0.5, 52, '#ffffff', 12, 0.5);
    const label = makeText(meta.label.toUpperCase(), TILE_WIDTH * 0.5, 132, '#f2e9ff', 13, 0.5);

    tile.body = body;
    tile.badge = badge;
    tile.glyph = glyph;
    tile.labelText = label;
    tile.sprite = sprite;
    tile.addChild(shadow, body, badge, sprite, glyph, label);
    return tile;
  }

  private flashReelStop(reelIndex: number) {
    if (!this.fxLayer) return;
    const reel = this.reels[reelIndex];
    const flash = roundedRect(reel.x - 8, reel.y - 8, REEL_WIDTH + 16, REEL_HEIGHT + 16, 24, 0xffffff, 0.12, 0, 0, 0);
    this.fxLayer.addChild(flash);
    this.effects.push(flash);
    void animate(220, (progress) => { flash.alpha = 1 - progress; }, easeOutCubic).then(() => this.destroyEffect(flash));
  }

  private async playFeatureTransition(label: string) {
    if (!this.fxLayer) return;
    const overlay = new Graphics();
    overlay.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill({ color: 0x8cffc1, alpha: 0 });
    const banner = makeText(label, STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, '#f5fff9', 52, 0.5);
    banner.scale.set(0.82);
    this.fxLayer.addChild(overlay, banner);
    this.effects.push(overlay, banner);
    await animate(320, (progress) => {
      overlay.alpha = 0.2 * Math.sin(progress * Math.PI);
      banner.scale.set(0.82 + Math.sin(progress * Math.PI) * 0.18);
      banner.alpha = 0.5 + Math.sin(progress * Math.PI) * 0.5;
    }, easeInOutSine);
    this.destroyEffect(overlay);
    this.destroyEffect(banner);
  }

  private renderPaylines(result: SpinResult) {
    if (!this.fxLayer) return;
    const fxLayer = this.fxLayer;
    const colors = [0xffd166, 0x7bdff6, 0xff5d8f, 0x8cffc1, 0xd6b8ff];
    result.lineWins.forEach((win, index) => {
      const points = win.positions.slice().sort((a, b) => a[0] - b[0]).map(([reelIndex, rowIndex]) => this.tileCenter(reelIndex, rowIndex));
      if (points.length < 2) return;
      const color = colors[index % colors.length];
      const line = new Graphics();
      const tracer = new Graphics();
      tracer.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.95 }).stroke({ color, alpha: 0.92, width: 4 });
      fxLayer.addChild(line, tracer);
      this.effects.push(line, tracer);
      void animate(640, (progress) => {
        const point = pointAlongPolyline(points, progress);
        tracer.x = point.x;
        tracer.y = point.y;
        drawPolyline(line, points, progress, color);
      }, easeInOutSine);
    });
  }

  private tileCenter(reelIndex: number, rowIndex: number) {
    const reel = this.reels[reelIndex];
    return {
      x: reel.x + STRIP_PADDING_LEFT + TILE_WIDTH * 0.5,
      y: reel.y + STRIP_PADDING_TOP + rowIndex * ROW_HEIGHT + TILE_HEIGHT * 0.5,
    };
  }

  private clearEffects() {
    this.effects.splice(0).forEach((item) => item.destroy());
  }

  private destroyEffect(item: Graphics | Text | Sprite) {
    const index = this.effects.indexOf(item);
    if (index >= 0) this.effects.splice(index, 1);
    item.destroy();
  }
}

async function preloadAssets() {
  if (!preloadPromise) {
    preloadPromise = Assets.load(Object.values(SYMBOL_TEXTURES).map((asset) => asset.url)).then(() => undefined);
  }
  await preloadPromise;
}

function idleGrid(game: SlotGame) {
  return Array.from({ length: REEL_COUNT }, (_, reelIndex) =>
    Array.from({ length: VISIBLE_ROWS }, (_, rowIndex) => game.reelSymbols[(reelIndex + rowIndex) % game.reelSymbols.length] || 'coin')
  );
}

function normalizeReel(symbols: string[], pool: string[]) {
  const source = symbols.length ? symbols : pool;
  return Array.from({ length: VISIBLE_ROWS }, (_, rowIndex) => source[rowIndex] || pool[rowIndex % pool.length] || 'coin');
}

function motionProfile(game: SlotGame | null) {
  if (!game) {
    return { baseDuration: 980, cycles: 7, overshoot: 18, settleEase: easeOutCubic, spinEase: easeOutCubic, stagger: 180 };
  }
  return MOTION_BY_GAME[game.slug] || { baseDuration: 980, cycles: 7, overshoot: 18, settleEase: easeOutCubic, spinEase: easeOutCubic, stagger: 180 };
}

function parseColor(color: string, fallback: number) {
  const parsed = Number.parseInt(color.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundedRect(x: number, y: number, width: number, height: number, radius: number, fill: number, fillAlpha: number, stroke: number, strokeAlpha: number, strokeWidth = 0) {
  const graphic = new Graphics();
  graphic.roundRect(x, y, width, height, radius).fill({ color: fill, alpha: fillAlpha });
  if (strokeWidth > 0) {
    graphic.roundRect(x, y, width, height, radius).stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
  }
  return graphic;
}

function redrawTileBody(graphic: Graphics, fill: number, stroke: number, strokeAlpha: number) {
  graphic.clear();
  graphic.roundRect(0, 0, TILE_WIDTH, TILE_HEIGHT, 28).fill({ color: fill, alpha: 1 });
  graphic.roundRect(0, 0, TILE_WIDTH, TILE_HEIGHT, 28).stroke({ color: stroke, alpha: strokeAlpha, width: 3 });
}

function redrawTileBadge(graphic: Graphics, color: number, fillAlpha: number, strokeAlpha: number) {
  graphic.clear();
  graphic.circle(TILE_WIDTH * 0.5, 40, 24).fill({ color, alpha: fillAlpha }).stroke({ color, alpha: strokeAlpha, width: 3 });
}

function resetReelFrame(graphic: Graphics, x: number, y: number, stroke: number, strokeAlpha: number, strokeWidth = 2) {
  graphic.clear();
  graphic.roundRect(x, y, REEL_WIDTH, REEL_HEIGHT, 18).fill({ color: 0x09070f, alpha: 0.98 });
  graphic.roundRect(x, y, REEL_WIDTH, REEL_HEIGHT, 18).stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
}

function makeText(content: string, x: number, y: number, fill: string, size: number, anchor = 0) {
  const text = new Text({
    text: content,
    style: {
      fill,
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: size,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
  });
  text.x = x;
  text.y = y;
  text.anchor.set(anchor, 0.5);
  return text;
}

function drawPolyline(graphic: Graphics, points: Array<{ x: number; y: number }>, progress: number, color: number) {
  graphic.clear();
  graphic.moveTo(points[0]!.x, points[0]!.y);
  const point = pointAlongPolyline(points, progress);
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]!;
    if ((index / (points.length - 1)) <= progress) {
      graphic.lineTo(current.x, current.y);
    } else {
      graphic.lineTo(point.x, point.y);
      break;
    }
  }
  graphic.stroke({ color, alpha: 0.94, width: 8 });
}

function pointAlongPolyline(points: Array<{ x: number; y: number }>, progress: number) {
  const clamped = clamp(progress, 0, 1);
  const segments = Math.max(1, points.length - 1);
  const scaled = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - index;
  const start = points[index]!;
  const end = points[Math.min(points.length - 1, index + 1)]!;
  return { x: lerp(start.x, end.x, local), y: lerp(start.y, end.y, local) };
}

function animate(duration: number, update: (progress: number) => void, easing: (value: number) => number) {
  return new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = (time: number) => {
      const raw = clamp((time - started) / duration, 0, 1);
      update(easing(raw));
      if (raw < 1) {
        requestAnimationFrame(tick);
        return;
      }
      resolve();
    };
    requestAnimationFrame(tick);
  });
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeOutQuart(value: number) {
  return 1 - Math.pow(1 - value, 4);
}

function easeInOutQuart(value: number) {
  return value < 0.5 ? 8 * value * value * value * value : 1 - Math.pow(-2 * value + 2, 4) / 2;
}

function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function easeOutBack(value: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}
