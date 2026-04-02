import { fetchConfig, fetchGames, fetchMe, fetchRewards, spinGame } from './api';
import type { CasinoState, GamesPayload, MePayload, SlotGame, RewardsPayload, SpinResult } from './types';

type Listener = (state: CasinoState) => void;
type PendingSpin = {
  games: GamesPayload;
  me: MePayload;
  result: SpinResult;
  rewards: RewardsPayload;
  selectedGameSlug: string | null;
};

export class CasinoStore {
  private listeners = new Set<Listener>();

  state: CasinoState = {
    config: null,
    games: null,
    latestResult: null,
    me: null,
    rewards: null,
    selectedGameSlug: null,
    spinning: false,
  };

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): CasinoState {
    return {
      ...this.state,
      games: this.state.games ? { ...this.state.games, games: [...this.state.games.games] } : null,
      rewards: this.state.rewards ? { ...this.state.rewards, spins: [...this.state.rewards.spins] } : null,
    };
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private patch(partial: Partial<CasinoState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  selectedGame() {
    const games = this.state.games?.games || [];
    return games.find((game) => game.slug === this.state.selectedGameSlug) || games[0] || null;
  }

  isAuthenticated() {
    return Boolean(this.state.me?.authenticated);
  }

  async boot() {
    const [config, me, games] = await Promise.all([fetchConfig(), fetchMe(), fetchGames()]);
    const selectedGameSlug = games.games.find((game) => game.slug === this.state.selectedGameSlug)?.slug || games.games[0]?.slug || null;
    this.patch({ config, me, games, selectedGameSlug });
    if (me.authenticated) {
      const rewards = await fetchRewards();
      this.patch({ rewards });
    }
  }

  async refreshRewards() {
    if (!this.state.me?.authenticated) {
      this.patch({ rewards: null });
      return;
    }
    const rewards = await fetchRewards();
    this.patch({ rewards });
  }

  async refreshSession() {
    const me = await fetchMe();
    this.patch({ me });
    if (me.authenticated) {
      await this.refreshRewards();
    } else {
      this.patch({ rewards: null, latestResult: null });
    }
  }

  selectGame(gameSlug: string) {
    this.patch({
      latestResult: this.state.latestResult?.gameSlug === gameSlug ? this.state.latestResult : null,
      selectedGameSlug: gameSlug,
    });
  }

  async spin() {
    const game = this.selectedGame();
    if (!game) {
      throw new Error('No slot cabinet is available.');
    }
    if (this.state.spinning) {
      throw new Error('That machine is already spinning.');
    }

    this.state = { ...this.state, spinning: true };
    try {
      const payload = await spinGame(game.slug);
      const [games, rewards, me] = await Promise.all([fetchGames(), fetchRewards(), fetchMe()]);
      const updated = games.games.find((entry) => entry.slug === game.slug) || null;
      const selectedGameSlug =
        games.games.find((entry) => entry.slug === (updated?.slug || game.slug))?.slug || games.games[0]?.slug || null;
      return {
        games,
        me,
        result: payload.result,
        rewards,
        selectedGameSlug,
      } satisfies PendingSpin;
    } catch (error) {
      this.patch({ spinning: false });
      throw error;
    }
  }

  commitSpin(pending: PendingSpin) {
    this.patch({
      games: pending.games,
      latestResult: pending.result,
      me: pending.me,
      rewards: pending.rewards,
      selectedGameSlug: pending.selectedGameSlug,
      spinning: false,
    });
  }

  clearSpinLock() {
    if (!this.state.spinning) return;
    this.patch({ spinning: false });
  }

  machineFreeSpins(game: SlotGame | null) {
    if (!game) return 0;
    return game.freeSpinsRemaining || 0;
  }
}
