import './style.css';
import { Application, BlurFilter, Color, Container, Graphics, Text, TextStyle } from 'pixi.js';

type ApiConfig = {
  authConfigured: boolean;
  devAuthEnabled: boolean;
};

type AuthUser = {
  displayName: string;
  balance: number;
  isAdmin: boolean;
  avatarUrl?: string | null;
  username: string;
};

type MePayload =
  | { authenticated: false }
  | { authenticated: true; user: AuthUser };

type PaytableEntry = {
  kind: 'line' | 'scatter';
  label: string;
  payout: number;
  multiplier: number;
  symbols: string[];
  freeSpins?: number;
};

type LineWin = {
  lineIndex: number;
  symbol: string;
  count: number;
  positions: Array<[number, number]>;
  payout: number;
};

type Scatter = {
  count: number;
  positions: Array<[number, number]>;
  payout: number;
  freeSpinsAwarded: number;
  symbol: string;
};

type SpinOutcome = {
  label: string;
  headline: string;
  detail: string;
};

type SpinResult = {
  game: string;
  gameSlug: string;
  symbols: string[];
  grid: string[][];
  lineWins: LineWin[];
  scatter: Scatter;
  wager: number;
  baseWager: number;
  payout: number;
  net: number;
  balance: number;
  usedFreeSpin: boolean;
  freeSpinsAwarded: number;
  freeSpinsRemaining: number;
  outcome: SpinOutcome;
};

type RewardsPayload = {
  balance: number;
  spins: SpinResult[];
  dailyWagered: number;
  dailyRemaining: number;
  dailyCap: number;
};

type SlotGame = {
  id: number;
  slug: string;
  name: string;
  cost: number;
  topPayout: number;
  flavor: string;
  volatility: string;
  mood: string;
  jackpotLabel: string;
  accent: string;
  rows: number;
  reelCount: number;
  paylinesCount: number;
  reelSymbols: string[];
  paytable: PaytableEntry[];
  freeSpinsRemaining: number;
};

type GamesPayload = {
  games: SlotGame[];
  dailyWagerCap: number;
};

const state: {
  config: ApiConfig | null;
  me: MePayload | null;
  games: GamesPayload | null;
  rewards: RewardsPayload | null;
  selectedGameSlug: string | null;
  latestResult: SpinResult | null;
} = {
  config: null,
  me: null,
  games: null,
  rewards: null,
  selectedGameSlug: null,
  latestResult: null,
};

const SYMBOL_META: Record<string, { emoji: string; label: string; tint: number }> = {
  moon: { emoji: '\u{1F319}', label: 'Moon', tint: 0x7bdff6 },
  rune: { emoji: '\u2728', label: 'Rune', tint: 0xd0c6ff },
  coin: { emoji: '\u{1FA99}', label: 'Coin', tint: 0xffd166 },
  ghost: { emoji: '\u{1F47B}', label: 'Ghost', tint: 0xdfe8ff },
  crown: { emoji: '\u{1F451}', label: 'Crown', tint: 0xffd166 },
  mask: { emoji: '\u{1F3AD}', label: 'Mask', tint: 0xff8c42 },
  gem: { emoji: '\u{1F48E}', label: 'Gem', tint: 0x7ee8fa },
  lantern: { emoji: '\u{1F3EE}', label: 'Lantern', tint: 0xff8c42 },
  wild: { emoji: '\u{1F0CF}', label: 'Wild', tint: 0xff5d8f },
  scatter: { emoji: '\u{1F52E}', label: 'Scatter', tint: 0x8cffc1 },
};

const STAGE_WIDTH = 940;
const STAGE_HEIGHT = 520;
const CELL_WIDTH = 150;
const CELL_HEIGHT = 110;
const REEL_GAP = 18;
const ROWS_VISIBLE = 3;

class SlotStage {
  private app: Application;
  private root = new Container();
  private reelContainers: Container[] = [];
  private cellLabels: Text[][] = [];
  private frame = new Graphics();
  private highlights = new Graphics();
  private glow = new Graphics();
  private ready: Promise<void>;

  constructor(private host: HTMLElement) {
    this.app = new Application();
    this.ready = this.init();
  }

  private async init() {
    await this.app.init({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
    });
    this.host.innerHTML = '';
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.root.addChild(this.frame, this.glow, this.highlights);
  }

