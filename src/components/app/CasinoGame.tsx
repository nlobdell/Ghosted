'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@/casino/style.css';
import {
  fetchConfig,
  fetchGames,
  fetchMe,
  fetchRewards,
  spinGame,
} from '@/casino/game/api';
import { SlotRenderer } from '@/casino/game/renderers/SlotRenderer';
import { symbolMeta, uniqueSymbols } from '@/casino/game/symbols';
import type {
  ApiConfig,
  GamesPayload,
  MePayload,
  RewardsPayload,
  SpinResult,
} from '@/casino/game/types';

type LoadState = 'loading' | 'ready' | 'error';

export default function CasinoGame() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [games, setGames] = useState<GamesPayload | null>(null);
  const [rewards, setRewards] = useState<RewardsPayload | null>(null);
  const [selectedGameSlug, setSelectedGameSlug] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading casino...');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SlotRenderer | null>(null);

  const selectedGame = useMemo(() => {
    const options = games?.games ?? [];
    return options.find((game) => game.slug === selectedGameSlug) ?? options[0] ?? null;
  }, [games, selectedGameSlug]);

  const isAuthed = Boolean(me?.authenticated);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        setLoadState('loading');
        setStatusMessage('Loading casino...');
        const [nextConfig, nextMe, nextGames] = await Promise.all([
          fetchConfig(),
          fetchMe(),
          fetchGames(),
        ]);
        if (!active) return;

        setConfig(nextConfig);
        setMe(nextMe);
        setGames(nextGames);
        setSelectedGameSlug((current) => {
          if (current && nextGames.games.some((game) => game.slug === current)) return current;
          return nextGames.games[0]?.slug ?? null;
        });

        if (nextMe.authenticated) {
          const nextRewards = await fetchRewards();
          if (!active) return;
          setRewards(nextRewards);
          setStatusMessage('Pick a machine and spin.');
        } else {
          setRewards(null);
          setStatusMessage('Sign in to play.');
        }

        setErrorMessage('');
        setLoadState('ready');
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Casino failed to load.';
        setErrorMessage(message);
        setStatusMessage(message);
        setLoadState('error');
      }
    }

    void boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadState !== 'ready' || !isAuthed || !selectedGame || !stageRef.current) return;
    let cancelled = false;
    const renderer = rendererRef.current ?? new SlotRenderer();
    rendererRef.current = renderer;

    async function syncRenderer() {
      await renderer.mount(stageRef.current as HTMLDivElement);
      if (cancelled) return;
      await renderer.showMachine(
        selectedGame,
        latestResult?.gameSlug === selectedGame.slug ? latestResult : null
      );
    }

    void syncRenderer().catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : 'Renderer failed to mount.';
      setErrorMessage(message);
      setLoadState('error');
      setStatusMessage(message);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthed, latestResult, loadState, selectedGame]);

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  async function onSpin() {
    if (!selectedGame || spinning || !isAuthed) return;

    setSpinning(true);
    setStatusMessage(`${selectedGame.name} is spinning...`);
    try {
      const payload = await spinGame(selectedGame.slug);
      await rendererRef.current?.playSpin(selectedGame, payload.result);

      const [nextGames, nextRewards, nextMe] = await Promise.all([
        fetchGames(),
        fetchRewards(),
        fetchMe(),
      ]);

      setGames(nextGames);
      setRewards(nextRewards);
      setMe(nextMe);
      setLatestResult(payload.result);
      setSelectedGameSlug((current) => {
        const fallback = nextGames.games[0]?.slug ?? null;
        if (!current) return fallback;
        return nextGames.games.some((game) => game.slug === current) ? current : fallback;
      });

      if (payload.result.freeSpinsAwarded > 0) {
        setStatusMessage(`${payload.result.freeSpinsAwarded} free spins awarded.`);
      } else if (payload.result.payout > 0) {
        setStatusMessage(`${payload.result.payout.toLocaleString()} pts paid.`);
      } else if (payload.result.usedFreeSpin) {
        setStatusMessage(`${payload.result.freeSpinsRemaining} free spins left.`);
      } else {
        setStatusMessage('No win.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Spin failed.';
      setStatusMessage(message);
      setErrorMessage(message);
    } finally {
      setSpinning(false);
    }
  }

  function onSelectGame(slug: string) {
    setSelectedGameSlug(slug);
    setLatestResult((current) => (current?.gameSlug === slug ? current : null));
    setStatusMessage('Machine selected.');
  }

  function loginHref() {
    if (!config) return '';
    if (config.authConfigured) {
      return `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    if (config.devAuthEnabled) {
      return `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    return '';
  }

  if (loadState === 'loading') {
    return (
      <div id="casino-root">
        <div className="app-banner-slot" data-banner>
          <div className="app-banner">Loading casino...</div>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div id="casino-root">
        <div className="app-banner-slot" data-banner>
          <div className="app-banner is-error">{`Casino failed to load. ${errorMessage}`}</div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    const href = loginHref();
    return (
      <div id="casino-root">
        <div className="app-summary-grid">
          <article className="app-stat">
            <div className="app-stat__value">{String(games?.games.length ?? 0)}</div>
            <div className="app-stat__label">Machines</div>
          </article>
          <article className="app-stat">
            <div className="app-stat__value">5x3</div>
            <div className="app-stat__label">Grid</div>
          </article>
          <article className="app-stat">
            <div className="app-stat__value">Points</div>
            <div className="app-stat__label">Format</div>
          </article>
          <article className="app-stat">
            <div className="app-stat__value">Sign in</div>
            <div className="app-stat__label">Access</div>
          </article>
        </div>
        <section className="app-workspace">
          <div className="app-empty">
            <p>Sign in to play the casino.</p>
            {href ? <a className="button" href={href}>Sign In With Discord</a> : <p className="app-muted">Sign-in is not configured.</p>}
          </div>
        </section>
      </div>
    );
  }

  if (!selectedGame || !rewards || !games) {
    return (
      <div id="casino-root">
        <div className="app-banner-slot" data-banner>
          <div className="app-banner is-error">No slot cabinets are available.</div>
        </div>
      </div>
    );
  }

  const machineList = games.games;
  const lastWin = rewards.spins.find((spin) => spin.payout > 0);
  const meterWidth = rewards.dailyCap === null || rewards.dailyCap <= 0
    ? 100
    : Math.min(100, (rewards.dailyWagered / rewards.dailyCap) * 100);
  const freeSpinLabel = selectedGame.freeSpinsRemaining
    ? `Play Free Spin (${selectedGame.freeSpinsRemaining})`
    : `Spin ${selectedGame.name}`;

  return (
    <div id="casino-root">
      <section className="app-summary-grid">
        <a className="app-stat app-stat--link" href="/app/rewards/">
          <div className="app-stat__value">{formatPoints(rewards.balance)}</div>
          <div className="app-stat__label">Balance</div>
        </a>
        <article className="app-stat">
          <div className="app-stat__value">{String(machineList.length)}</div>
          <div className="app-stat__label">Machines</div>
        </article>
        <article className="app-stat">
          <div className="app-stat__value">{String(selectedGame.freeSpinsRemaining || 0)}</div>
          <div className="app-stat__label">Free spins</div>
        </article>
        <a className="app-stat app-stat--link" href="/app/rewards/">
          <div className="app-stat__value">{rewards.dailyCap === null ? 'Unlimited' : formatPoints(rewards.dailyCap)}</div>
          <div className="app-stat__label">Daily limit</div>
        </a>
      </section>

      <section className="app-workspace">
        <section className="casino-shell">
          <article className="app-card casino-stage-shell">
            <div className="casino-stage-shell__top">
              <div>
                <p className="kicker">Casino</p>
                <h3>{selectedGame.name}</h3>
              </div>
              <div className="casino-stage-shell__chips">
                <span className="app-chip">{`${formatPoints(selectedGame.cost)} stake`}</span>
                <span className="app-chip">{`${selectedGame.paylinesCount} paylines`}</span>
                <span className="app-chip">{`${selectedGame.volatility} volatility`}</span>
              </div>
            </div>

            <div className="casino-stage-shell__playfield">
              <div className="casino-stage-shell__canvas" ref={stageRef} />
            </div>

            <div className="casino-stage-shell__info">
              <aside className="casino-stage-shell__panel">
                <div className="casino-console">
                  <div className="casino-console__eyebrow">Latest spin</div>
                  <div className="casino-console__headline">{latestResult?.outcome.label || selectedGame.name}</div>
                  <p className="casino-console__copy">
                    {latestResult?.outcome.detail || selectedGame.flavor || 'Pick a machine and spin.'}
                  </p>
                </div>
                <div className="casino-controls">
                  <button className="button casino-controls__spin" onClick={onSpin} disabled={spinning}>
                    {spinning ? 'Spinning...' : freeSpinLabel}
                  </button>
                  <div className="app-muted casino-controls__status">{statusMessage}</div>
                </div>
                <div className="casino-panel-grid">
                  <div className="casino-panel-stat">
                    <span className="app-muted">Jackpot</span>
                    <strong>{selectedGame.jackpotLabel || formatPoints(selectedGame.topPayout)}</strong>
                  </div>
                  <div className="casino-panel-stat">
                    <span className="app-muted">Return</span>
                    <strong>{`${Math.round(selectedGame.returnRate * 100)}%`}</strong>
                  </div>
                  <div className="casino-panel-stat">
                    <span className="app-muted">Hit rate</span>
                    <strong>{`${Math.round(selectedGame.hitRate * 100)}%`}</strong>
                  </div>
                  <div className="casino-panel-stat">
                    <span className="app-muted">Free spins</span>
                    <strong>{selectedGame.freeSpinsRemaining ? `${selectedGame.freeSpinsRemaining} banked` : 'Trigger with scatters'}</strong>
                  </div>
                </div>
              </aside>

              <section className="app-card casino-stage-shell__card">
                <div className="app-card__row">
                  <h3>Session</h3>
                  <span className="app-chip">{formatPoints(rewards.balance)}</span>
                </div>
                <div className="casino-player-grid">
                  <div className="casino-player-stat"><span className="app-muted">Balance</span><strong>{formatPoints(rewards.balance)}</strong></div>
                  <div className="casino-player-stat"><span className="app-muted">Machine</span><strong>{selectedGame.name}</strong></div>
                  <div className="casino-player-stat"><span className="app-muted">Wagered today</span><strong>{formatPoints(rewards.dailyWagered)}</strong></div>
                  <div className="casino-player-stat"><span className="app-muted">Last win</span><strong>{lastWin ? formatPoints(lastWin.payout) : 'Waiting'}</strong></div>
                </div>
                <div className="casino-meter">
                  <div className="casino-meter__track"><span className="casino-meter__fill" style={{ width: `${meterWidth}%` }} /></div>
                  <div className="app-muted">
                    {rewards.dailyCap === null
                      ? `${formatPoints(rewards.dailyWagered)} wagered today. No cap is active.`
                      : `${formatPoints(rewards.dailyRemaining || 0)} left before the daily cap.`}
                  </div>
                </div>
              </section>

              <section className="app-card casino-stage-shell__card">
                <div className="app-card__row">
                  <h3>Machines</h3>
                  <span className="app-chip">{`${machineList.length} live`}</span>
                </div>
                <div className="casino-machine-list">
                  {machineList.map((game) => (
                    <button
                      key={game.slug}
                      className={`casino-machine-button${game.slug === selectedGame.slug ? ' is-active' : ''}`}
                      onClick={() => onSelectGame(game.slug)}
                      type="button"
                    >
                      <div className="casino-machine-button__top">
                        <strong>{game.name}</strong>
                        <span>{formatPoints(game.cost)}</span>
                      </div>
                      <div className="casino-machine-button__meta">
                        <span>{`${game.volatility} volatility`}</span>
                        <span>{game.freeSpinsRemaining ? `${game.freeSpinsRemaining} free spins` : `${game.paylinesCount} lines`}</span>
                      </div>
                      <div className="casino-machine-button__symbols">
                        {uniqueSymbols(game.reelSymbols).slice(0, 6).map((symbol) => (
                          <span key={`${game.slug}-${symbol}`} className="slot-chip">{symbolMeta(symbol).emoji}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </article>

          <section className="casino-shell__bottom">
            <article className="app-card">
              <div className="app-card__row">
                <h3>Paytable</h3>
                <span className="app-chip">{`${uniqueSymbols(selectedGame.reelSymbols).length} symbols`}</span>
              </div>
              <div className="casino-paytable">
                {selectedGame.paytable.map((entry) => (
                  <div key={`${entry.label}-${entry.multiplier}-${entry.kind}`} className="casino-paytable__row">
                    <div className="casino-paytable__symbols">
                      {entry.symbols.map((symbol, index) => (
                        <span key={`${entry.label}-${symbol}-${index}`} className="slot-chip">{symbolMeta(symbol).emoji}</span>
                      ))}
                    </div>
                    <div className="casino-paytable__copy">
                      <strong>{entry.label}</strong>
                      <span className="app-muted">
                        {entry.kind === 'scatter'
                          ? `${entry.freeSpins || 0} free spins`
                          : `${entry.multiplier}x total bet`}
                      </span>
                    </div>
                    <div className="casino-paytable__value">{formatPoints(entry.payout)}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="app-card">
              <div className="app-card__row">
                <h3>History</h3>
                <span className="app-chip">{`${rewards.spins.length} logged`}</span>
              </div>
              {rewards.spins.length ? (
                <div className="casino-history">
                  {rewards.spins.slice(0, 8).map((spin, index) => (
                    <div key={`${spin.gameSlug}-${spin.wager}-${index}`} className="casino-history__row">
                      <div>
                        <strong>{spin.game}</strong>
                        <div className="app-muted">
                          {spin.symbols.map((symbol) => symbolMeta(symbol).emoji).join(' ')} {spin.outcome.label}
                        </div>
                      </div>
                      <div className="app-muted">{spin.usedFreeSpin ? 'Free spin' : formatPoints(spin.wager)}</div>
                      <div className={`casino-history__value${spin.payout > 0 ? ' is-win' : ''}`}>
                        {`${spin.net >= 0 ? '+' : ''}${formatPoints(spin.net)}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="app-empty">No spins yet.</div>
              )}
            </article>
          </section>
        </section>
      </section>
    </div>
  );
}

function formatPoints(value: number) {
  return `${Number(value || 0).toLocaleString()} pts`;
}
