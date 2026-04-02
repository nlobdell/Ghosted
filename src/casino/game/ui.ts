import { symbolMeta, uniqueSymbols } from './symbols';
import type { ApiConfig, CasinoState, MePayload, SlotGame, SpinResult } from './types';

export function renderSummary(state: CasinoState) {
  const game = selectedGame(state);
  if (!state.me?.authenticated) {
    return stats([
      ['Machines', String(state.games?.games.length || 0)],
      ['Format', '5x3 live slots'],
      ['Guardrail', 'Points only'],
      ['Access', 'Sign in required'],
    ]);
  }

  return stats([
    ['Balance', formatPoints(state.rewards?.balance || state.me.user.balance || 0)],
    ['Cabinets', String(state.games?.games.length || 0)],
    ['Free spins', String(game?.freeSpinsRemaining || 0)],
    ['Wager limit', formatWagerLimit(state.rewards?.dailyCap ?? null)],
  ]);
}

export function renderSignInState(config: ApiConfig) {
  const loginHref = config.authConfigured
    ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
    : config.devAuthEnabled
      ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
      : '';
  return `
    <div class="app-empty">
      <p>Sign in to play.</p>
      ${loginHref ? `<a class="button" href="${loginHref}">Sign In With Discord</a>` : '<p class="app-muted">Configure Discord auth to enable play.</p>'}
    </div>
  `;
}