  async showMachine(game: SlotGame, result: SpinResult | null) {
    await this.ready;
    this.buildFrame(game);
    const grid = result?.grid?.length ? result.grid : buildIdleGrid(game);
    this.setGrid(grid, game);
    this.highlightWins(result, game);
  }

  private buildFrame(game: SlotGame) {
    const reels = game.reelCount;
    const accent = Color.shared.setValue(game.accent || '#9d7cf2').toNumber();
    const stageWidth = reels * CELL_WIDTH + (reels - 1) * REEL_GAP + 80;
    const stageHeight = ROWS_VISIBLE * CELL_HEIGHT + 120;
    this.frame.clear()
      .roundRect(20, 20, stageWidth, stageHeight, 28)
      .fill({ color: 0x120d1c, alpha: 0.96 })
      .stroke({ color: accent, alpha: 0.45, width: 3 });
    this.glow.clear()
      .roundRect(34, 34, stageWidth - 28, stageHeight - 28, 22)
      .fill({ color: accent, alpha: 0.08 });

    const startX = 42;
    const startY = 58;
    while (this.reelContainers.length < reels) {
      const reel = new Container();
      reel.filters = [new BlurFilter({ strength: 0 })];
      this.root.addChild(reel);
      this.reelContainers.push(reel);
      this.cellLabels.push([]);
    }
    while (this.reelContainers.length > reels) {
      const reel = this.reelContainers.pop();
      reel?.destroy({ children: true });
      this.cellLabels.pop();
    }

    this.reelContainers.forEach((reel, reelIndex) => {
      reel.removeChildren();
      this.cellLabels[reelIndex] = [];
      reel.x = startX + reelIndex * (CELL_WIDTH + REEL_GAP);
      reel.y = startY;
      for (let rowIndex = 0; rowIndex < ROWS_VISIBLE; rowIndex += 1) {
        const cell = new Graphics()
          .roundRect(0, rowIndex * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT - 10, 20)
          .fill({ color: 0x08060f, alpha: 0.92 })
          .stroke({ color: 0xffffff, alpha: 0.08, width: 2 });
        const emoji = new Text({
          text: '\u{1FA99}',
          style: new TextStyle({
            fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif',
            fontSize: 44,
            fontWeight: '700',
            fill: 0xffffff,
          }),
        });
        emoji.anchor.set(0.5);
        emoji.x = CELL_WIDTH / 2;
        emoji.y = rowIndex * CELL_HEIGHT + 34;

        const label = new Text({
          text: 'Coin',
          style: new TextStyle({
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 1.2,
            fill: 0xcfc8df,
          }),
        });
        label.anchor.set(0.5, 0);
        label.x = CELL_WIDTH / 2;
        label.y = rowIndex * CELL_HEIGHT + 62;
        reel.addChild(cell, emoji, label);
        this.cellLabels[reelIndex].push(emoji, label);
      }
    });
  }

  private setGrid(grid: string[][], game: SlotGame) {
    for (let reelIndex = 0; reelIndex < game.reelCount; reelIndex += 1) {
      for (let rowIndex = 0; rowIndex < ROWS_VISIBLE; rowIndex += 1) {
        this.setCell(reelIndex, rowIndex, grid[reelIndex]?.[rowIndex] || game.reelSymbols[0] || 'coin');
      }
    }
  }

  private setCell(reelIndex: number, rowIndex: number, symbol: string) {
    const symbolInfo = symbolMeta(symbol);
    const offset = rowIndex * 2;
    const emoji = this.cellLabels[reelIndex]?.[offset];
    const label = this.cellLabels[reelIndex]?.[offset + 1];
    if (!emoji || !label) return;
    emoji.text = symbolInfo.emoji;
    emoji.style.fill = symbolInfo.tint;
    label.text = symbolInfo.label.toUpperCase();
  }

