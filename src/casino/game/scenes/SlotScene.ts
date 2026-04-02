import Phaser from 'phaser';
import { armSceneAudio, playSceneSound, preloadSlotAudio } from '../audio';
import { SYMBOL_TEXTURES } from '../assets';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type ReelView = {
  frame: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  homeY: number;
  maskShape: Phaser.GameObjects.Graphics;
  strip: Phaser.GameObjects.Container;
  symbolBack: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
};

type SymbolTile = Phaser.GameObjects.Container & {
  badge?: Phaser.GameObjects.Arc;
  bodyRect?: Phaser.GameObjects.Rectangle;
  glyphText?: Phaser.GameObjects.Text;
  sprite?: Phaser.GameObjects.Image;
  symbolKey: string;
};

type MotionProfile = {
  anticipationBonus: number;
  baseDuration: number;
  cycles: number;
  settleEase: string;
  settleOvershoot: number;
  spinEase: string;
  stagger: number;
};

const STAGE_WIDTH = 920;
const STAGE_HEIGHT = 640;
const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;
const REEL_WIDTH = 142;
const REEL_HEIGHT = 402;
const REEL_GAP = 16;
const ROW_HEIGHT = 130;
const TILE_WIDTH = 124;
const TILE_HEIGHT = 120;
const STRIP_PADDING_TOP = 6;
const STRIP_PADDING_LEFT = 9;

const MOTION_BY_GAME: Record<string, MotionProfile> = {
  'ghost-lanterns': {
    anticipationBonus: 260,
    baseDuration: 1030,
    cycles: 8,
    settleEase: 'Back.out',
    settleOvershoot: 26,
    spinEase: 'Sine.inOut',
    stagger: 220,
  },
  'jigsaw-jackpot': {
    anticipationBonus: 220,
    baseDuration: 940,
    cycles: 7,
    settleEase: 'Cubic.out',
    settleOvershoot: 18,
    spinEase: 'Cubic.out',
    stagger: 190,
  },
  'royal-heist': {
    anticipationBonus: 300,
    baseDuration: 1090,
    cycles: 9,
    settleEase: 'Quart.out',
    settleOvershoot: 24,
    spinEase: 'Quart.inOut',
    stagger: 230,
  },
};