export function renderAuth(config: ApiConfig, me: MePayload) {
  if (!me.authenticated) {
    const href = config.authConfigured
      ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
      : config.devAuthEnabled
        ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
        : '#';
    return href === '#'
      ? '<div class="app-muted">Discord auth needs env vars before sign-in goes live.</div>'
      : `<a class="button" href="${href}">Sign In With Discord</a>`;
  }

  const user = me.user;
  const avatar = user.avatarUrl
    ? `<img class="app-user__avatar" src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" />`
    : `<div class="app-user__avatar">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</div>`;
  return `
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
}

export function renderCasinoApp(state: CasinoState) {
  const game = selectedGame(state);
  if (!game || !state.rewards) {
    return '<div class="app-empty">No slot cabinets are configured yet.</div>';
  }

  return `
    <section class="casino-shell">
      <article class="app-card casino-stage-shell">
        <div class="casino-stage-shell__top">
          <div>
            <p class="app-kicker">Game App</p>
            <h3>${escapeHtml(game.name)}</h3>
          </div>
          <div class="casino-stage-shell__chips">
            <span class="app-chip">${formatPoints(game.cost)} stake</span>
            <span class="app-chip">${game.paylinesCount} paylines</span>
            <span class="app-chip">${escapeHtml(game.volatility)} volatility</span>
          </div>
        </div>
        <div class="casino-stage-shell__playfield">
          <div class="casino-stage-shell__canvas" data-game-stage></div>
        </div>
        <div class="casino-stage-shell__info">
          <aside class="casino-stage-shell__panel">
            <div class="casino-console" data-console>
              <div class="casino-console__headline" data-console-headline>${escapeHtml(resultHeadline(state.latestResult, game))}</div>
            </div>
            <div class="casino-controls">
              <button class="button casino-controls__spin" data-spin>${spinLabel(game, state.spinning)}</button>
              <div class="app-muted casino-controls__status" data-status>${escapeHtml(statusCopy(state.latestResult, game, state.spinning))}</div>
            </div>
            <div class="casino-panel-grid">
              <div class="casino-panel-stat">
                <span class="app-muted">Jackpot</span>
                <strong>${escapeHtml(game.jackpotLabel || formatPoints(game.topPayout))}</strong>
              </div>
              <div class="casino-panel-stat">
                <span class="app-muted">Return</span>
                <strong>${formatPercent(game.returnRate)}</strong>
              </div>
              <div class="casino-panel-stat">
                <span class="app-muted">Hit rate</span>
                <strong>${formatPercent(game.hitRate)}</strong>
              </div>
              <div class="casino-panel-stat">
                <span class="app-muted">Free spins</span>
                <strong>${game.freeSpinsRemaining ? `${game.freeSpinsRemaining} banked` : 'Trigger with 3 scatters'}</strong>
              </div>
            </div>
          </aside>
          <section class="app-card casino-stage-shell__card">
            <div class="app-card__row">
              <h3>Player Board</h3>
              <span class="app-chip">${formatPoints(state.rewards.balance)}</span>
            </div>
            <div data-player-board>${renderPlayerBoard(state)}</div>
          </section>
          <section class="app-card casino-stage-shell__card">
            <div class="app-card__row">
              <h3>Cabinets</h3>
              <span class="app-chip">${state.games?.games.length || 0} live</span>
            </div>
            <div class="casino-machine-list">
              ${(state.games?.games || []).map((item) => renderMachineButton(item, item.slug === game.slug)).join('')}
            </div>
          </section>
        </div>
      </article>
      <section class="casino-shell__bottom">
        <article class="app-card">
          <div class="app-card__row">
            <h3>Paytable</h3>
            <span class="app-chip">${uniqueSymbols(game.reelSymbols).length} symbols</span>
          </div>
          ${renderPaytable(game)}
        </article>
        <article class="app-card">
          <div class="app-card__row">
            <h3>Recent Spins</h3>
            <span class="app-chip">${state.rewards.spins.length} logged</span>
          </div>
          <div data-history>${renderHistory(state.rewards.spins)}</div>
        </article>
      </section>
    </section>
  `;
}

function renderMachineButton(game: SlotGame, active: boolean) {
  return `
    <button class="casino-machine-button ${active ? 'is-active' : ''}" data-machine-pick="${escapeHtml(game.slug)}" type="button">
      <div class="casino-machine-button__top">
        <strong>${escapeHtml(game.name)}</strong>
        <span>${formatPoints(game.cost)}</span>
      </div>
      <div class="casino-machine-button__meta">
        <span>${escapeHtml(game.volatility)} volatility</span>
        <span>${game.freeSpinsRemaining ? `${game.freeSpinsRemaining} free spins` : `${game.paylinesCount} lines`}</span>
      </div>
      <div class="casino-machine-button__symbols">
        ${uniqueSymbols(game.reelSymbols).slice(0, 6).map((symbol) => `<span class="slot-chip">${symbolMeta(symbol).emoji}</span>`).join('')}
      </div>
    </button>
  `;
}

function renderPlayerBoard(state: CasinoState) {
  const rewards = state.rewards;
  const game = selectedGame(state);
  if (!rewards || !game) return '';
  const lastWin = rewards.spins.find((spin) => spin.payout > 0);
  return `
    <div class="casino-player-grid">
      <div class="casino-player-stat"><span class="app-muted">Balance</span><strong>${formatPoints(rewards.balance)}</strong></div>
      <div class="casino-player-stat"><span class="app-muted">Machine</span><strong>${escapeHtml(game.name)}</strong></div>
      <div class="casino-player-stat"><span class="app-muted">Wagered today</span><strong>${formatPoints(rewards.dailyWagered)}</strong></div>
      <div class="casino-player-stat"><span class="app-muted">Last win</span><strong>${lastWin ? formatPoints(lastWin.payout) : 'Waiting'}</strong></div>
    </div>
    <div class="casino-meter">
      <div class="casino-meter__track"><span class="casino-meter__fill" style="width:${meterWidth(rewards.dailyWagered, rewards.dailyCap)}%"></span></div>
      <div class="app-muted">${wagerMeterCopy(rewards.dailyWagered, rewards.dailyRemaining, rewards.dailyCap)}</div>
    </div>
  `;
}

function renderPaytable(game: SlotGame) {
  return `
    <div class="casino-paytable">
      ${game.paytable.map((entry) => `
        <div class="casino-paytable__row">
          <div class="casino-paytable__symbols">${entry.symbols.map((symbol) => `<span class="slot-chip">${symbolMeta(symbol).emoji}</span>`).join('')}</div>
          <div class="casino-paytable__copy">
            <strong>${escapeHtml(entry.label)}</strong>
            <span class="app-muted">${entry.kind === 'scatter' ? `${entry.freeSpins || 0} free spins` : `${entry.multiplier}x total bet`}</span>
          </div>
          <div class="casino-paytable__value">${formatPoints(entry.payout)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHistory(spins: SpinResult[]) {
  if (!spins.length) {
    return '<div class="app-empty">The floor log starts filling in after your first spin.</div>';
  }
  return `
    <div class="casino-history">
      ${spins.slice(0, 8).map((spin) => `
        <div class="casino-history__row">
          <div>
            <strong>${escapeHtml(spin.game)}</strong>
            <div class="app-muted">${spin.symbols.map((symbol) => symbolMeta(symbol).emoji).join(' ')} ${escapeHtml(spin.outcome.label)}</div>
          </div>
          <div class="app-muted">${spin.usedFreeSpin ? 'Free spin' : formatPoints(spin.wager)}</div>
          <div class="casino-history__value ${spin.payout > 0 ? 'is-win' : ''}">${spin.net >= 0 ? '+' : ''}${formatPoints(spin.net)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function resultHeadline(result: SpinResult | null, game: SlotGame) {
  return result?.outcome.headline || game.name;
}

function statusCopy(result: SpinResult | null, game: SlotGame, spinning: boolean) {
  if (spinning) {
    return 'Spinning...';
  }
  if (!result) {
    return `${formatPoints(game.cost)} stake`;
  }
  if (result.freeSpinsAwarded) {
    return `${result.freeSpinsAwarded} free spins awarded`;
  }
  if (result.usedFreeSpin) {
    return `${result.freeSpinsRemaining} free spins left`;
  }
  if (result.payout > 0) {
    return `${formatPoints(result.payout)} paid`;
  }
  return 'No win';
}

function spinLabel(game: SlotGame, spinning: boolean) {
  if (spinning) return 'Spinning...';
  return game.freeSpinsRemaining ? `Play Free Spin (${game.freeSpinsRemaining})` : `Spin ${game.name}`;
}

function selectedGame(state: CasinoState) {
  const games = state.games?.games || [];
  return games.find((game) => game.slug === state.selectedGameSlug) || games[0] || null;
}

function stats(items: Array<[string, string]>) {
  return items
    .map(
      ([label, value]) => `
        <article class="app-stat">
          <div class="app-stat__value">${value}</div>
          <div class="app-stat__label">${escapeHtml(label)}</div>
        </article>
      `
    )
    .join('');
}

export function formatPercent(value: number) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return `${(number * 100).toFixed(number < 0.1 ? 1 : 0)}%`;
}

export function formatPoints(value: number) {
  return `${Number(value || 0).toLocaleString()} pts`;
}

export function formatWagerLimit(value: number | null) {
  return value === null ? 'Unlimited' : formatPoints(value);
}

export function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function meterWidth(wagered: number, cap: number | null) {
  if (cap === null || cap <= 0) return 100;
  return Math.min(100, (wagered / cap) * 100);
}

function wagerMeterCopy(wagered: number, remaining: number | null, cap: number | null) {
  if (cap === null) {
    return `${formatPoints(wagered)} wagered today. No limit is active right now.`;
  }
  return `${formatPoints(remaining || 0)} remaining before the daily cap.`;
}