  private highlightWins(result: SpinResult | null, game: SlotGame) {
    this.highlights.clear();
    if (!result) return;

    const startX = 42;
    const startY = 58;
    for (const win of result.lineWins || []) {
      for (const [reelIndex, rowIndex] of win.positions) {
        this.highlights
          .roundRect(
            startX + reelIndex * (CELL_WIDTH + REEL_GAP),
            startY + rowIndex * CELL_HEIGHT,
            CELL_WIDTH,
            CELL_HEIGHT - 10,
            20
          )
          .stroke({ color: 0xffd166, width: 4, alpha: 0.95 });
      }
    }

    for (const [reelIndex, rowIndex] of result.scatter?.positions || []) {
      this.highlights
        .roundRect(
          startX + reelIndex * (CELL_WIDTH + REEL_GAP),
          startY + rowIndex * CELL_HEIGHT,
          CELL_WIDTH,
          CELL_HEIGHT - 10,
          20
        )
        .stroke({ color: 0x8cffc1, width: 4, alpha: 0.95 });
    }
  }

  async spin(game: SlotGame, result: SpinResult) {
    await this.ready;
    this.highlights.clear();
    const pool = game.reelSymbols.length ? game.reelSymbols : ['coin', 'moon', 'ghost'];
    await Promise.all(
      Array.from({ length: game.reelCount }, (_, reelIndex) => this.animateReel(reelIndex, pool, result.grid[reelIndex], reelIndex))
    );
    this.highlightWins(result, game);
  }

  private async animateReel(reelIndex: number, pool: string[], finalReel: string[], offset: number) {
    const reel = this.reelContainers[reelIndex];
    const blur = reel.filters?.[0] as BlurFilter | undefined;
    if (blur) {
      blur.strength = 6;
    }

    await new Promise<void>((resolve) => {
      const start = performance.now();
      const duration = 850 + offset * 160;
      const timer = window.setInterval(() => {
        for (let rowIndex = 0; rowIndex < ROWS_VISIBLE; rowIndex += 1) {
          const symbol = pool[(Math.floor(Math.random() * pool.length) + rowIndex + offset) % pool.length];
          this.setCell(reelIndex, rowIndex, symbol);
        }
        if (performance.now() - start >= duration) {
          window.clearInterval(timer);
          for (let rowIndex = 0; rowIndex < ROWS_VISIBLE; rowIndex += 1) {
            this.setCell(reelIndex, rowIndex, finalReel[rowIndex] || pool[0]);
          }
          if (blur) {
            blur.strength = 0;
          }
          resolve();
        }
      }, 60);
    });
  }
}

async function boot() {
  state.config = await getJSON<ApiConfig>('/api/config');
  state.me = await getJSON<MePayload>('/api/me');
  renderAuth();
  await renderCasinoPage();
}

async function renderCasinoPage() {
  const summaryRoot = document.querySelector<HTMLElement>('[data-summary]');
  const contentRoot = document.querySelector<HTMLElement>('[data-content]');
  if (!summaryRoot || !contentRoot || !state.config || !state.me) return;

  state.games = await getJSON<GamesPayload>('/api/casino/games');
  if (!state.me.authenticated) {
    summaryRoot.innerHTML = renderStats([
      ['Machines', String(state.games.games.length)],
      ['Format', '5x3 video slots'],
      ['Guardrail', 'Points only'],
      ['Access', 'Sign in required'],
    ]);
    contentRoot.innerHTML = renderSignInState(state.config);
    return;
  }

  state.rewards = await getJSON<RewardsPayload>('/api/rewards');
  const games = state.games.games;
  const selected = games.find((game) => game.slug === state.selectedGameSlug) || games[0] || null;
  if (!selected) {
    summaryRoot.innerHTML = renderStats([
      ['Machines', '0'],
      ['Format', '5x3 video slots'],
      ['Guardrail', 'Points only'],
      ['Access', 'Ready'],
    ]);
    contentRoot.innerHTML = '<div class="app-empty">No slot cabinets are configured yet.</div>';
    return;
  }

  state.selectedGameSlug = selected.slug;
  if (state.latestResult?.gameSlug !== selected.slug) {
    state.latestResult = null;
  }

  summaryRoot.innerHTML = renderStats([
    ['Balance', formatPoints(state.rewards.balance)],
    ['Free spins', String(selected.freeSpinsRemaining)],
    ['Daily remaining', formatPoints(state.rewards.dailyRemaining)],
    ['Machines', String(games.length)],
  ]);

  contentRoot.innerHTML = renderCasinoMarkup(selected, games, state.rewards, state.latestResult);
  bindMachineButtons();
  await mountStage(selected, state.latestResult);
  bindSpinButton(selected);
}

