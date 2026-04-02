import './style.css';
import { logout } from './game/api';
import { SlotRenderer } from './game/renderers/SlotRenderer';
import { CasinoStore } from './game/store';
import { renderAuth, renderCasinoApp, renderSignInState, renderSummary } from './game/ui';
import type { CasinoState } from './game/types';

const store = new CasinoStore();

let previousState: CasinoState | null = null;
let slotRenderer: SlotRenderer | null = null;

async function boot() {
  await store.boot();
  store.subscribe(async (state) => {
    const nextState = state;
    const authRoot = document.querySelector<HTMLElement>('[data-auth]');
    const summaryRoot = document.querySelector<HTMLElement>('[data-summary]');
    const contentRoot = document.querySelector<HTMLElement>('[data-content]');
    if (!authRoot || !summaryRoot || !contentRoot || !nextState.config || !nextState.me) {
      previousState = nextState;
      return;
    }

    if (!previousState || authSignature(previousState) !== authSignature(nextState)) {
      authRoot.innerHTML = renderAuth(nextState.config, nextState.me);
      authRoot.querySelector<HTMLElement>('[data-logout]')?.addEventListener('click', async () => {
        await logout();
        window.location.reload();
      });
    }

    if (!previousState || summarySignature(previousState) !== summarySignature(nextState)) {
      summaryRoot.innerHTML = renderSummary(nextState);
    }

    if (!previousState || contentSignature(previousState) !== contentSignature(nextState)) {
      if (!nextState.me.authenticated) {
        contentRoot.innerHTML = renderSignInState(nextState.config);
      } else {
        contentRoot.innerHTML = renderCasinoApp(nextState);
        bindMachineButtons();
        bindSpinButton();
        await mountStage();
      }
    } else if (nextState.me.authenticated) {
      syncCasinoPanels();
    }

    previousState = nextState;
  });
}

function bindMachineButtons() {
  document.querySelectorAll<HTMLElement>('[data-machine-pick]').forEach((button) => {
    button.addEventListener('click', () => {
      slotRenderer?.armAudio();
      const gameSlug = button.dataset.machinePick;
      if (!gameSlug) return;
      store.selectGame(gameSlug);
    });
  });
}

function bindSpinButton() {
  const button = document.querySelector<HTMLButtonElement>('[data-spin]');
  const status = document.querySelector<HTMLElement>('[data-status]');
  const game = store.selectedGame();
  if (!button || !status || !game) return;

  button.addEventListener('click', async () => {
    slotRenderer?.armAudio();
    button.disabled = true;
    button.textContent = 'Spinning...';
    status.textContent = `${game.name} is spinning...`;
    try {
      const pending = await store.spin();
      await slotRenderer?.playSpin(game, pending.result);
      store.commitSpin(pending);
      syncCasinoPanels();
    } catch (error) {
      store.clearSpinLock();
      status.textContent = error instanceof Error ? error.message : 'Spin failed.';
      button.disabled = false;
      button.textContent = game.freeSpinsRemaining ? `Play Free Spin (${game.freeSpinsRemaining})` : `Spin ${game.name}`;
    }
  });
}

async function mountStage() {
  const host = document.querySelector<HTMLElement>('[data-game-stage]');
  const game = store.selectedGame();
  if (!host || !game) return;

  slotRenderer ??= new SlotRenderer();
  await slotRenderer.mount(host);
  await slotRenderer.showMachine(game, store.state.latestResult?.gameSlug === game.slug ? store.state.latestResult : null);
}

function authSignature(state: CasinoState) {
  return JSON.stringify({
    authenticated: state.me?.authenticated,
    avatarUrl: state.me?.authenticated ? state.me.user.avatarUrl : null,
    balance: state.me?.authenticated ? state.me.user.balance : 0,
    displayName: state.me?.authenticated ? state.me.user.displayName : '',
    isAdmin: state.me?.authenticated ? state.me.user.isAdmin : false,
  });
}

function summarySignature(state: CasinoState) {
  return JSON.stringify({
    authenticated: state.me?.authenticated,
    balance: state.rewards?.balance || 0,
    dailyRemaining: state.rewards?.dailyRemaining || 0,
    freeSpinsRemaining: store.selectedGame()?.freeSpinsRemaining || 0,
    games: state.games?.games.length || 0,
  });
}

function contentSignature(state: CasinoState) {
  return JSON.stringify({
    authenticated: state.me?.authenticated,
    games: (state.games?.games || []).map((game) => ({
      freeSpinsRemaining: game.freeSpinsRemaining,
      slug: game.slug,
    })),
    selectedGameSlug: state.selectedGameSlug,
  });
}

