import Phaser from 'phaser';
import { SlotAudio } from '../audio';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type ReelView = {
  frame: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  homeY: number;
  maskShape: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
  strip: Phaser.GameObjects.Container;
  symbolBack: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
};

type SymbolTile = Phaser.GameObjects.Container & {
  badge?: Phaser.GameObjects.Arc;
  bodyRect?: Phaser.GameObjects.Rectangle;
  glyphText?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.GameObject;
  labelText?: Phaser.GameObjects.Text;
};

const STAGE_WIDTH = 860;
const STAGE_HEIGHT = 560;
const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;
const REEL_WIDTH = 128;
const REEL_HEIGHT = 336;
const REEL_GAP = 14;
const ROW_HEIGHT = 108;
const TILE_WIDTH = 112;
const TILE_HEIGHT = 100;
const STRIP_PADDING_TOP = 8;
const STRIP_PADDING_LEFT = 8;

export class SlotScene extends Phaser.Scene {
  private readyResolve!: () => void;
  readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private readonly audio?: SlotAudio;
  private fxLayer?: Phaser.GameObjects.Container;
  private root?: Phaser.GameObjects.Container;
  private reels: ReelView[] = [];
  private activeGame: SlotGame | null = null;
  private fxObjects: Phaser.GameObjects.GameObject[] = [];
  private anticipationTweens: Phaser.Tweens.Tween[] = [];

