import Phaser from 'phaser';
import { symbolMeta } from '../symbols';
import type { SlotGame, SpinResult } from '../types';

type CellView = {
  emoji: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  panel: Phaser.GameObjects.Rectangle;
};

const STAGE_WIDTH = 1100;
const STAGE_HEIGHT = 680;
const REEL_GAP = 16;
const ROW_GAP = 14;
const OUTER_PADDING = 54;
const HEADER_HEIGHT = 120;
const FOOTER_HEIGHT = 70;

export class SlotScene extends Phaser.Scene {
  private readyResolve!: () => void;
  readonly ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  private root?: Phaser.GameObjects.Container;
  private machineTitle?: Phaser.GameObjects.Text;
  private machineMeta?: Phaser.GameObjects.Text;
  private machineLegend?: Phaser.GameObjects.Text;
  private reelCells: CellView[][] = [];
  private activeGame: SlotGame | null = null;
  private activeResult: SpinResult | null = null;

  constructor() {
    super('slot-scene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08050f');
    this.createBackdrop();
    this.readyResolve();
  }

  async showMachine(game: SlotGame, result: SpinResult | null) {
    await this.ready;
    this.activeGame = game;
    this.activeResult = result;
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

    this.activeResult = null;
    this.applyHighlights(null);

    const pool = game.reelSymbols.length ? game.reelSymbols : ['coin', 'moon', 'ghost'];
    const reels = Array.from({ length: game.reelCount }, (_, reelIndex) =>
      this.animateReel(reelIndex, game.rows, pool, result.grid[reelIndex] || [])
    );
    await Promise.all(reels);
    this.activeResult = result;
    this.applyHighlights(result);
  }

  resize(width: number, height: number) {
    this.scale.resize(width, height);
    if (this.root) {
      const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
      this.root.setScale(scale);
      this.root.x = Math.max(0, (width - STAGE_WIDTH * scale) * 0.5);
      this.root.y = Math.max(0, (height - STAGE_HEIGHT * scale) * 0.5);
    }
  }

  private createBackdrop() {
    const background = this.add.graphics();
    background.fillGradientStyle(0x1b1030, 0x090511, 0x06040c, 0x120c20, 1);
    background.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    for (let index = 0; index < 14; index += 1) {
      const orb = this.add.circle(
        Phaser.Math.Between(40, STAGE_WIDTH - 40),
        Phaser.Math.Between(30, STAGE_HEIGHT - 30),
        Phaser.Math.Between(2, 6),
        Phaser.Math.RND.pick([0xffd166, 0xff5d8f, 0x7bdff6, 0xd0c6ff]),
        Phaser.Math.FloatBetween(0.12, 0.28)
      );
      this.tweens.add({
        targets: orb,
        alpha: { from: orb.alpha, to: Math.min(0.42, orb.alpha + 0.14) },
        duration: Phaser.Math.Between(1200, 2600),
        repeat: -1,
        yoyo: true,
      });
    }
  }