export class SlotScene extends Phaser.Scene {
  private readyResolve!: () => void;
  readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private fxLayer?: Phaser.GameObjects.Container;
  private root?: Phaser.GameObjects.Container;
  private reels: ReelView[] = [];
  private activeGame: SlotGame | null = null;
  private fxObjects: Phaser.GameObjects.GameObject[] = [];
  private anticipationTweens: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('slot-scene');
  }

  preload() {
    Object.values(SYMBOL_TEXTURES).forEach((asset) => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });
    preloadSlotAudio(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#120b1d');
    this.createBackdrop();
    this.readyResolve();
  }

  armAudio() {
    armSceneAudio(this);
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

    this.armAudio();
    this.clearEffects();
    this.applyHighlights(null);
    playSceneSound(this, 'spinStart', { volume: 0.55 });
    await Promise.all(
      this.reels.map((reel, reelIndex) =>
        this.spinReel(reel, reelIndex, game.reelSymbols, result.grid[reelIndex] || [], result)
      )
    );

    if (result.freeSpinsAwarded) {
      playSceneSound(this, 'feature', { volume: 0.68 });
      this.playFeatureTransition(`${result.freeSpinsAwarded} FREE SPINS`);
      await wait(this, 520);
    } else if (result.payout > 0) {
      playSceneSound(this, 'win', { volume: Math.min(1, 0.45 + result.payout / 1200) });
      this.cameras.main.shake(140, 0.0022);
    } else {
      playSceneSound(this, 'miss', { volume: 0.38 });
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

    for (let index = 0; index < 12; index += 1) {
      const orb = this.add.circle(
        Phaser.Math.Between(30, STAGE_WIDTH - 30),
        Phaser.Math.Between(24, STAGE_HEIGHT - 24),
        Phaser.Math.Between(3, 8),
        Phaser.Math.RND.pick([0xffd166, 0xff5d8f, 0x7bdff6, 0x8cffc1]),
        Phaser.Math.FloatBetween(0.08, 0.18)
      );
      this.tweens.add({
        targets: orb,
        alpha: { from: orb.alpha, to: Math.min(0.32, orb.alpha + 0.1) },
        duration: Phaser.Math.Between(1400, 2800),
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
    const cabinetGlow = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 860, 560, accent, 0.06);
    const cabinet = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 844, 542, 0x150d21, 0.98);
    cabinet.setStrokeStyle(3, accent, 0.56);
    const window = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 16, 792, 470, 0x0a0711, 0.96);
    window.setStrokeStyle(1, 0xffffff, 0.08);
    const payline = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 16, 720, 4, 0xff5d8f, 0.92);
    const reelShelf = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 16, 748, 422, 0x120a1e, 0.72);
    reelShelf.setStrokeStyle(1, 0xffffff, 0.04);
    const topBar = this.add.rectangle(STAGE_WIDTH * 0.5, 102, 792, 54, 0x201132, 0.92);
    topBar.setStrokeStyle(1, accent, 0.3);
    const topLabel = this.add.text(86, 82, game.name.toUpperCase(), {
      color: '#fff4dc',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '26px',
      fontStyle: '700',
      letterSpacing: 1.4,
    });
    const topMeta = this.add.text(834, 86, `${game.paylinesCount} LINES`, {
      align: 'right',
      color: '#ffd68a',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '17px',
      fontStyle: '700',
    });
    topMeta.setOrigin(1, 0);
    this.fxLayer = this.add.container(0, 0);

    this.root.add([cabinetGlow, cabinet, window, reelShelf, topBar, payline, topLabel, topMeta, this.fxLayer]);

    this.reels = [];
    const reelsStartX = (STAGE_WIDTH - (REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_GAP)) * 0.5;
    const reelsStartY = 156;

    for (let reelIndex = 0; reelIndex < REEL_COUNT; reelIndex += 1) {
      const x = reelsStartX + reelIndex * (REEL_WIDTH + REEL_GAP);
      const y = reelsStartY;
      const glow = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH + 14, REEL_HEIGHT + 14, accent, 0);
      const symbolBack = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH, REEL_HEIGHT, 0x0c0814, 0.95);
      symbolBack.setStrokeStyle(1, accent, 0.16);
      const frame = this.add.rectangle(x + REEL_WIDTH * 0.5, y + REEL_HEIGHT * 0.5, REEL_WIDTH, REEL_HEIGHT, 0x09070f, 0.98);
      frame.setStrokeStyle(2, 0xffffff, 0.08);
      const strip = this.add.container(x + STRIP_PADDING_LEFT, y + STRIP_PADDING_TOP);
      const maskShape = this.add.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(x, y, REEL_WIDTH, REEL_HEIGHT);
      maskShape.setVisible(false);
      strip.setMask(maskShape.createGeometryMask());
      this.root.add([glow, symbolBack, frame, strip]);
      this.reels.push({ frame, glow, homeY: y + STRIP_PADDING_TOP, maskShape, strip, symbolBack, x, y });
    }

    this.root.bringToTop(this.fxLayer);
  }

  private setIdleState(grid: string[][]) {
    const game = this.activeGame;
    if (!game) return;

    this.reels.forEach((reel, reelIndex) => {
      const symbols = normalizeReel(grid[reelIndex] || [], game.reelSymbols);
      this.renderStrip(reel, [...symbols]);
      reel.strip.y = reel.homeY;
    });
  }

  private applyHighlights(result: SpinResult | null) {
    this.clearEffects();
    this.reels.forEach((reel) => {
      reel.glow.setAlpha(0);
      reel.frame.setStrokeStyle(2, 0xffffff, 0.08);
      reel.symbolBack.setFillStyle(0x0c0814, 0.95);
      reel.strip.iterate((child: Phaser.GameObjects.GameObject) => this.resetTile(child as SymbolTile));
    });

    if (!result) return;

    this.renderPaylines(result);

    for (const win of result.lineWins) {
      for (const [reelIndex, rowIndex] of win.positions) {
        this.highlightTile(reelIndex, rowIndex, 0xffd166);
      }
    }
    for (const [reelIndex, rowIndex] of result.scatter?.positions || []) {
      this.highlightTile(reelIndex, rowIndex, 0x8cffc1);
    }
  }

  private resetTile(tile: SymbolTile) {
    this.tweens.killTweensOf(tile);
    if (tile.sprite) {
      this.tweens.killTweensOf(tile.sprite);
      tile.sprite.setScale(1);
      tile.sprite.setAngle(0);
      tile.sprite.setAlpha(1);
      tile.sprite.clearTint();
    }
    if (tile.glyphText) {
      this.tweens.killTweensOf(tile.glyphText);
      tile.glyphText.setScale(1);
      tile.glyphText.setAlpha(1);
    }
    tile.bodyRect?.setFillStyle(0x1a1028, 1);
    tile.bodyRect?.setStrokeStyle(1, 0xffffff, 0.08);
    tile.badge?.setStrokeStyle(2, symbolMeta(tile.symbolKey).tint, 0.45);
    tile.setScale(1);
    tile.y = Math.round(tile.y);
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
    tile.bodyRect?.setFillStyle(0x241832, 1);
    tile.bodyRect?.setStrokeStyle(2, color, 0.9);
    tile.badge?.setStrokeStyle(2, color, 0.9);

    this.tweens.add({
      targets: tile,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 160,
      repeat: 3,
      yoyo: true,
    });

    this.animateSymbolWin(tile, symbolMeta(tile.symbolKey).winEffect, color);
  }

  private animateSymbolWin(tile: SymbolTile, effect: ReturnType<typeof symbolMeta>['winEffect'], color: number) {
    const sprite = tile.sprite;
    if (!sprite) return;

    switch (effect) {
      case 'coin':
        this.tweens.add({ targets: sprite, angle: 360, duration: 520, repeat: 0 });
        break;
      case 'crown':
        this.tweens.add({ targets: sprite, y: sprite.y - 6, duration: 180, yoyo: true, repeat: 3 });
        break;
      case 'gem':
        sprite.setTint(color);
        this.tweens.add({ targets: sprite, alpha: 0.5, duration: 140, yoyo: true, repeat: 5 });
        break;
      case 'ghost':
        this.tweens.add({ targets: sprite, x: sprite.x + 4, duration: 180, yoyo: true, repeat: 3 });
        break;
      case 'lantern':
        this.tweens.add({ targets: sprite, angle: 12, duration: 170, yoyo: true, repeat: 3 });
        break;
      case 'mask':
        this.tweens.add({ targets: sprite, scaleX: 1.16, scaleY: 1.06, duration: 150, yoyo: true, repeat: 3 });
        break;
      case 'moon':
        this.tweens.add({ targets: sprite, alpha: 0.45, duration: 160, yoyo: true, repeat: 4 });
        break;
      case 'rune':
        sprite.setTint(color);
        this.tweens.add({ targets: sprite, scaleX: 1.22, scaleY: 1.22, duration: 160, yoyo: true, repeat: 3 });
        break;
      case 'scatter':
        this.tweens.add({ targets: sprite, angle: 180, duration: 460, repeat: 0 });
        break;
      case 'wild':
        sprite.setTint(color);
        this.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 120, yoyo: true, repeat: 5 });
        break;
      default:
        this.tweens.add({ targets: sprite, scaleX: 1.12, scaleY: 1.12, duration: 160, yoyo: true, repeat: 3 });
        break;
    }
  }

  private spinReel(reel: ReelView, reelIndex: number, poolSource: string[], finalReel: string[], result: SpinResult) {
    const game = this.activeGame;
    const profile = motionProfile(game);
    const pool = poolSource.length ? poolSource : ['coin', 'moon', 'ghost'];
    const target = normalizeReel(finalReel, pool);
    const cycles = profile.cycles + reelIndex;
    const travelSymbols = Array.from({ length: cycles * pool.length }, (_, index) => pool[(index + reelIndex) % pool.length]);
    const stripSymbols = [...travelSymbols, ...target];
    const targetY = reel.homeY - ((stripSymbols.length - VISIBLE_ROWS) * ROW_HEIGHT);
    const anticipation = this.shouldAnticipate(result, reelIndex);
    const glowTween = this.tweens.add({
      targets: reel.glow,
      alpha: anticipation ? { from: 0.12, to: 0.56 } : { from: 0.08, to: 0.22 },
      duration: anticipation ? 210 : 170,
      repeat: -1,
      yoyo: true,
    });
    this.anticipationTweens.push(glowTween);

    this.renderStrip(reel, stripSymbols);
    reel.strip.y = reel.homeY;

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: reel.strip,
        y: targetY - profile.settleOvershoot,
        duration: profile.baseDuration + reelIndex * profile.stagger + (anticipation ? profile.anticipationBonus : 0),
        ease: profile.spinEase,
        onComplete: () => {
          this.tweens.add({
            targets: reel.strip,
            y: targetY,
            duration: 120,
            ease: profile.settleEase,
            onComplete: () => {
              glowTween.stop();
              reel.glow.setAlpha(0.12);
              this.flashReelStop(reelIndex, anticipation);
              playSceneSound(this, 'reelStop', { detune: reelIndex * 90, volume: anticipation ? 0.54 : 0.4 });
              this.renderStrip(reel, target);
              reel.strip.y = reel.homeY;
              resolve();
            },
          });
        },
      });
    });
  }

  private renderStrip(reel: ReelView, symbols: string[]) {
    reel.strip.removeAll(true);
    symbols.forEach((symbol, index) => {
      const tile = this.createSymbolTile(symbol);
      tile.x = 0;
      tile.y = index * ROW_HEIGHT;
      reel.strip.add(tile);
    });
  }

  private createSymbolTile(symbol: string) {
    const meta = symbolMeta(symbol);
    const tile = this.add.container(0, 0) as SymbolTile;
    tile.symbolKey = symbol;

    const shadow = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5 + 3, TILE_WIDTH, TILE_HEIGHT, 0x000000, 0.22);
    const body = this.add.rectangle(TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5, TILE_WIDTH, TILE_HEIGHT, 0x1a1028, 1);
    body.setStrokeStyle(1, 0xffffff, 0.08);
    const badge = this.add.circle(TILE_WIDTH * 0.5, 40, 22, meta.tint, 0.18);
    badge.setStrokeStyle(2, meta.tint, 0.45);

    const sprite = this.add.image(TILE_WIDTH * 0.5, 48, meta.textureKey);
    sprite.setDisplaySize(62, 62);
    sprite.setOrigin(0.5);

    const glyph = this.add.text(TILE_WIDTH * 0.5, 48, meta.glyph, {
      color: '#ffffff',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      letterSpacing: 0.8,
    });
    glyph.setOrigin(0.5);

    const label = this.add.text(TILE_WIDTH * 0.5, 92, meta.label.toUpperCase(), {
      color: '#f2e9ff',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '13px',
      fontStyle: '700',
      letterSpacing: 1.1,
    });
    label.setOrigin(0.5);

    tile.badge = badge;
    tile.bodyRect = body;
    tile.glyphText = glyph;
    tile.sprite = sprite;
    tile.add([shadow, body, badge, sprite, glyph, label]);
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
      anticipation ? 0.24 : 0.12
    );
    this.fxLayer.add(flash);
    this.fxObjects.push(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: anticipation ? 260 : 180,
      onComplete: () => this.destroyFxObject(flash),
    });
  }

  private playFeatureTransition(label: string) {
    if (!this.fxLayer) return;
    const fxLayer = this.fxLayer;
    const overlay = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, STAGE_WIDTH, STAGE_HEIGHT, 0x8cffc1, 0);
    const banner = this.add.text(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 - 12, label, {
      color: '#f5fff9',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '40px',
      fontStyle: '700',
      letterSpacing: 2.4,
      stroke: '#113027',
      strokeThickness: 8,
    });
    banner.setOrigin(0.5);
    banner.setScale(0.82);
    fxLayer.add([overlay, banner]);
    this.fxObjects.push(overlay, banner);

    for (let index = 0; index < 14; index += 1) {
      const spark = this.add.circle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5 + 16, Phaser.Math.Between(4, 8), Phaser.Math.RND.pick([0xffd166, 0x8cffc1, 0xffffff]), 0.94);
      fxLayer.add(spark);
      this.fxObjects.push(spark);
      this.tweens.add({
        targets: spark,
        x: STAGE_WIDTH * 0.5 + Phaser.Math.Between(-250, 250),
        y: STAGE_HEIGHT * 0.5 + Phaser.Math.Between(-120, 120),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(1.8, 3.4),
        duration: Phaser.Math.Between(320, 520),
        ease: 'Cubic.out',
        onComplete: () => this.destroyFxObject(spark),
      });
    }

    this.cameras.main.flash(220, 200, 255, 228, false);
    this.cameras.main.shake(180, 0.0038);
    this.tweens.add({
      targets: overlay,
      alpha: { from: 0, to: 0.18 },
      duration: 180,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.destroyFxObject(overlay),
    });
    this.tweens.add({
      targets: banner,
      scale: 1.02,
      alpha: { from: 0.5, to: 1 },
      duration: 210,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.destroyFxObject(banner),
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
      const line = this.add.graphics();
      fxLayer.add(line);
      this.fxObjects.push(line);

      const markers = points.map((point) => {
        const marker = this.add.circle(point.x, point.y, 7, color, 0.9);
        marker.setStrokeStyle(2, 0xffffff, 0.72);
        fxLayer.add(marker);
        this.fxObjects.push(marker);
        this.tweens.add({
          targets: marker,
          scale: 1.18,
          alpha: 0.55,
          duration: 210,
          yoyo: true,
          repeat: 3,
        });
        return marker;
      });

      const tracer = this.add.circle(points[0]!.x, points[0]!.y, 9, 0xffffff, 0.96);
      tracer.setStrokeStyle(3, color, 0.92);
      fxLayer.add(tracer);
      this.fxObjects.push(tracer);

      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 560,
        repeat: 1,
        onUpdate: (tween) => {
          const progress = Number(tween.getValue() ?? 0);
          const point = pointAlongPolyline(points, progress);
          tracer.setPosition(point.x, point.y);
          line.clear();
          line.lineStyle(5, color, 0.96);
          line.beginPath();
          line.moveTo(points[0]!.x, points[0]!.y);
          for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
            const current = points[pointIndex]!;
            if ((pointIndex / (points.length - 1)) <= progress) {
              line.lineTo(current.x, current.y);
            } else {
              line.lineTo(point.x, point.y);
              break;
            }
          }
          line.strokePath();
        },
      });

      this.tweens.add({
        targets: [line, tracer, ...markers],
        alpha: { from: 0.25, to: 1 },
        duration: 160,
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

  private destroyFxObject(item: Phaser.GameObjects.GameObject) {
    Phaser.Utils.Array.Remove(this.fxObjects, item);
    item.destroy();
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

function motionProfile(game: SlotGame | null): MotionProfile {
  if (!game) {
    return {
      anticipationBonus: 220,
      baseDuration: 960,
      cycles: 7,
      settleEase: 'Cubic.out',
      settleOvershoot: 18,
      spinEase: 'Cubic.out',
      stagger: 190,
    };
  }

  return MOTION_BY_GAME[game.slug] || {
    anticipationBonus: game.volatility.toLowerCase().includes('high') ? 280 : 220,
    baseDuration: game.volatility.toLowerCase().includes('high') ? 1040 : 940,
    cycles: game.volatility.toLowerCase().includes('high') ? 8 : 7,
    settleEase: game.volatility.toLowerCase().includes('high') ? 'Quart.out' : 'Cubic.out',
    settleOvershoot: game.volatility.toLowerCase().includes('high') ? 24 : 18,
    spinEase: game.volatility.toLowerCase().includes('high') ? 'Quart.inOut' : 'Cubic.out',
    stagger: game.volatility.toLowerCase().includes('high') ? 220 : 190,
  };
}

function pointAlongPolyline(points: Phaser.Math.Vector2[], progress: number) {
  const clamped = Phaser.Math.Clamp(progress, 0, 1);
  const segmentCount = Math.max(1, points.length - 1);
  const scaled = clamped * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const local = scaled - index;
  const start = points[index]!;
  const end = points[Math.min(points.length - 1, index + 1)]!;
  return new Phaser.Math.Vector2(
    Phaser.Math.Linear(start.x, end.x, local),
    Phaser.Math.Linear(start.y, end.y, local)
  );
}

function wait(scene: Phaser.Scene, duration: number) {
  return new Promise<void>((resolve) => {
    scene.time.delayedCall(duration, () => resolve());
  });
}