function bindMachineButtons() {
  document.querySelectorAll<HTMLElement>('[data-machine-pick]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.selectedGameSlug = button.dataset.machinePick || null;
      state.latestResult = null;
      await renderCasinoPage();
    });
  });
}

async function bindSpinButton(game: SlotGame) {
  const button = document.querySelector<HTMLButtonElement>('[data-slot-spin]');
  const status = document.querySelector<HTMLElement>('[data-slot-status]');
  const resultRoot = document.querySelector<HTMLElement>('[data-slot-result]');
  const canvasRoot = document.querySelector<HTMLElement>('[data-slot-stage]');
  if (!button || !status || !resultRoot || !canvasRoot) return;

  const stage = new SlotStage(canvasRoot);
  await stage.showMachine(game, state.latestResult);

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = `${game.name} is spinning...`;
    try {
      const result = await getJSON<{ ok: true; result: SpinResult }>('/api/casino/spin', {
        method: 'POST',
        body: JSON.stringify({ gameSlug: game.slug }),
      });
      await stage.spin(game, result.result);
      state.latestResult = result.result;
      status.textContent = describeSpin(result.result);
      renderResultBoard(resultRoot, result.result, game);
      state.me = await getJSON<MePayload>('/api/me');
      await renderCasinoPage();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Spin failed.';
      renderError(resultRoot, error instanceof Error ? error.message : 'Spin failed.');
    } finally {
      button.disabled = false;
    }
  });
}

async function mountStage(game: SlotGame, result: SpinResult | null) {
  const canvasRoot = document.querySelector<HTMLElement>('[data-slot-stage]');
  if (!canvasRoot) return;
  const stage = new SlotStage(canvasRoot);
  await stage.showMachine(game, result);
}

function renderCasinoMarkup(selected: SlotGame, games: SlotGame[], rewards: RewardsPayload, latestResult: SpinResult | null) {
  return `
    <section class="slot-layout">
      <article class="app-card slot-main">
        <div class="slot-main__header">
          <div>
            <p class="app-kicker">Pixi Slot Floor</p>
            <h3>${escapeHtml(selected.name)}</h3>
            <p class="slot-copy">${escapeHtml(selected.flavor)}</p>
          </div>
          <div class="slot-chips">
            <span class="app-chip">${formatPoints(selected.cost)} stake</span>
            <span class="app-chip">${selected.paylinesCount} paylines</span>
            <span class="app-chip">${escapeHtml(selected.volatility)} volatility</span>
          </div>
        </div>
        <div class="slot-cabinet">
          <div class="slot-stage" data-slot-stage></div>
          <div class="slot-controls">
            <button class="button slot-spin" data-slot-spin>${selected.freeSpinsRemaining ? `Play Free Spin (${selected.freeSpinsRemaining})` : `Spin ${escapeHtml(selected.name)}`}</button>
            <div class="slot-status app-muted" data-slot-status>${latestResult ? escapeHtml(describeSpin(latestResult)) : 'Three scatters trigger free spins. Wilds substitute on paylines.'}</div>
          </div>
          <div class="slot-result app-banner" data-slot-result>${renderResultBoardMarkup(latestResult, selected)}</div>
        </div>
        <div class="slot-footer">
          <div><span class="app-muted">Jackpot</span><strong>${escapeHtml(selected.jackpotLabel || formatPoints(selected.topPayout))}</strong></div>
          <div><span class="app-muted">Mood</span><strong>${escapeHtml(selected.mood || 'Live machine')}</strong></div>
          <div><span class="app-muted">Free spins</span><strong>${selected.freeSpinsRemaining ? `${selected.freeSpinsRemaining} banked` : 'Trigger with 3 scatters'}</strong></div>
          <div><span class="app-muted">Latest balance</span><strong>${formatPoints(rewards.balance)}</strong></div>
        </div>
      </article>
      <aside class="slot-sidebar">
        <section class="app-card">
          <div class="app-card__row">
            <h3>Cabinets</h3>
            <span class="app-chip">${games.length} live</span>
          </div>
          <div class="slot-cabinet-list">
            ${games.map((game) => renderMachineButton(game, game.slug === selected.slug)).join('')}
          </div>
        </section>
        <section class="app-card">
          <h3>Player Board</h3>
          ${renderPlayerBoard(rewards, selected)}
        </section>
      </aside>
    </section>
    <section class="slot-bottom">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Paytable</h3>
          <span class="app-chip">Wild + scatter enabled</span>
        </div>
        ${renderPaytable(selected.paytable)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Recent Spins</h3>
          <span class="app-chip">${rewards.spins.length} logged</span>
        </div>
        ${renderHistory(rewards.spins)}
      </article>
    </section>
  `;
}

