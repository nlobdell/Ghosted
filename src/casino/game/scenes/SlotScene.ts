import Phaser from 'phaser';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type ReelView = {
  frame: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  maskShape: Phaser.GameObjects.Graphics;
  strip: Phaser.GameObjects.Container;
  x: number;
  y: number;
};

const STAGE_WIDTH = 760;
const STAGE_HEIGHT = 500;
const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;
const REEL_WIDTH = 112;
const REEL_HEIGHT = 316;
const REEL_GAP = 12;
const ROW_HEIGHT = 96;
const TILE_WIDTH = 98;
const TILE_HEIGHT = 88;
const STRIP_PADDING_TOP = 14;
const STRIP_PADDING_LEFT = 7;

export class SlotScene extends Phaser.Scene {
  private readyResolve!: () => void;
  readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private root?: Phaser.GameObjects.Container;
  private reels: ReelView[] = [];
  private activeGame: SlotGame | null = null;

  constructor() {
    super('slot-scene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#120b1d');
    this.createBackdrop();
    this.readyResolve();
  }

  async showMachine(game: SlotGame, result: SpinResult | null) {
    await this.ready;
    this.activeGame = game;
    this.buildMachine(game);
    this.setIdleState(result?.grid?.length ? result.grid : idleGrid(game));
    this.applyHighlights(result);
  }

  async playSpin(game: SlotGame, result: SpinResult) {
    await this.ready;
    if (!this.activeGame || this.activeGame.slug !== game.slug) {
      await this.showMachine(game, result);
      return;
    }

    this.applyHighlights(null);
    await Promise.all(
      this.reels.map((reel, reelIndex) =>
        this.spinReel(reel, reelIndex, game.reelSymbols, result.grid[reelIndex] || [])
      )
    );
    this.applyHighlights(result);
  }

  resize(width: number, height: number) {
    this.scale.resize(width, height);
    if (!this.root) return;
    const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
    this.root.setScale(scale);
    this.root.x = Math.max(0, (width - STAGE_WIDTH * scale) * 0.5);
    this.root.y = Math.max(0, (height - STAGE_HEIGHT * scale) * 0.5);
  }

  private createBackdrop() {
    const background = this.add.graphics();
    background.fillGradientStyle(0x31164d, 0x160922, 0x0b0610, 0x1f1032, 1);
    background.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    for (let index = 0; index < 10; index += 1) {
      const orb = this.add.circle(
        Phaser.Math.Between(30, STAGE_WIDTH - 30),
        Phaser.Math.Between(24, STAGE_HEIGHT - 24),
        Phaser.Math.Between(3, 7),
        Phaser.Math.RND.pick([0xffd166, 0xff5d8f, 0x7bdff6]),
        Phaser.Math.FloatBetween(0.08, 0.18)
      );
      this.tweens.add({
        targets: orb,
        alpha: { from: orb.alpha, to: Math.min(0.3, orb.alpha + 0.08) },
        duration: Phaser.Math.Between(1400, 2600),
        repeat: -1,
        yoyo: true,
      });
    }
  }