  constructor(audio?: SlotAudio) {
    super('slot-scene');
    this.audio = audio;
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

    this.audio?.playSpinStart();
    this.clearEffects();
    this.applyHighlights(null);
    await Promise.all(
      this.reels.map((reel, reelIndex) =>
        this.spinReel(reel, reelIndex, game.reelSymbols, result.grid[reelIndex] || [], result)
      )
    );
    if (result.freeSpinsAwarded) {
      this.playFeatureTransition();
      this.audio?.playFeatureTrigger();
      await wait(this, 420);
    } else if (result.payout > 0) {
      this.audio?.playWin(result.payout);
    } else {
      this.audio?.playMiss();
    }
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
    this.clearEffects();
    this.anticipationTweens.forEach((tween) => tween.stop());
    this.anticipationTweens = [];
    this.reels.forEach((reel) => {
      reel.strip.clearMask(true);
      reel.maskShape.destroy();
    });
    this.root?.destroy(true);
    this.root = this.add.container(0, 0);
    this.resize(this.scale.width, this.scale.height);

    const accent = parseColor(game.accent, 0xb989ff);
    const cabinetGlow = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 782, 484, accent, 0.06);
    const cabinet = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 768, 470, 0x150d21, 0.98);
    cabinet.setStrokeStyle(3, accent, 0.56);
    const window = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 10, 720, 400, 0x0a0711, 0.96);
    window.setStrokeStyle(1, 0xffffff, 0.08);
    const payline = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 10, 662, 4, 0xff5d8f, 0.92);
    const reelShelf = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 10, 690, 356, 0x120a1e, 0.72);
    reelShelf.setStrokeStyle(1, 0xffffff, 0.04);
    const topBar = this.add.rectangle(STAGE_WIDTH * 0.5, 86, 720, 50, 0x201132, 0.92);
    topBar.setStrokeStyle(1, accent, 0.3);
    const topLabel = this.add.text(78, 68, game.name.toUpperCase(), {
      color: '#fff4dc',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '24px',
      fontStyle: '700',
      letterSpacing: 1.4,
    });
    const topMeta = this.add.text(782, 72, `${game.paylinesCount} LINES`, {
      align: 'right',
      color: '#ffd68a',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '16px',
      fontStyle: '700',
    });
    topMeta.setOrigin(1, 0);
    this.fxLayer = this.add.container(0, 0);

    this.root.add([cabinetGlow, cabinet, window, reelShelf, topBar, payline, topLabel, topMeta, this.fxLayer]);

    this.reels = [];
    const reelsStartX = (STAGE_WIDTH - (REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP)) * 0.5;
    const reelsStartY = 140;

    for (let reelIndex = 0; reelIndex < REEL_COUNT; reelIndex += 1) {
      const x = reelsStartX + reelIndex * (REEL_WIDTH + REEL_GAP);
      const y = reelsStartY;
      const glow = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH + 12, REEL_HEIGHT + 12, accent, 0);
      const symbolBack = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH, REEL_HEIGHT, 0x0c0814, 0.95);
      symbolBack.setStrokeStyle(1, accent, 0.16);
      const frame = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH, REEL_HEIGHT, 0x09070f, 0.98);
      frame.setStrokeStyle(2, 0xffffff, 0.08);
      const strip = this.add.container(x + STRIP_PADDING_LEFT, y + STRIP_PADDING_TOP);
      const maskShape = this.add.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(x, y, REEL_WIDTH, REEL_HEIGHT);
      maskShape.setVisible(false);
      const mask = maskShape.createGeometryMask();
      strip.setMask(mask);
      this.root.add([glow, symbolBack, frame, strip]);
      this.reels.push({ frame, glow, homeY: y + STRIP_PADDING_TOP, maskShape, mask, strip, symbolBack, x, y });
    }

    this.root.bringToTop(this.fxLayer);
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
    this.clearEffects();
    this.reels.forEach((reel) => {
      reel.glow.setAlpha(0);
      reel.frame.setStrokeStyle(2, 0xffffff, 0.08);
      reel.symbolBack.setFillStyle(0x0c0814, 0.95);
      reel.strip.iterate((child: Phaser.GameObjects.GameObject) => {
        const tile = child as SymbolTile;
        this.tweens.killTweensOf(tile);
        if (tile.glyphText) {
          this.tweens.killTweensOf(tile.glyphText);
        }
        if (tile.glyphText) {
          tile.glyphText.setScale(1);
        }
        tile.setScale(1);
      });
    });

    if (!result) return;

    this.renderPaylines(result);
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
    reel.symbolBack.setFillStyle(0x161020, 1);

    const tile = reel.strip.list[rowIndex] as SymbolTile | undefined;
    if (!tile) return;
    tile.bodyRect?.setStrokeStyle(2, color, 0.92);
    tile.badge?.setStrokeStyle(2, color, 0.92);
    this.tweens.add({
      targets: tile,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 180,
      repeat: 3,
      yoyo: true,
    });
    this.tweens.add({
      targets: [tile.glyphText].filter(Boolean),
      scale: 1.12,
      duration: 160,
      repeat: 3,
      yoyo: true,
    });
  }

  private spinReel(reel: ReelView, reelIndex: number, poolSource: string[], finalReel: string[], result: SpinResult) {
    const pool = poolSource.length ? poolSource : ['coin', 'moon', 'ghost'];
    const target = normalizeReel(finalReel, pool);
    const cycles = 6 + reelIndex;
    const travelSymbols = Array.from({ length: cycles * pool.length }, (_, index) => pool[(index + reelIndex) % pool.length]);
    const stripSymbols = [...travelSymbols, ...target];
    const targetY = reel.homeY - ((stripSymbols.length - VISIBLE_ROWS) * ROW_HEIGHT);
    const anticipation = this.shouldAnticipate(result, reelIndex);
    const spinTween = this.tweens.add({
      targets: reel.glow,
      alpha: anticipation ? { from: 0.12, to: 0.52 } : { from: 0.08, to: 0.22 },
      duration: anticipation ? 220 : 180,
      repeat: -1,
      yoyo: true,
    });
    this.anticipationTweens.push(spinTween);

    this.renderStrip(reel, stripSymbols, 0);
    reel.strip.y = reel.homeY;

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: reel.strip,
        y: targetY - 18,
        duration: 980 + reelIndex * 210 + (anticipation ? 240 : 0),
        ease: anticipation ? 'Cubic.inOut' : 'Cubic.out',
        onComplete: () => {
          this.tweens.add({
            targets: reel.strip,
            y: targetY,
            duration: 120,
            ease: 'Back.out',
            onComplete: () => {
              spinTween.stop();
              reel.glow.setAlpha(0.16);
              this.flashReelStop(reelIndex, anticipation);
              this.audio?.playReelStop(reelIndex);
              this.renderStrip(reel, target, 0);
              reel.strip.y = reel.homeY;
              resolve();
            },
          });
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
    const tile = this.add.container(0, 0) as SymbolTile;

    const shadow = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5 + 3, TILE_WIDTH, TILE_HEIGHT, 0x000000, 0.22);
    const body = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5, TILE_WIDTH, TILE_HEIGHT, 0x1a1028, 1);
    body.setStrokeStyle(1, 0xffffff, 0.08);
    const badge = this.add.circle(TILE_WIDTH * 0.5, 34, 20, meta.tint, 0.18);
    badge.setStrokeStyle(2, meta.tint, 0.45);
    const icon = drawIcon(this, meta.icon, TILE_WIDTH * 0.5, 34, meta.tint);
    const glyph = this.add.text(TILE_WIDTH * 0.5, 34, meta.glyph, {
      color: Phaser.Display.Color.IntegerToColor(meta.tint).rgba,
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '14px',
      fontStyle: '700',
      letterSpacing: 1.2,
    });
    glyph.setOrigin(0.5);
    const label = this.add.text(TILE_WIDTH * 0.5, 74, meta.label.toUpperCase(), {
      color: '#f2e9ff',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '12px',
      fontStyle: '700',
      letterSpacing: 1.1,
    });
    label.setOrigin(0.5);

    tile.badge = badge;
    tile.bodyRect = body;
    tile.glyphText = glyph;
    tile.icon = icon;
    tile.labelText = label;
    tile.add([shadow, body, badge, icon, glyph, label]);
    return tile;
  }

  private shouldAnticipate(result: SpinResult, reelIndex: number) {
    if (result.freeSpinsAwarded && reelIndex >= 3) return true;
    if (result.scatter?.count >= 2 && reelIndex >= 3) return true;
    return result.lineWins.some((line) => line.count >= 4 && reelIndex === 4);
  }

  private flashReelStop(reelIndex: number, anticipation: boolean) {
    if (!this.fxLayer) return;
    const reel = this.reels[reelIndex];
    const flash = this.add.rectangle(
      reel.x + REEL_WIDTH * 0.5,
      reel.y + REEL_HEIGHT * 0.5,
      REEL_WIDTH + 12,
      REEL_HEIGHT + 12,
      anticipation ? 0xffd166 : 0xffffff,
      anticipation ? 0.2 : 0.12
    );
    this.fxLayer.add(flash);
    this.fxObjects.push(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: anticipation ? 260 : 180,
      onComplete: () => {
        Phaser.Utils.Array.Remove(this.fxObjects, flash);
        flash.destroy();
      },
    });
  }

  private playFeatureTransition() {
    if (!this.fxLayer) return;
    const flash = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 740, 430, 0x8cffc1, 0);
    this.fxLayer.add(flash);
    this.fxObjects.push(flash);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.22 },
      duration: 180,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        Phaser.Utils.Array.Remove(this.fxObjects, flash);
        flash.destroy();
      },
    });
  }

  private renderPaylines(result: SpinResult) {
    if (!this.fxLayer) return;
    const fxLayer = this.fxLayer;

    const colors = [0xffd166, 0x7bdff6, 0xff5d8f, 0x8cffc1, 0xd6b8ff];
    result.lineWins.forEach((win, index) => {
      const points = win.positions
        .slice()
        .sort((left, right) => left[0] - right[0])
        .map(([reelIndex, rowIndex]) => this.tileCenter(reelIndex, rowIndex));
      if (points.length < 2) return;

      const color = colors[index % colors.length];
      const firstPoint = points[0];
      if (!firstPoint) return;
      const path = this.add.graphics();
      path.lineStyle(5, color, 0.95);
      path.beginPath();
      path.moveTo(firstPoint.x, firstPoint.y);
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        path.lineTo(points[pointIndex].x, points[pointIndex].y);
      }
      path.strokePath();
      fxLayer.add(path);
      this.fxObjects.push(path);

      const markers = points.map((point) => {
        const marker = this.add.circle(point.x, point.y, 8, color, 0.85);
        marker.setStrokeStyle(3, 0xffffff, 0.72);
        fxLayer.add(marker);
        this.fxObjects.push(marker);
        this.tweens.add({
          targets: marker,
          scale: 1.18,
          alpha: 0.5,
          duration: 240,
          yoyo: true,
          repeat: 2,
        });
        return marker;
      });

      this.tweens.add({
        targets: [path, ...markers],
        alpha: { from: 0.2, to: 1 },
        duration: 170,
        yoyo: true,
        repeat: 2,
      });
    });
  }

  private tileCenter(reelIndex: number, rowIndex: number) {
    const reel = this.reels[reelIndex];
    return new Phaser.Math.Vector2(
      reel.x + STRIP_PADDING_LEFT + TILE_WIDTH * 0.5,
      reel.y + STRIP_PADDING_TOP + rowIndex * ROW_HEIGHT + TILE_HEIGHT * 0.5
    );
  }

  private clearEffects() {
    this.fxObjects.forEach((item) => item.destroy());
    this.fxObjects = [];
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

function drawIcon(scene: Phaser.Scene, kind: string, x: number, y: number, tint: number) {
  const icon = scene.add.graphics();
  icon.x = x;
  icon.y = y;
  icon.lineStyle(2, tint, 0.9);
  icon.fillStyle(tint, 0.22);

  switch (kind) {
    case 'coin':
      icon.fillCircle(0, 0, 12);
      icon.strokeCircle(0, 0, 12);
      icon.strokeCircle(0, 0, 7);
      break;
    case 'crown':
      icon.beginPath();
      icon.moveTo(-12, 8);
      icon.lineTo(-8, -6);
      icon.lineTo(0, 2);
      icon.lineTo(8, -6);
      icon.lineTo(12, 8);
      icon.closePath();
      icon.fillPath();
      icon.strokePath();
      break;
    case 'gem':
      icon.beginPath();
      icon.moveTo(0, -12);
      icon.lineTo(12, 0);
      icon.lineTo(0, 12);
      icon.lineTo(-12, 0);
      icon.closePath();
      icon.fillPath();
      icon.strokePath();
      break;
    case 'ghost':
      icon.fillRoundedRect(-10, -10, 20, 24, 8);
      icon.strokeRoundedRect(-10, -10, 20, 24, 8);
      icon.fillCircle(-4, -2, 1.5);
      icon.fillCircle(4, -2, 1.5);
      break;
    case 'lantern':
      icon.fillRoundedRect(-8, -8, 16, 20, 4);
      icon.strokeRoundedRect(-8, -8, 16, 20, 4);
      icon.lineBetween(-4, -8, 4, -8);
      icon.lineBetween(-2, -11, 2, -11);
      break;
    case 'mask':
      icon.beginPath();
      icon.moveTo(-12, -4);
      icon.lineTo(-8, 8);
      icon.lineTo(0, 12);
      icon.lineTo(8, 8);
      icon.lineTo(12, -4);
      icon.lineTo(0, -12);
      icon.closePath();
      icon.fillPath();
      icon.strokePath();
      break;
    case 'moon':
      icon.fillCircle(-2, 0, 12);
      icon.fillStyle(0x1a1028, 1);
      icon.fillCircle(4, -2, 11);
      icon.lineStyle(2, tint, 0.9);
      icon.strokeCircle(-2, 0, 12);
      break;
    case 'rune':
      icon.beginPath();
      icon.moveTo(0, -12);
      icon.lineTo(4, -3);
      icon.lineTo(12, 0);
      icon.lineTo(4, 3);
      icon.lineTo(0, 12);
      icon.lineTo(-4, 3);
      icon.lineTo(-12, 0);
      icon.lineTo(-4, -3);
      icon.closePath();
      icon.fillPath();
      icon.strokePath();
      break;
    case 'scatter':
      icon.strokeCircle(0, 0, 12);
      icon.strokeCircle(0, 0, 5);
      icon.lineBetween(-12, 0, 12, 0);
      icon.lineBetween(0, -12, 0, 12);
      break;
    case 'wild':
      icon.beginPath();
      icon.moveTo(0, -12);
      icon.lineTo(3, -3);
      icon.lineTo(12, 0);
      icon.lineTo(3, 3);
      icon.lineTo(0, 12);
      icon.lineTo(-3, 3);
      icon.lineTo(-12, 0);
      icon.lineTo(-3, -3);
      icon.closePath();
      icon.fillPath();
      icon.strokePath();
      break;
    default:
      icon.fillCircle(0, 0, 10);
      icon.strokeCircle(0, 0, 10);
      break;
  }

  return icon;
}

function wait(scene: Phaser.Scene, duration: number) {
  return new Promise<void>((resolve) => {
    scene.time.delayedCall(duration, () => resolve());
  });
}