function renderMachineButton(game: SlotGame, active: boolean) {
  return `
    <button class="slot-machine-button ${active ? 'is-active' : ''}" data-machine-pick="${escapeHtml(game.slug)}" type="button">
      <div class="slot-machine-button__top">
        <strong>${escapeHtml(game.name)}</strong>
        <span>${formatPoints(game.cost)}</span>
      </div>
      <div class="slot-machine-button__meta">
        <span>${escapeHtml(game.volatility)} volatility</span>
        <span>${game.freeSpinsRemaining ? `${game.freeSpinsRemaining} free spins` : `${game.paylinesCount} lines`}</span>
      </div>
      <div class="slot-machine-button__symbols">
        ${game.reelSymbols.slice(0, 6).map((symbol) => `<span class="slot-chip">${symbolMeta(symbol).emoji}</span>`).join('')}
      </div>
    </button>
  `;
}

function renderPlayerBoard(rewards: RewardsPayload, game: SlotGame) {
  const lastWin = rewards.spins.find((spin) => spin.payout > 0);
  return `
    <div class="slot-player-grid">
      <div class="slot-player-stat"><span class="app-muted">Balance</span><strong>${formatPoints(rewards.balance)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Current cabinet</span><strong>${escapeHtml(game.name)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Wagered today</span><strong>${formatPoints(rewards.dailyWagered)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Last win</span><strong>${lastWin ? formatPoints(lastWin.payout) : 'Waiting'}</strong></div>
    </div>
    <div class="slot-meter">
      <div class="slot-meter__track"><span class="slot-meter__fill" style="width:${Math.min(100, (rewards.dailyWagered / Math.max(1, rewards.dailyCap)) * 100)}%"></span></div>
      <div class="app-muted">${formatPoints(rewards.dailyRemaining)} remaining before the daily cap.</div>
    </div>
  `;
}