  private buildMachine(game: SlotGame) {
    this.root?.destroy(true);
    this.root = this.add.container(0, 0);
    this.resize(this.scale.width, this.scale.height);

    const accent = parseColor(game.accent, 0xb989ff);
    const cabinetGlow = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 702, 430, accent, 0.06);
    const cabinet = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 690, 418, 0x150d21, 0.98);
    cabinet.setStrokeStyle(3, accent, 0.56);
    const window = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 650, 366, 0x0a0711, 0.96);
    window.setStrokeStyle(1, 0xffffff, 0.08);
    const payline = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 598, 4, 0xff5d8f, 0.92);
    const topBar = this.add.rectangle(STAGE_WIDTH * 0.5, 84, 650, 48, 0x201132, 0.92);
    topBar.setStrokeStyle(1, accent, 0.3);
    const topLabel = this.add.text(88, 68, game.name.toUpperCase(), {
      color: '#fff4dc',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '24px',
      fontStyle: '700',
      letterSpacing: 1.4,
    });
    const topMeta = this.add.text(672, 72, `${game.paylinesCount} LINES`, {
      align: 'right',
      color: '#ffd68a',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '16px',
      fontStyle: '700',
    });
    topMeta.setOrigin(1, 0);

    this.root.add([cabinetGlow, cabinet, window, topBar, payline, topLabel, topMeta]);

    this.reels = [];
    const reelsStartX = (STAGE_WIDTH - (REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP)) * 0.5;
    const reelsStartY = (STAGE_HEIGHT - REEL_HEIGHT) * 0.5;

    for (let reelIndex = 0; reelIndex < REEL_COUNT; reelIndex += 1) {
      const x = reelsStartX + reelIndex * (REEL_WIDTH + REEL_GAP);
      const y = reelsStartY;
      const glow = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH + 8, REEL_HEIGHT + 8, accent, 0);
      const frame = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH, REEL_HEIGHT, 0x09070f, 0.98);
      frame.setStrokeStyle(2, 0xffffff, 0.08);
      const strip = this.add.container(x + STRIP_PADDING_LEFT, y + STRIP_PADDING_TOP);
      const maskShape = this.add.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(x, y, REEL_WIDTH, REEL_HEIGHT);
      strip.setMask(maskShape.createGeometryMask());
      this.root.add([glow, frame, strip]);
      this.reels.push({ frame, glow, maskShape, strip, x, y });
    }
  }

  private setIdleState(grid: string[][]) {
    const game = this.activeGame;
    if (!game) return;

    this.reels.forEach((reel, reelIndex) => {
      const symbols = normalizeReel(grid[reelIndex] || [], game.reelSymbols);
      this.renderStrip(reel, [...symbols], 0);
    });
  }

  private applyHighlights(result: SpinResult | null) {
    this.reels.forEach((reel) => {
      reel.glow.setAlpha(0);
      reel.frame.setStrokeStyle(2, 0xffffff, 0.08);
      reel.strip.iterate((child: Phaser.GameObjects.GameObject) => {
        const container = child as Phaser.GameObjects.Container;
        const icon = container.list[2] as Phaser.GameObjects.Text | undefined;
        if (icon) {
          icon.setScale(1);
        }
      });
    });

    if (!result) return;

    for (const win of result.lineWins || []) {
      for (const [reelIndex, rowIndex] of win.positions) {
        this.highlightTile(reelIndex, rowIndex, 0xffd166);
      }
    }
    for (const [reelIndex, rowIndex] of result.scatter?.positions || []) {
      this.highlightTile(reelIndex, rowIndex, 0x8cffc1);
    }
  }

  private highlightTile(reelIndex: number, rowIndex: number, color: number) {
    const reel = this.reels[reelIndex];
    if (!reel) return;
    reel.glow.setFillStyle(color, 0.18);
    reel.glow.setAlpha(1);
    reel.frame.setStrokeStyle(3, color, 0.92);

    const tile = reel.strip.list[rowIndex] as Phaser.GameObjects.Container | undefined;
    if (!tile) return;
    const icon = tile.list[2] as Phaser.GameObjects.Text | undefined;
    if (!icon) return;
    this.tweens.add({
      targets: icon,
      scale: 1.08,
      duration: 160,
      repeat: 3,
      yoyo: true,
    });
  }

  private spinReel(reel: ReelView, reelIndex: number, poolSource: string[], finalReel: string[]) {
    const pool = poolSource.length ? poolSource : ['coin', 'moon', 'ghost'];
    const target = normalizeReel(finalReel, pool);
    const cycles = 5 + reelIndex;
    const travelSymbols = Array.from({ length: cycles * pool.length }, (_, index) => pool[(index + reelIndex) % pool.length]);
    const stripSymbols = [...travelSymbols, ...target];
    const targetOffset = -((stripSymbols.length - VISIBLE_ROWS) * ROW_HEIGHT);

    this.renderStrip(reel, stripSymbols, 0);
    reel.strip.y = reel.y + STRIP_PADDING_TOP;

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: reel.strip,
        y: reel.y + STRIP_PADDING_TOP + targetOffset,
        duration: 1050 + reelIndex * 180,
        ease: 'Cubic.out',
        onComplete: () => {
          this.renderStrip(reel, target, 0);
          reel.strip.y = reel.y + STRIP_PADDING_TOP;
          resolve();
        },
      });
    });
  }

  private renderStrip(reel: ReelView, symbols: string[], offsetY: number) {
    reel.strip.removeAll(true);
    symbols.forEach((symbol, index) => {
      const tile = this.createSymbolTile(symbol);
      tile.x = 0;
      tile.y = index * ROW_HEIGHT + offsetY;
      reel.strip.add(tile);
    });
  }

  private createSymbolTile(symbol: string) {
    const meta = symbolMeta(symbol);
    const tile = this.add.container(0, 0);

    const shadow = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5 + 3, TILE_WIDTH, TILE_HEIGHT, 0x000000, 0.22);
    const body = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5, TILE_WIDTH, TILE_HEIGHT, 0x1a1028, 1);
    body.setStrokeStyle(1, 0xffffff, 0.08);
    const badge = this.add.circle(TILE_WIDTH * 0.5, 33, 18, meta.tint, 0.18);
    badge.setStrokeStyle(2, meta.tint, 0.45);
    const icon = this.add.text(TILE_WIDTH * 0.5, 32, meta.emoji, {
      color: Phaser.Display.Color.IntegerToColor(meta.tint).rgba,
      fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif',
      fontSize: '28px',
      fontStyle: '700',
    });
    icon.setOrigin(0.5);
    const label = this.add.text(TILE_WIDTH * 0.5, 68, meta.label.toUpperCase(), {
      color: '#f2e9ff',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      letterSpacing: 1.1,
    });
    label.setOrigin(0.5);

    tile.add([shadow, body, badge, icon, label]);
    return tile;
  }
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

function parseColor(color: string, fallback: number) {
  try {
    return Phaser.Display.Color.HexStringToColor(color).color;
  } catch {
    return fallback;
  }
}
