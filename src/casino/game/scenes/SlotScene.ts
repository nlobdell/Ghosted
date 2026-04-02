import Phaser from 'phaser';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type CellView = {
  backdrop: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  emoji: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Rectangle;
};

const STAGE_WIDTH = 760;
const STAGE_HEIGHT = 500;
const CABINET_PADDING_X = 34;
const CABINET_PADDING_Y = 28;
const REEL_GAP = 14;
const ROW_GAP = 12;

export class SlotScene extends Phaser.Scene {
  private readyResolve!: () => void;
  readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private root?: Phaser.GameObjects.Container;
  private reelCells: CellView[][] = [];
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
    this.applyGrid(result?.grid?.length ? result.grid : idleGrid(game));
    this.applyHighlights(result);
  }

  async playSpin(game: SlotGame, result: SpinResult) {
    await this.ready;
    if (!this.activeGame || this.activeGame.slug !== game.slug) {
      await this.showMachine(game, result);
      return;
    }

    this.applyHighlights(null);
    const pool = game.reelSymbols.length ? game.reelSymbols : ['coin', 'moon', 'ghost'];
    await Promise.all(
      Array.from({ length: game.reelCount }, (_, reelIndex) =>
        this.animateReel(reelIndex, game.rows, pool, result.grid[reelIndex] || [])
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
    background.fillGradientStyle(0x2d153f, 0x12081d, 0x0c0714, 0x1c0e2d, 1);
    background.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    for (let index = 0; index < 8; index += 1) {
      const orb = this.add.circle(
        Phaser.Math.Between(40, STAGE_WIDTH - 40),
        Phaser.Math.Between(30, STAGE_HEIGHT - 30),
        Phaser.Math.Between(3, 7),
        Phaser.Math.RND.pick([0xffd166, 0xff5d8f, 0x7bdff6]),
        Phaser.Math.FloatBetween(0.1, 0.22)
      );
      this.tweens.add({
        targets: orb,
        alpha: { from: orb.alpha, to: Math.min(0.34, orb.alpha + 0.1) },
        duration: Phaser.Math.Between(1400, 2400),
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
    const cabinet = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 700, 430, 0x140c20, 0.98);
    cabinet.setStrokeStyle(3, accent, 0.48);
    const inset = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 672, 402, 0x0c0913, 0.94);
    inset.setStrokeStyle(1, 0xffffff, 0.08);
    const winLine = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 618, 4, 0xff5d8f, 0.9);
    const frameGlow = this.add.rectangle(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 688, 418, accent, 0.05);
    this.root.add([frameGlow, cabinet, inset, winLine]);

    const reelsAreaWidth = 620;
    const reelsAreaHeight = 320;
    const reelCount = Math.max(1, game.reelCount);
    const rows = Math.max(1, game.rows);
    const cellWidth = (reelsAreaWidth - REEL_GAP * (reelCount - 1)) / reelCount;
    const cellHeight = (reelsAreaHeight - ROW_GAP * (rows - 1)) / rows;
    const startX = (STAGE_WIDTH - reelsAreaWidth) * 0.5;
    const startY = (STAGE_HEIGHT - reelsAreaHeight) * 0.5;

    this.reelCells = [];
    for (let reelIndex = 0; reelIndex < reelCount; reelIndex += 1) {
      const column: CellView[] = [];
      const x = startX + reelIndex * (cellWidth + REEL_GAP);
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const y = startY + rowIndex * (cellHeight + ROW_GAP);
        const glow = this.add.rectangle(x + cellWidth * 0.5, y + cellHeight * 0.5, cellWidth + 10, cellHeight + 10, accent, 0);
        const backdrop = this.add.rectangle(x + cellWidth * 0.5, y + cellHeight * 0.5, cellWidth, cellHeight, 0x09070f, 0.96);
        backdrop.setStrokeStyle(0, 0, 0);
        const border = this.add.rectangle(x + cellWidth * 0.5, y + cellHeight * 0.5, cellWidth, cellHeight, 0xffffff, 0);
        border.setStrokeStyle(2, 0xffffff, 0.1);
        const emoji = this.add.text(x + cellWidth * 0.5, y + cellHeight * 0.5, '\u{1FA99}', {
          color: '#ffffff',
          fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif',
          fontSize: `${Math.max(56, Math.floor(cellHeight * 0.54))}px`,
          fontStyle: '700',
        });
        emoji.setOrigin(0.5);
        this.root.add([glow, backdrop, border, emoji]);
        column.push({ backdrop, border, emoji, glow });
      }
      this.reelCells.push(column);
    }
  }

  private applyGrid(grid: string[][]) {
    const game = this.activeGame;
    if (!game) return;
    for (let reelIndex = 0; reelIndex < game.reelCount; reelIndex += 1) {
      for (let rowIndex = 0; rowIndex < game.rows; rowIndex += 1) {
        const symbol = grid[reelIndex]?.[rowIndex] || game.reelSymbols[(reelIndex + rowIndex) % game.reelSymbols.length] || 'coin';
        this.setCellSymbol(reelIndex, rowIndex, symbol);
      }
    }
  }

  private applyHighlights(result: SpinResult | null) {
    for (const column of this.reelCells) {
      for (const cell of column) {
        cell.glow.setAlpha(0);
        cell.border.setStrokeStyle(2, 0xffffff, 0.1);
        cell.emoji.setScale(1);
      }
    }
    if (!result) return;

    for (const win of result.lineWins || []) {
      for (const [reelIndex, rowIndex] of win.positions) {
        const cell = this.reelCells[reelIndex]?.[rowIndex];
        if (!cell) continue;
        cell.glow.setFillStyle(0xffd166, 0.18);
        cell.glow.setAlpha(1);
        cell.border.setStrokeStyle(3, 0xffd166, 0.9);
        this.tweens.add({
          targets: cell.emoji,
          duration: 160,
          repeat: 3,
          scale: 1.1,
          yoyo: true,
        });
      }
    }

    for (const [reelIndex, rowIndex] of result.scatter?.positions || []) {
      const cell = this.reelCells[reelIndex]?.[rowIndex];
      if (!cell) continue;
      cell.glow.setFillStyle(0x8cffc1, 0.2);
      cell.glow.setAlpha(1);
      cell.border.setStrokeStyle(3, 0x8cffc1, 0.9);
    }
  }

  private setCellSymbol(reelIndex: number, rowIndex: number, symbol: string) {
    const cell = this.reelCells[reelIndex]?.[rowIndex];
    if (!cell) return;
    const meta = symbolMeta(symbol);
    cell.emoji.setText(meta.emoji);
    cell.emoji.setColor(Phaser.Display.Color.IntegerToColor(meta.tint).rgba);
  }

  private animateReel(reelIndex: number, rows: number, pool: string[], finalReel: string[]) {
    return new Promise<void>((resolve) => {
      let ticks = 0;
      let leadIndex = reelIndex % pool.length;
      const totalTicks = 10 + reelIndex * 3;
      const timer = this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => {
          ticks += 1;
          leadIndex = (leadIndex + 1) % pool.length;
          for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const symbol = pool[(leadIndex + rowIndex) % pool.length] || pool[0];
            const cell = this.reelCells[reelIndex]?.[rowIndex];
            if (!cell) continue;
            cell.emoji.y += 8;
            this.tweens.killTweensOf(cell.emoji);
            this.tweens.add({
              targets: cell.emoji,
              y: cell.emoji.y - 8,
              duration: 54,
              ease: 'Quad.out',
              onUpdate: () => this.setCellSymbol(reelIndex, rowIndex, symbol),
            });
          }
          if (ticks >= totalTicks) {
            timer.remove(false);
            const target = finalReel.length ? finalReel : pool.slice(0, rows);
            for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
              this.setCellSymbol(reelIndex, rowIndex, target[rowIndex] || pool[rowIndex % pool.length] || 'coin');
            }
            resolve();
          }
        },
      });
    });
  }
}

function idleGrid(game: SlotGame) {
  return Array.from({ length: game.reelCount }, (_, reelIndex) =>
    Array.from({ length: game.rows }, (_, rowIndex) => game.reelSymbols[(reelIndex + rowIndex) % game.reelSymbols.length] || 'coin')
  );
}

function parseColor(color: string, fallback: number) {
  try {
    return Phaser.Display.Color.HexStringToColor(color).color;
  } catch {
    return fallback;
  }
}