function syncCasinoPanels() {
  const state = store.state;
  const game = store.selectedGame();
  if (!state.me?.authenticated || !state.rewards || !game) return;

  const headline = document.querySelector<HTMLElement>('[data-console-headline]');
  const copy = document.querySelector<HTMLElement>('[data-console-copy]');
  const status = document.querySelector<HTMLElement>('[data-status]');
  const spin = document.querySelector<HTMLButtonElement>('[data-spin]');
  const playerBoard = document.querySelector<HTMLElement>('[data-player-board]');
  const history = document.querySelector<HTMLElement>('[data-history]');

  if (headline) {
    headline.textContent = state.latestResult?.outcome.headline || `${game.name} is loaded`;
  }
  if (copy) {
    copy.textContent = state.latestResult?.outcome.detail
      || `${game.rows} rows, ${game.reelCount} reels, and server-resolved paylines. Wilds substitute. Scatters unlock the feature.`;
  }
  if (status) {
    if (state.spinning) {
      status.textContent = `${game.name} is spinning...`;
    } else if (state.latestResult?.freeSpinsAwarded) {
      status.textContent = `${state.latestResult.freeSpinsAwarded} free spins awarded with ${state.latestResult.scatter.count} scatters.`;
    } else if (state.latestResult?.usedFreeSpin) {
      status.textContent = `${state.latestResult.freeSpinsRemaining} free spins remain in the bank.`;
    } else if (state.latestResult?.payout) {
      status.textContent = `Paid ${state.latestResult.payout.toLocaleString()} pts across ${state.latestResult.lineWins.length || 1} winning lines.`;
    } else if (state.latestResult) {
      status.textContent = `No hit. Net ${state.latestResult.net.toLocaleString()} pts on that spin.`;
    }
  }
  if (spin) {
    spin.disabled = state.spinning;
    spin.textContent = state.spinning
      ? 'Spinning...'
      : game.freeSpinsRemaining
        ? `Play Free Spin (${game.freeSpinsRemaining})`
        : `Spin ${game.name}`;
  }
  if (playerBoard) {
    const lastWin = state.rewards.spins.find((entry) => entry.payout > 0);
    const meterWidth = state.rewards.dailyCap === null || state.rewards.dailyCap <= 0
      ? 100
      : Math.min(100, (state.rewards.dailyWagered / state.rewards.dailyCap) * 100);
    const meterCopy = state.rewards.dailyCap === null
      ? `${state.rewards.dailyWagered.toLocaleString()} pts wagered today. No limit is active right now.`
      : `${(state.rewards.dailyRemaining || 0).toLocaleString()} pts remaining before the daily cap.`;
    playerBoard.innerHTML = `
      <div class="casino-player-grid">
        <div class="casino-player-stat"><span class="app-muted">Balance</span><strong>${state.rewards.balance.toLocaleString()} pts</strong></div>
        <div class="casino-player-stat"><span class="app-muted">Machine</span><strong>${game.name}</strong></div>
        <div class="casino-player-stat"><span class="app-muted">Wagered today</span><strong>${state.rewards.dailyWagered.toLocaleString()} pts</strong></div>
        <div class="casino-player-stat"><span class="app-muted">Last win</span><strong>${lastWin ? `${lastWin.payout.toLocaleString()} pts` : 'Waiting'}</strong></div>
      </div>
      <div class="casino-meter">
        <div class="casino-meter__track"><span class="casino-meter__fill" style="width:${meterWidth}%"></span></div>
        <div class="app-muted">${meterCopy}</div>
      </div>
    `;
  }
  if (history) {
    if (!state.rewards.spins.length) {
      history.innerHTML = '<div class="app-empty">The floor log starts filling in after your first spin.</div>';
    } else {
      history.innerHTML = `
        <div class="casino-history">
          ${state.rewards.spins.slice(0, 8).map((entry) => `
            <div class="casino-history__row">
              <div>
                <strong>${entry.game}</strong>
                <div class="app-muted">${entry.symbols.join(' ')} ${entry.outcome.label}</div>
              </div>
              <div class="app-muted">${entry.usedFreeSpin ? 'Free spin' : `${entry.wager.toLocaleString()} pts`}</div>
              <div class="casino-history__value ${entry.payout > 0 ? 'is-win' : ''}">${entry.net >= 0 ? '+' : ''}${entry.net.toLocaleString()} pts</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }
}

boot().catch((error: unknown) => {
  const banner = document.querySelector<HTMLElement>('[data-banner]');
  if (banner) {
    banner.innerHTML = `<div class="app-banner is-error">${error instanceof Error ? error.message : 'Casino boot failed.'}</div>`;
  }
});
