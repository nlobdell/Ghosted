import './style.css';
import Phaser from 'phaser';
import { logout } from './game/api';
import { SlotScene } from './game/scenes/SlotScene';
import { CasinoStore } from './game/store';
import { renderAuth, renderCasinoApp, renderSignInState, renderSummary } from './game/ui';
import type { CasinoState } from './game/types';

const store = new CasinoStore();

let phaserGame: Phaser.Game | null = null;
let resizeObserver: ResizeObserver | null = null;
let previousState: CasinoState | null = null;
let slotScene: SlotScene | null = null;

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
    }

    previousState = nextState;
  });
}

function bindMachineButtons() {
  document.querySelectorAll<HTMLElement>('[data-machine-pick]').forEach((button) => {
    button.addEventListener('click', () => {
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
    button.disabled = true;
    button.textContent = 'Spinning...';
    status.textContent = `${game.name} is spinning...`;
    try {
      const pending = await store.spin();
      await slotScene?.playSpin(game, pending.result);
      store.commitSpin(pending);
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

  if (phaserGame) {
    resizeObserver?.disconnect();
    phaserGame.destroy(true);
    phaserGame = null;
  }

  slotScene = new SlotScene();
  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#08050f',
    height: 680,
    parent: host,
    render: {
      antialias: true,
      pixelArt: false,
    },
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: 680,
      mode: Phaser.Scale.NONE,
      width: 1100,
    },
    scene: [slotScene],
    transparent: true,
    width: 1100,
  });

  await slotScene.ready;
  await slotScene.showMachine(game, store.state.latestResult?.gameSlug === game.slug ? store.state.latestResult : null);
  resizeStage(host);
  resizeObserver = new ResizeObserver(() => resizeStage(host));
  resizeObserver.observe(host);
}

function resizeStage(host: HTMLElement) {
  const width = Math.max(320, host.clientWidth || 320);
  const height = Math.max(420, Math.round(width * 0.66));
  slotScene?.resize(width, height);
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
    balance: state.rewards?.balance || 0,
    dailyRemaining: state.rewards?.dailyRemaining || 0,
    latestResult: state.latestResult
      ? {
          freeSpinsAwarded: state.latestResult.freeSpinsAwarded,
          freeSpinsRemaining: state.latestResult.freeSpinsRemaining,
          gameSlug: state.latestResult.gameSlug,
          payout: state.latestResult.payout,
          symbols: state.latestResult.symbols,
        }
      : null,
    recentSpinCount: state.rewards?.spins.length || 0,
    selectedGameSlug: state.selectedGameSlug,
    spinning: false,
  });
}

boot().catch((error: unknown) => {
  const banner = document.querySelector<HTMLElement>('[data-banner]');
  if (banner) {
    banner.innerHTML = `<div class="app-banner is-error">${error instanceof Error ? error.message : 'Casino boot failed.'}</div>`;
  }
});