  private buildMachine(game: SlotGame) {
    this.root?.destroy(true);
    this.root = this.add.container(0, 0);
    this.resize(this.scale.width, this.scale.height);

    const accent = parseColor(game.accent, 0x9d7cf2);
    const reelCount = Math.max(1, game.reelCount);
    const rows = Math.max(1, game.rows);
    const frameWidth = STAGE_WIDTH - OUTER_PADDING * 2;
    const frameHeight = STAGE_HEIGHT - OUTER_PADDING * 2;
    const contentWidth = frameWidth - 64;
    const contentHeight = frameHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
    const cellWidth = (contentWidth - REEL_GAP * (reelCount - 1)) / reelCount;
    const cellHeight = (contentHeight - ROW_GAP * (rows - 1)) / rows;

    const shell = this.add.rectangle(
      STAGE_WIDTH * 0.5,
      STAGE_HEIGHT * 0.5,
      frameWidth,
      frameHeight,
      0x100b18,
      0.96
    );
    shell.setStrokeStyle(3, accent, 0.42);
    this.root.add(shell);

    const marquee = this.add.rectangle(STAGE_WIDTH * 0.5, OUTER_PADDING + 40, frameWidth - 40, 78, accent, 0.12);
    marquee.setStrokeStyle(1, 0xffffff, 0.12);
    this.root.add(marquee);

    this.machineTitle = this.add.text(OUTER_PADDING + 30, OUTER_PADDING + 18, game.name, {
      color: '#fff7ec',
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '34px',
      fontStyle: '700',
    });
    this.machineMeta = this.add.text(
      STAGE_WIDTH - OUTER_PADDING - 30,
      OUTER_PADDING + 24,
      `${game.paylinesCount} LINES  |  ${percent(game.returnRate)} RETURN`,
      {
        align: 'right',
        color: '#ffdca8',
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '18px',
        fontStyle: '700',
      }
    );
    this.machineMeta.setOrigin(1, 0);
    this.machineLegend = this.add.text(OUTER_PADDING + 30, OUTER_PADDING + 62, machineLegend(game), {
      color: '#d9d0ea',
      fontFamily: 'Manrope, sans-serif',
      fontSize: '15px',
      wordWrap: { width: frameWidth - 60 },
    });
    this.root.add([this.machineTitle, this.machineMeta, this.machineLegend]);

    this.reelCells = [];
    for (let reelIndex = 0; reelIndex < reelCount; reelIndex += 1) {
      const column: CellView[] = [];
      const x = OUTER_PADDING + 32 + reelIndex * (cellWidth + REEL_GAP);
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const y = OUTER_PADDING + HEADER_HEIGHT + rowIndex * (cellHeight + ROW_GAP);
        const glow = this.add.rectangle(x + cellWidth * 0.5, y + cellHeight * 0.5, cellWidth + 10, cellHeight + 10, accent, 0);
        const panel = this.add.rectangle(x + cellWidth * 0.5, y + cellHeight * 0.5, cellWidth, cellHeight, 0x09070f, 0.94);
        panel.setStrokeStyle(2, 0xffffff, 0.09);
        const emoji = this.add.text(x + cellWidth * 0.5, y + cellHeight * 0.42, '\u{1FA99}', {
          color: '#ffffff',
          fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif',
          fontSize: `${Math.max(44, Math.floor(cellHeight * 0.34))}px`,
          fontStyle: '700',
        });
        emoji.setOrigin(0.5);
        const label = this.add.text(x + cellWidth * 0.5, y + cellHeight * 0.79, 'COIN', {
          color: '#d8d0ea',
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: '15px',
          fontStyle: '700',
        });
        label.setOrigin(0.5);
        this.root.add([glow, panel, emoji, label]);
        column.push({ emoji, glow, label, panel });
      }
      this.reelCells.push(column);
    }

    const payline = this.add.rectangle(
      STAGE_WIDTH * 0.5,
      OUTER_PADDING + HEADER_HEIGHT + contentHeight * 0.5,
      frameWidth - 90,
      4,
      0xff5d8f,
      0.78
    );
    const footer = this.add.text(
      OUTER_PADDING + 30,
      STAGE_HEIGHT - OUTER_PADDING - 30,
      `${game.jackpotLabel || `${game.topPayout.toLocaleString()} pts`}  |  ${game.volatility.toUpperCase()}  |  ${game.hitRate ? percent(game.hitRate) : 'n/a'} HIT RATE`,
      {
        color: '#c9bedf',
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '18px',
        fontStyle: '700',
      }
    );
    this.root.add([payline, footer]);
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
        cell.panel.setStrokeStyle(2, 0xffffff, 0.09);
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
        cell.panel.setStrokeStyle(3, 0xffd166, 0.78);
        this.tweens.add({
          targets: cell.emoji,
          duration: 200,
          repeat: 3,
          scale: 1.08,
          yoyo: true,
        });
      }
    }

    for (const [reelIndex, rowIndex] of result.scatter?.positions || []) {
      const cell = this.reelCells[reelIndex]?.[rowIndex];
      if (!cell) continue;
      cell.glow.setFillStyle(0x8cffc1, 0.2);
      cell.glow.setAlpha(1);
      cell.panel.setStrokeStyle(3, 0x8cffc1, 0.82);
    }
  }

  private setCellSymbol(reelIndex: number, rowIndex: number, symbol: string) {
    const cell = this.reelCells[reelIndex]?.[rowIndex];
    if (!cell) return;
    const meta = symbolMeta(symbol);
    cell.emoji.setText(meta.emoji);
    cell.emoji.setColor(Phaser.Display.Color.IntegerToColor(meta.tint).rgba);
    cell.label.setText(meta.label.toUpperCase());
  }

  private animateReel(reelIndex: number, rows: number, pool: string[], finalReel: string[]) {
    return new Promise<void>((resolve) => {
      let ticks = 0;
      let leadIndex = reelIndex % pool.length;
      const totalTicks = 7 + reelIndex * 2;
      const timer = this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          ticks += 1;
          leadIndex = (leadIndex + 1) % pool.length;
          for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const symbol = pool[(leadIndex + rowIndex) % pool.length] || pool[0];
            this.setCellSymbol(reelIndex, rowIndex, symbol);
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

function machineLegend(game: SlotGame) {
  return `${game.flavor} Wilds substitute on paylines. Three scatters trigger free spins and the server resolves every outcome.`;
}

function parseColor(color: string, fallback: number) {
  try {
    return Phaser.Display.Color.HexStringToColor(color).color;
  } catch {
    return fallback;
  }
}

function percent(value: number) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return `${(number * 100).toFixed(number < 0.1 ? 1 : 0)}%`;
}