function renderPaytable(paytable: PaytableEntry[]) {
  return `
    <div class="slot-paytable">
      ${paytable.map((entry) => `
        <div class="slot-paytable__row">
          <div class="slot-paytable__symbols">${entry.symbols.map((symbol) => `<span class="slot-chip">${symbolMeta(symbol).emoji}</span>`).join('')}</div>
          <div class="slot-paytable__copy">
            <strong>${escapeHtml(entry.label)}</strong>
            <span class="app-muted">${entry.kind === 'scatter' ? `${entry.freeSpins || 0} free spins` : `${entry.multiplier}x total bet`}</span>
          </div>
          <div class="slot-paytable__value">${formatPoints(entry.payout)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHistory(spins: SpinResult[]) {
  if (!spins.length) {
    return '<div class="app-empty">Your most recent spins will show up here.</div>';
  }
  return `
    <div class="slot-history">
      ${spins.slice(0, 8).map((spin) => `
        <div class="slot-history__row">
          <div>
            <strong>${escapeHtml(spin.game)}</strong>
            <div class="app-muted">${spin.symbols.map((symbol) => symbolMeta(symbol).emoji).join(' ')} ${escapeHtml(spin.outcome.label)}</div>
          </div>
          <div class="app-muted">${spin.usedFreeSpin ? 'Free spin' : formatPoints(spin.wager)}</div>
          <div class="slot-history__value ${spin.payout > 0 ? 'is-win' : ''}">${spin.net >= 0 ? '+' : ''}${formatPoints(spin.net)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResultBoardMarkup(result: SpinResult | null, game: SlotGame) {
  if (!result) {
    return `
      <div class="slot-result__label">Ready</div>
      <div class="slot-result__headline">${escapeHtml(game.name)} is loaded.</div>
      <div class="slot-result__copy">Hit paylines from left to right. Three scatters trigger the feature.</div>
    `;
  }
  return `
    <div class="slot-result__label">${escapeHtml(result.outcome.label)}</div>
    <div class="slot-result__headline">${escapeHtml(result.outcome.headline)}</div>
    <div class="slot-result__copy">${escapeHtml(result.outcome.detail)}</div>
    <div class="slot-result__symbols">${result.symbols.map((symbol) => `<span class="slot-chip">${symbolMeta(symbol).emoji}</span>`).join('')}</div>
  `;
}

function renderResultBoard(root: HTMLElement, result: SpinResult, game: SlotGame) {
  root.innerHTML = renderResultBoardMarkup(result, game);
}

function renderError(root: HTMLElement, message: string) {
  root.innerHTML = `<div class="slot-result__label">Error</div><div class="slot-result__headline">Spin failed.</div><div class="slot-result__copy">${escapeHtml(message)}</div>`;
}

function renderStats(items: Array<[string, string]>) {
  return items.map(([label, value]) => `
    <article class="app-stat">
      <div class="app-stat__value">${value}</div>
      <div class="app-stat__label">${escapeHtml(label)}</div>
    </article>
  `).join('');
}

function renderSignInState(config: ApiConfig) {
  const loginHref = config.authConfigured
    ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
    : config.devAuthEnabled
      ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
      : '';
  return `
    <div class="app-empty">
      <p>Sign in to play the Pixi-powered slot floor and store your spins on the Ghosted backend.</p>
      ${loginHref ? `<a class="button" href="${loginHref}">Sign In With Discord</a>` : '<p class="app-muted">Configure Discord auth to enable play.</p>'}
    </div>
  `;
}

function renderAuth() {
  const authRoot = document.querySelector<HTMLElement>('[data-auth]');
  if (!authRoot || !state.config || !state.me) return;
  if (!state.me.authenticated) {
    const href = state.config.authConfigured
      ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
      : state.config.devAuthEnabled
        ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
        : '#';
    authRoot.innerHTML = href === '#'
      ? '<div class="app-muted">Discord auth needs env vars before sign-in goes live.</div>'
      : `<a class="button" href="${href}">Sign In With Discord</a>`;
    return;
  }

  const user = state.me.user;
  const avatar = user.avatarUrl
    ? `<img class="app-user__avatar" src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" />`
    : `<div class="app-user__avatar">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</div>`;
  authRoot.innerHTML = `
    <div class="app-user">
      ${avatar}
      <div>
        <div><strong>${escapeHtml(user.displayName)}</strong></div>
        <div class="app-muted">${formatPoints(user.balance)} points</div>
      </div>
    </div>
    ${user.isAdmin ? '<a class="app-nav__link" href="/admin/">Admin</a>' : ''}
    <button class="button button--secondary" data-logout>Log Out</button>
  `;
  authRoot.querySelector<HTMLElement>('[data-logout]')?.addEventListener('click', async () => {
    await getJSON('/auth/logout', { method: 'POST' });
    window.location.reload();
  });
}

function buildIdleGrid(game: SlotGame) {
  return Array.from({ length: game.reelCount }, (_, reelIndex) =>
    Array.from({ length: ROWS_VISIBLE }, (_, rowIndex) => game.reelSymbols[(reelIndex + rowIndex) % game.reelSymbols.length] || 'coin')
  );
}

function describeSpin(result: SpinResult) {
  if (result.freeSpinsAwarded) {
    return `${result.freeSpinsAwarded} free spins awarded with ${result.scatter.count} scatters.`;
  }
  if (result.usedFreeSpin) {
    return result.payout > 0
      ? `Free spin paid ${formatPoints(result.payout)}. ${result.freeSpinsRemaining} free spins remain.`
      : `Free spin used. ${result.freeSpinsRemaining} free spins remain.`;
  }
  if (result.payout > 0) {
    return `Paid ${formatPoints(result.payout)} across ${result.lineWins.length || 1} winning lines.`;
  }
  return `No line hit. Net ${formatPoints(result.net)} on that spin.`;
}

function symbolMeta(symbol: string) {
  return SYMBOL_META[symbol] || { emoji: '\u2754', label: symbol || 'Unknown', tint: 0xffffff };
}

async function getJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed for ${url}`);
  }
  return payload as T;
}

function formatPoints(value: number) {
  return `${Number(value || 0).toLocaleString()} pts`;
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

boot().catch((error: unknown) => {
  const banner = document.querySelector<HTMLElement>('[data-banner]');
  if (banner) {
    banner.innerHTML = `<div class="app-banner is-error">${escapeHtml(error instanceof Error ? error.message : 'Casino boot failed.')}</div>`;
  }
});
