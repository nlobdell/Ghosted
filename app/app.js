const state = {
  config: null,
  me: null,
  admin: {
    roleOptions: [],
  },
  ui: {
    pendingExternalLink: null,
  },
  casino: {
    selectedGameSlug: null,
    latestResult: null,
  },
};

const SLOT_SYMBOLS = {
  moon: { emoji: '🌙', label: 'Moon' },
  rune: { emoji: '✨', label: 'Rune' },
  coin: { emoji: '🪙', label: 'Coin' },
  ghost: { emoji: '👻', label: 'Ghost' },
  crown: { emoji: '👑', label: 'Crown' },
};

const REEL_ITEM_HEIGHT = 68;
const MIN_SPIN_MS = 1100;

document.addEventListener('DOMContentLoaded', () => {
  boot().catch((error) => {
    renderBanner(error.message || 'Something went wrong loading the app.', 'error');
  });
});

async function boot() {
  state.config = await getJSON('/api/config');
  state.me = await getJSON('/api/me');
  renderAuth();
  const page = document.querySelector('[data-page]')?.dataset.page;
  if (!page) return;
  const handlers = {
    dashboard: renderDashboard,
    community: renderCommunity,
    clan: renderClan,
    competitions: renderCompetitions,
    casino: renderCasino,
    rewards: renderRewards,
    giveaways: renderGiveaways,
    profile: renderProfile,
    admin: renderAdmin,
  };
  const handler = handlers[page];
  if (handler) {
    await handler();
  }
}

async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed for ${url}`);
  }
  return payload;
}

function renderAuth() {
  const authRoot = document.querySelector('[data-auth]');
  if (!authRoot) return;
  if (state.me.authenticated) {
    const user = state.me.user;
    const avatar = user.avatarUrl
      ? `<img class="app-user__avatar" src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" />`
      : `<div class="app-user__avatar">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</div>`;
    authRoot.innerHTML = `
      <div class="app-user">
        ${avatar}
        <div>
          <div><strong>${escapeHtml(user.displayName)}</strong></div>
          <div class="app-muted">Signed in</div>
        </div>
      </div>
      ${user.isAdmin ? '<a class="app-nav__link" href="/admin/">Admin</a>' : ''}
      <button class="button button--secondary" data-logout>Log Out</button>
    `;
    authRoot.querySelector('[data-logout]')?.addEventListener('click', logout);
    return;
  }

  const loginDisabled = !state.config.authConfigured && !state.config.devAuthEnabled;
  const href = state.config.authConfigured
    ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
    : state.config.devAuthEnabled
      ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
      : '#';
  authRoot.innerHTML = loginDisabled
    ? '<div class="app-muted">Discord auth needs env vars before sign-in goes live.</div>'
    : `<a class="button" href="${href}">Sign In With Discord</a>`;
}

async function logout() {
  await getJSON('/auth/logout', { method: 'POST' });
  window.location.reload();
}

async function renderDashboard() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.me.authenticated) {
    summaryRoot.innerHTML = '';
    renderSignInState(contentRoot, 'Sign in to see your balance, giveaways, Wise Old Man link, and recent spins.');
    return;
  }

  const requests = [getJSON('/api/rewards'), getJSON('/api/giveaways')];
  if (state.config.womConfigured) {
    requests.push(getJSON('/api/wom/clan'), getJSON('/api/wom/competitions?limit=6'));
  }
  const [rewards, giveaways, clan = null, competitions = null] = await Promise.all(requests);
  const activeGiveaways = giveaways.giveaways.filter((item) => item.status === 'active').length;
  const recentSpins = rewards.spins.length;
  const perks = state.me.user.perks || [];
  const womLink = state.me.user.womLink || { linked: false };
  const liveCompetitions = (competitions?.competitions || []).filter((item) => item.status === 'ongoing').length;
  summaryRoot.innerHTML = renderStats([
    { label: 'Balance', value: formatPoints(rewards.balance), href: '/app/rewards/' },
    { label: 'Active giveaways', value: String(activeGiveaways), href: '/app/giveaways/' },
    { label: 'Community live', value: String(clan?.group?.memberCount || 0), href: '/app/community/' },
    { label: 'WOM link', value: womLink.linked ? 'Linked' : 'Not linked', href: '/app/profile/' },
  ]);

  contentRoot.innerHTML = `
    <section class="app-dashboard-grid">
      <article class="app-panel">
        <div class="app-panel__header">
          <div>
            <p class="app-kicker">Next Actions</p>
            <h3>Start where you need to act</h3>
          </div>
          <span class="app-chip">${state.me.user.isAdmin ? 'Admin enabled' : 'Member tools'}</span>
        </div>
        <div class="app-route-list">
          <a class="app-route app-route--featured" href="/app/community/">
            <div>
              <strong>Community</strong>
              <p>See clan health, live competitions, and recent momentum in one place.</p>
            </div>
            <span class="app-route__meta">${clan?.group?.memberCount || 0} members</span>
          </a>
          <a class="app-route" href="/app/rewards/">
            <div>
              <strong>Rewards</strong>
              <p>Check balance, daily limits, and your full points ledger.</p>
            </div>
            <span class="app-route__meta">${formatPoints(rewards.balance)}</span>
          </a>
          <a class="app-route" href="/app/giveaways/">
            <div>
              <strong>Giveaways</strong>
              <p>See what is live and whether you can enter right now.</p>
            </div>
            <span class="app-route__meta">${activeGiveaways} active</span>
          </a>
          <a class="app-route" href="/app/casino/">
            <div>
              <strong>Casino</strong>
              <p>Use the points floor without leaving the member app.</p>
            </div>
            <span class="app-route__meta">${recentSpins} logged</span>
          </a>
          <a class="app-route" href="/app/profile/">
            <div>
              <strong>Profile</strong>
              <p>Manage your Discord identity, roles, and RSN/WOM link.</p>
            </div>
            <span class="app-route__meta">${womLink.linked ? 'Linked' : 'Needs setup'}</span>
          </a>
        </div>
      </article>
      <a class="app-panel app-panel--link" href="/app/profile/">
        <div class="app-panel__header">
          <div>
            <p class="app-kicker">Account Snapshot</p>
            <h3>Identity and access</h3>
          </div>
          <span class="app-chip">${womLink.linked ? 'WOM linked' : 'Discord only'}</span>
        </div>
        <div class="app-panel-list">
          <div>
            <span>Display name</span>
            <strong>${escapeHtml(state.me.user.displayName)}</strong>
          </div>
          <div>
            <span>Username</span>
            <strong>@${escapeHtml(state.me.user.username)}</strong>
          </div>
          <div>
            <span>RuneScape</span>
            <strong>${womLink.linked ? escapeHtml(womLink.displayName || womLink.username) : 'Link from profile'}</strong>
          </div>
          <div>
            <span>Access</span>
            <strong>${state.me.user.isAdmin ? 'Admin' : 'Member'}</strong>
          </div>
        </div>
        <div>
          <p class="app-muted">Perks</p>
          ${perks.length
            ? `<div class="app-tags">${perks.map((perk) => `<span class="app-tag">${escapeHtml(perk)}</span>`).join('')}</div>`
            : '<p class="app-panel-note">Perks show up here after roles sync.</p>'}
        </div>
      </a>
    </section>
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Community pulse</h3>
          <span class="app-chip">${clan?.linkCoverage?.linkedUsers || 0} linked</span>
        </div>
        ${clan ? renderClanPulse(clan) : '<div class="app-empty">Configure WOM_GROUP_ID to unlock the Ghosted community view.</div>'}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Competition watch</h3>
          <span class="app-chip">${liveCompetitions} live</span>
        </div>
        ${competitions ? renderCompetitionList((competitions.competitions || []).slice(0, 4), { compact: true }) : '<div class="app-empty">Competition data appears here once WOM is configured.</div>'}
      </article>
    </section>
    <section class="app-ledger-shell">
      <div class="app-section-heading">
        <div>
          <p class="app-kicker">Recent Activity</p>
          <h3>Latest entries</h3>
        </div>
        <a class="button button--secondary button--small" href="/app/rewards/">Open full ledger</a>
      </div>
      ${renderLedgerTable(rewards.entries.slice(0, 6))}
    </section>
  `;
}

async function renderCommunity() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStats([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Community page', value: 'Unavailable' },
      { label: 'Clan detail', value: 'Disabled' },
      { label: 'Competitions', value: 'Disabled' },
    ]);
    contentRoot.innerHTML = `
      <div class="app-empty">
        <p>Set \`WOM_GROUP_ID\` to unlock the Ghosted community overview.</p>
        <a class="button button--secondary" href="/app/profile/">Open Profile</a>
      </div>
    `;
    return;
  }

  const [clan, competitionsListing, hiscores, gains] = await Promise.all([
    getJSON('/api/wom/clan'),
    getJSON('/api/wom/competitions?limit=6'),
    getJSON('/api/wom/hiscores?metric=overall&limit=6'),
    getJSON('/api/wom/gains?metric=overall&period=week&limit=6'),
  ]);
  const competitions = competitionsListing.competitions || [];
  const liveCompetitions = competitions.filter((item) => item.status === 'ongoing').length;
  const upcomingCompetitions = competitions.filter((item) => item.status === 'upcoming').length;

  summaryRoot.innerHTML = renderStats([
    { label: 'Group members', value: String(clan.group.memberCount || 0), href: '/app/clan/' },
    { label: 'Linked users', value: String(clan.linkCoverage.linkedUsers || 0), href: '/app/profile/' },
    { label: 'Live competitions', value: String(liveCompetitions), href: '/app/competitions/' },
    { label: 'Upcoming', value: String(upcomingCompetitions), href: '/app/competitions/' },
  ]);

  contentRoot.innerHTML = `
    <section class="app-split-callout">
      <article class="app-highlight">
        <p class="app-kicker">Community overview</p>
        <h3>${escapeHtml(clan.group.name || 'Ghosted')}</h3>
        <p>${escapeHtml(clan.group.description || 'Track the current state of the Ghosted Wise Old Man group and jump deeper when you need full detail.')}</p>
      </article>
      <div class="app-inline-actions">
        <a class="button" href="/app/clan/">Open clan detail</a>
        <a class="button button--secondary" href="/app/competitions/">Open competitions</a>
      </div>
    </section>
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Clan pulse</h3>
          <span class="app-chip">${clan.linkCoverage.unlinkedUsers || 0} unlinked</span>
        </div>
        ${renderClanPulse(clan)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Competition watch</h3>
          <span class="app-chip">${liveCompetitions} live</span>
        </div>
        ${renderCompetitionList(competitions.slice(0, 4), { compact: true })}
      </article>
    </section>
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Overall leaders</h3>
          <span class="app-chip">Top ${hiscores.entries.length}</span>
        </div>
        ${renderLeaderboardTable(hiscores.entries, { valueLabel: 'Experience / rank', valueFormatter: formatHiscoreValue })}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Weekly gains</h3>
          <span class="app-chip">${escapeHtml((gains.period || 'week').toUpperCase())}</span>
        </div>
        ${renderLeaderboardTable(gains.entries, { valueLabel: 'Gained', valueFormatter: formatGainValue })}
      </article>
    </section>
  `;
}

async function renderCasinoLegacy() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  const gamesPayload = await getJSON('/api/casino/games');
  summaryRoot.innerHTML = renderStats([
    ['Machines', String(gamesPayload.games.length)],
    ['Daily wager cap', formatPoints(gamesPayload.dailyWagerCap)],
    ['Points only', 'No cash value'],
    ['Access', state.me.authenticated ? 'Signed in' : 'Sign in required'],
  ]);

  if (!state.me.authenticated) {
    renderSignInState(contentRoot, 'Sign in to spin and earn rewards with community points.');
    return;
  }

  contentRoot.innerHTML = `
    <div id="casino-result"></div>
    <section class="app-grid app-grid--two">
      ${gamesPayload.games.map((game) => `
        <article class="app-card">
          <div class="app-card__row">
            <h3>${escapeHtml(game.name)}</h3>
            <span class="app-chip">${formatPoints(game.cost)} / spin</span>
          </div>
          <p>${escapeHtml(game.flavor)}</p>
          <div class="app-inline">
            <span class="app-muted">Top payout</span>
            <strong>${formatPoints(game.topPayout)}</strong>
          </div>
          <div class="app-actions">
            <button class="button" data-spin="${escapeHtml(game.slug)}">Spin</button>
          </div>
        </article>
      `).join('')}
    </section>
  `;

  contentRoot.querySelectorAll('[data-spin]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const payload = await getJSON('/api/casino/spin', {
          method: 'POST',
          body: JSON.stringify({ gameSlug: button.dataset.spin }),
        });
        renderBanner(
          `${payload.result.symbols.join(' • ')} | Wager ${formatPointsFull(payload.result.wager)} | ` +
          `Payout ${formatPointsFull(payload.result.payout)} | Balance ${formatPointsFull(payload.result.balance)}`,
          'info',
          '#casino-result'
        );
        state.me = await getJSON('/api/me');
        renderAuth();
      } catch (error) {
        renderBanner(error.message, 'error', '#casino-result');
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function renderRewards() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.me.authenticated) {
    summaryRoot.innerHTML = '';
    renderSignInState(contentRoot, 'Sign in to see your balance and point history.');
    return;
  }

  const rewards = await getJSON('/api/rewards');
  summaryRoot.innerHTML = renderStats([
    { label: 'Balance', value: formatPoints(rewards.balance), href: '/app/rewards/' },
    { label: 'Daily remaining', value: formatPoints(rewards.dailyRemaining), href: '/app/rewards/' },
    { label: 'Recent spins', value: String(rewards.spins.length), href: '/app/casino/' },
    { label: 'Ledger entries', value: String(rewards.entries.length), href: '/app/rewards/' },
  ]);
  contentRoot.innerHTML = `
    <section class="app-split-callout">
      <article class="app-highlight">
        <p class="app-kicker">Rewards status</p>
        <h3>${formatPointsFull(rewards.balance)} available</h3>
        <p>${rewards.dailyCap === null ? 'No daily wager cap is active.' : `${formatPointsFull(rewards.dailyRemaining)} left before the daily wager cap resets.`}</p>
      </article>
      <div class="app-inline-actions">
        <a class="button button--secondary" href="/app/casino/">Open casino</a>
        <a class="button button--secondary" href="/app/giveaways/">Open giveaways</a>
      </div>
    </section>
    <section class="app-ledger-shell">
      <div class="app-section-heading">
        <div>
          <h3>Full ledger</h3>
          <p class="app-description">Casino, giveaways, grants, and deductions in one timeline.</p>
        </div>
      </div>
      ${renderLedgerTable(rewards.entries)}
    </section>
  `;
}

async function renderCasino() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  const gamesPayload = await getJSON('/api/casino/games');
  if (!state.me.authenticated) {
    summaryRoot.innerHTML = renderStats([
      ['Machines', String(gamesPayload.games.length)],
      ['Daily wager cap', formatPoints(gamesPayload.dailyWagerCap)],
      ['Points only', 'No cash value'],
      ['Access', 'Sign in required'],
    ]);
    renderSignInState(contentRoot, 'Sign in to play the Ghosted casino floor.');
    return;
  }

  const rewards = await getJSON('/api/rewards');
  const gamesBySlug = new Map(gamesPayload.games.map((game) => [game.slug, game]));
  const selectedSlug = gamesBySlug.has(state.casino.selectedGameSlug)
    ? state.casino.selectedGameSlug
    : gamesPayload.games[0]?.slug;
  const selectedGame = gamesBySlug.get(selectedSlug);
  const latestResult = state.casino.latestResult && state.casino.latestResult.gameSlug === selectedSlug
    ? state.casino.latestResult
    : null;
  state.casino.selectedGameSlug = selectedSlug;
  summaryRoot.innerHTML = renderStats([
    ['Machines', String(gamesPayload.games.length)],
    ['Balance', formatPoints(rewards.balance)],
    ['Free spins', String(selectedGame?.freeSpinsRemaining || 0)],
    ['Daily remaining', formatPoints(rewards.dailyRemaining)],
    ['Recent spins', String(rewards.spins.length)],
  ]);

  if (!selectedGame) {
    contentRoot.innerHTML = '<div class="app-empty">No casino machines are configured yet.</div>';
    return;
  }

  contentRoot.innerHTML = `
    <section class="casino-layout">
      <article class="app-card casino-main">
        <div class="app-card__row">
          <div>
            <p class="app-kicker">Casino Floor</p>
            <h3>${escapeHtml(selectedGame.name)}</h3>
            <p class="casino-stage__copy">${escapeHtml(selectedGame.flavor)}</p>
          </div>
          <div class="casino-machine-meta">
            <span class="app-chip">${formatPoints(selectedGame.cost)} per spin</span>
            <span class="app-chip">${escapeHtml(selectedGame.volatility)} volatility</span>
          </div>
        </div>
        <div class="casino-cabinet app-card casino-machine" data-machine="${escapeHtml(selectedGame.slug)}" style="--machine-accent: ${escapeHtml(selectedGame.accent || '#9d7cf2')}">
          <div class="casino-machine__display casino-machine__display--hero">
            <div class="casino-machine__glow" aria-hidden="true"></div>
            <div class="casino-machine__payline" aria-hidden="true"></div>
            <div class="casino-reels casino-reels--hero">
              ${renderReels(selectedGame)}
            </div>
          </div>
          <div class="casino-main__controls">
            <button class="button casino-machine__button" data-spin="${escapeHtml(selectedGame.slug)}">${selectedGame.freeSpinsRemaining ? `Play Free Spin (${selectedGame.freeSpinsRemaining})` : `Spin ${escapeHtml(selectedGame.name)}`}</button>
            <div class="casino-machine__status app-muted" data-machine-status>${latestResult ? escapeHtml(describeSpinResult(latestResult)) : 'Five reels, three rows, and live feature triggers.'}</div>
          </div>
          <div id="casino-result" class="casino-resultboard">
            ${renderCasinoResultBoard(latestResult, selectedGame)}
          </div>
        </div>
        <div class="casino-main__footer">
          <div>
            <div class="app-muted">Mood</div>
            <strong>${escapeHtml(selectedGame.mood || 'Live machine')}</strong>
          </div>
          <div>
            <div class="app-muted">Free spins</div>
            <strong>${selectedGame.freeSpinsRemaining ? `${selectedGame.freeSpinsRemaining} banked` : 'Trigger with 3 scatters'}</strong>
          </div>
          <div>
            <div class="app-muted">Paylines</div>
            <strong>${selectedGame.paylinesCount}</strong>
          </div>
          <div>
            <div class="app-muted">Top payout</div>
            <strong>${escapeHtml(selectedGame.jackpotLabel || formatPoints(selectedGame.topPayout))}</strong>
          </div>
        </div>
      </article>
      <aside class="casino-sidebar">
        <section class="app-card">
          <div class="app-card__row">
            <h3>Machines</h3>
            <span class="app-chip">${gamesPayload.games.length} live</span>
          </div>
          <div class="casino-machine-list">
            ${gamesPayload.games.map((game) => renderMachinePickerButton(game, game.slug === selectedSlug)).join('')}
          </div>
        </section>
        <section class="app-card">
          <h3>Player Board</h3>
          ${renderCasinoPlayerStats(rewards, selectedGame)}
        </section>
      </aside>
    </section>
    <section class="app-grid app-grid--two casino-bottom">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Paytable</h3>
          <span class="app-chip">${formatPercent(selectedGame.returnRate)} return</span>
        </div>
        ${renderPaytable(selectedGame)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Recent Spins</h3>
          <span class="app-chip">${rewards.spins.length} logged</span>
        </div>
        ${renderCasinoHistory(rewards.spins)}
      </article>
    </section>
  `;

  hydrateCasinoMachine(contentRoot, selectedGame, latestResult);

  contentRoot.querySelectorAll('[data-machine-select]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.casino.selectedGameSlug = button.dataset.machineSelect;
      await renderCasino();
    });
  });

  contentRoot.querySelectorAll('[data-spin]').forEach((button) => {
    button.addEventListener('click', async () => {
      const machine = button.closest('[data-machine]');
      const status = machine?.querySelector('[data-machine-status]');
      const resultRoot = contentRoot.querySelector('#casino-result');
      const startedAt = performance.now();
      button.disabled = true;
      machine?.classList.add('is-busy');
      if (status) {
        status.textContent = `${selectedGame.name} is spinning up...`;
      }
      try {
        const spinRequest = getJSON('/api/casino/spin', {
          method: 'POST',
          body: JSON.stringify({ gameSlug: selectedGame.slug }),
        });
        if (machine) {
          startMachineSpin(machine, selectedGame);
        }
        const payload = await spinRequest;
        await wait(Math.max(0, MIN_SPIN_MS - (performance.now() - startedAt)));
        if (machine) {
          await settleMachineSpin(machine, selectedGame, payload.result.grid || []);
        }
        state.casino.latestResult = payload.result;
        renderCasinoResultBoardInto(resultRoot, payload.result, selectedGame);
        if (status) {
          status.textContent = describeSpinResult(payload.result);
        }
        state.me = await getJSON('/api/me');
        renderAuth();
        await renderCasino();
      } catch (error) {
        if (machine) {
          resetMachine(machine, selectedGame.reelSymbols);
        }
        if (status) {
          status.textContent = error.message;
        }
        renderBanner(error.message, 'error', resultRoot);
      } finally {
        button.disabled = false;
        machine?.classList.remove('is-busy');
      }
    });
  });
}

async function renderGiveaways() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  const payload = await getJSON('/api/giveaways');
  const activeCount = payload.giveaways.filter((item) => item.status === 'active').length;
  const sortedGiveaways = [...payload.giveaways].sort((left, right) => {
    const leftRank = left.status === 'active' ? 0 : left.status === 'scheduled' ? 1 : 2;
    const rightRank = right.status === 'active' ? 0 : right.status === 'scheduled' ? 1 : 2;
    return leftRank - rightRank || String(left.endAt || '').localeCompare(String(right.endAt || ''));
  });
  summaryRoot.innerHTML = renderStats([
    { label: 'Active now', value: String(activeCount), href: '/app/giveaways/' },
    { label: 'Total giveaways', value: String(payload.giveaways.length), href: '/app/giveaways/' },
    { label: 'Entry type', value: 'Points + roles' },
    { label: 'Sign-in', value: state.me.authenticated ? 'Ready' : 'Browse only', href: '/app/profile/' },
  ]);

  contentRoot.innerHTML = `
    <div id="giveaway-result"></div>
    <section class="app-split-callout">
      <article class="app-highlight">
        <p class="app-kicker">Giveaway flow</p>
        <h3>Act on live drops first</h3>
        <p>Ghosted sorts active giveaways to the top so you can see what is open, what it costs, and whether your roles allow entry.</p>
      </article>
      <div class="app-inline-actions">
        <a class="button button--secondary" href="/app/rewards/">Check balance</a>
        <a class="button button--secondary" href="/app/profile/">Review roles</a>
      </div>
    </section>
    <section class="app-grid app-grid--two">
      ${sortedGiveaways.map((item) => `
        <article class="app-card">
          <div class="app-card__row">
            <h3>${escapeHtml(item.title)}</h3>
            <span class="app-chip">${escapeHtml(item.status)}</span>
          </div>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
          <div class="app-metric-grid">
            <div class="app-metric">
              <span>Cost</span>
              <strong>${formatPoints(item.pointCost)}</strong>
            </div>
            <div class="app-metric">
              <span>Entries</span>
              <strong>${item.userEntries} / ${item.maxEntries}</strong>
            </div>
            <div class="app-metric">
              <span>Closes</span>
              <strong>${formatDate(item.endAt)}</strong>
            </div>
            <div class="app-metric">
              <span>Access</span>
              <strong title="${item.requiredRole ? escapeHtml(item.requiredRole.id) : ''}">${item.requiredRole ? escapeHtml(item.requiredRole.label) : 'Linked members'}</strong>
            </div>
          </div>
          <div class="app-actions">
            <button class="button" data-enter="${item.id}" ${item.canEnter ? '' : 'disabled'}>Enter</button>
          </div>
        </article>
      `).join('')}
    </section>
  `;

  contentRoot.querySelectorAll('[data-enter]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await getJSON(`/api/giveaways/${button.dataset.enter}/enter`, { method: 'POST' });
        renderBanner(
          `Entry added. ${formatPointsFull(result.result.balance)} left with ${result.result.entriesRemaining} entries remaining.`,
          'info',
          '#giveaway-result'
        );
        state.me = await getJSON('/api/me');
        renderAuth();
        await renderGiveaways();
      } catch (error) {
        renderBanner(error.message, 'error', '#giveaway-result');
        button.disabled = false;
      }
    });
  });
}

async function renderClan() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStats([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Clan page', value: 'Unavailable' },
    ]);
    contentRoot.innerHTML = '<div class="app-empty">Set `WOM_GROUP_ID` to load the Ghosted clan overview.</div>';
    return;
  }

  const [clan, hiscores, gains] = await Promise.all([
    getJSON('/api/wom/clan'),
    getJSON('/api/wom/hiscores?metric=overall&limit=8'),
    getJSON('/api/wom/gains?metric=overall&period=week&limit=8'),
  ]);

  summaryRoot.innerHTML = renderStats([
    { label: 'Group members', value: String(clan.group.memberCount || 0) },
    { label: 'Ghosted links', value: String(clan.linkCoverage.linkedUsers || 0), href: '/app/profile/' },
    { label: 'Maxed totals', value: String(clan.statistics.maxedTotalCount || 0) },
    { label: 'Avg total level', value: formatMaybeNumber(clan.statistics.averageOverallLevel) },
  ]);

  contentRoot.innerHTML = `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>${escapeHtml(clan.group.name || 'Ghosted')}</h3>
          <span class="app-chip">${clan.group.verified ? 'Verified' : 'Tracked'}</span>
        </div>
        <p>${escapeHtml(clan.group.description || 'Wise Old Man group overview for Ghosted.')}</p>
        <div class="app-metric-grid">
          <div class="app-metric">
            <span>Clan chat</span>
            <strong>${escapeHtml(clan.group.clanChat || 'Not listed')}</strong>
          </div>
          <div class="app-metric">
            <span>Home world</span>
            <strong>${escapeHtml(clan.group.homeworld || 'Unknown')}</strong>
          </div>
          <div class="app-metric">
            <span>Average EHP</span>
            <strong>${formatMaybeNumber(clan.statistics.averageEhp)}</strong>
          </div>
          <div class="app-metric">
            <span>Average EHB</span>
            <strong>${formatMaybeNumber(clan.statistics.averageEhb)}</strong>
          </div>
        </div>
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Link coverage</h3>
          <span class="app-chip">${clan.linkCoverage.unlinkedUsers || 0} unlinked</span>
        </div>
        <div class="app-metric-grid">
          <div class="app-metric">
            <span>Tracked Discord users</span>
            <strong>${clan.linkCoverage.trackedUsers || 0}</strong>
          </div>
          <div class="app-metric">
            <span>Linked RSNs</span>
            <strong>${clan.linkCoverage.linkedUsers || 0}</strong>
          </div>
          <div class="app-metric">
            <span>Unlinked users</span>
            <strong>${clan.linkCoverage.unlinkedUsers || 0}</strong>
          </div>
          <div class="app-metric">
            <span>WOM members</span>
            <strong>${clan.linkCoverage.groupMemberCount || 0}</strong>
          </div>
        </div>
        ${state.me.authenticated && !state.me.user.womLink?.linked ? '<p class="app-panel-note">Link your RSN from the profile page so Ghosted can match your Discord identity to WOM data.</p>' : ''}
      </article>
    </section>
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Overall hiscores</h3>
          <span class="app-chip">Top ${hiscores.entries.length}</span>
        </div>
        ${renderLeaderboardTable(hiscores.entries, { valueLabel: 'Experience / rank', valueFormatter: formatHiscoreValue })}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Weekly gains</h3>
          <span class="app-chip">${escapeHtml((gains.period || 'week').toUpperCase())}</span>
        </div>
        ${renderLeaderboardTable(gains.entries, { valueLabel: 'Gained', valueFormatter: formatGainValue })}
      </article>
    </section>
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Recent achievements</h3>
          <span class="app-chip">${clan.recentAchievements.length}</span>
        </div>
        ${renderAchievementFeed(clan.recentAchievements)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Recent activity</h3>
          <span class="app-chip">${clan.recentActivity.length}</span>
        </div>
        ${renderActivityFeed(clan.recentActivity)}
      </article>
    </section>
  `;
}

async function renderCompetitions() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStats([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Competitions', value: 'Unavailable' },
    ]);
    contentRoot.innerHTML = '<div class="app-empty">Set `WOM_GROUP_ID` to load Ghosted competition standings.</div>';
    return;
  }

  const listing = await getJSON('/api/wom/competitions?limit=12');
  const competitions = listing.competitions || [];
  const selected = competitions[0] ? await getJSON(`/api/wom/competitions/${competitions[0].id}`) : null;
  const ongoing = competitions.filter((item) => item.status === 'ongoing').length;
  const upcoming = competitions.filter((item) => item.status === 'upcoming').length;

  summaryRoot.innerHTML = renderStats([
    { label: 'Tracked comps', value: String(competitions.length) },
    { label: 'Ongoing', value: String(ongoing) },
    { label: 'Upcoming', value: String(upcoming) },
    { label: 'Finished', value: String(competitions.filter((item) => item.status === 'finished').length) },
  ]);

  contentRoot.innerHTML = `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Competition board</h3>
          <span class="app-chip">${ongoing} live</span>
        </div>
        ${renderCompetitionList(competitions)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>${escapeHtml(selected?.competition?.title || 'No competition selected')}</h3>
          <span class="app-chip">${escapeHtml(selected?.competition?.status || 'none')}</span>
        </div>
        ${selected ? renderCompetitionDetail(selected) : '<div class="app-empty">No group competitions are available yet.</div>'}
      </article>
    </section>
  `;
}

async function renderProfile() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.me.authenticated) {
    summaryRoot.innerHTML = '';
    renderSignInState(contentRoot, 'Sign in to see your Discord profile, synced roles, and RuneScape link.');
    return;
  }
  const user = state.me.user;
  const roles = user.roles || [];
  const roleDetails = user.roleDetails || roles.map((roleId) => ({ id: roleId, label: roleId, source: 'id' }));
  const perks = user.perks || [];
  const womLink = user.womLink || { linked: false };
  let womProfile = null;
  if (state.config.womConfigured && womLink.linked) {
    try {
      womProfile = await getJSON('/api/wom/me');
    } catch (error) {
      renderBanner(error.message, 'warning');
    }
  }
  const avatar = user.avatarUrl
    ? `<div class="app-avatar"><img src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" /></div>`
    : `<div class="app-avatar">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</div>`;
  summaryRoot.innerHTML = renderStats([
    { label: 'Balance', value: formatPoints(user.balance), href: '/app/rewards/' },
    { label: 'WOM link', value: womLink.linked ? 'Linked' : 'Not linked' },
    { label: 'Roles synced', value: String(roleDetails.length) },
    { label: 'Access', value: user.isAdmin ? 'Admin' : 'Member', href: user.isAdmin ? '/admin/' : '/app/' },
  ]);
  contentRoot.innerHTML = `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-identity">
          ${avatar}
          <div>
            <h3>${escapeHtml(user.displayName)}</h3>
            <p class="app-muted">@${escapeHtml(user.username)}</p>
          </div>
        </div>
        <div class="app-metric-grid">
          <div class="app-metric">
            <span>Discord ID</span>
            <strong>${escapeHtml(user.discordId || 'Not synced')}</strong>
          </div>
          <div class="app-metric">
            <span>Roles synced</span>
            <strong>${roleDetails.length}</strong>
          </div>
          <div class="app-metric">
            <span>Wise Old Man</span>
            <strong>${womLink.linked ? escapeHtml(womLink.displayName || womLink.username) : 'Not linked'}</strong>
          </div>
          <div class="app-metric">
            <span>Access</span>
            <strong>${user.isAdmin ? 'Admin' : 'Member'}</strong>
          </div>
        </div>
        ${renderWomLinkPanel(womLink)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Roles and perks</h3>
          <span class="app-chip">${roles.length} synced</span>
        </div>
        <div>
          <p class="app-muted">Perks</p>
          <div class="app-tags">
            ${perks.length ? perks.map((perk) => `<span class="app-tag">${escapeHtml(perk)}</span>`).join('') : '<span class="app-tag">No synced perks</span>'}
          </div>
        </div>
        <div>
          <p class="app-muted">Roles</p>
          <div class="app-tags">
            ${roleDetails.length ? roleDetails.map((role) => `<span class="app-tag" title="Role ID: ${escapeHtml(role.id)}">${escapeHtml(role.label)}</span>`).join('') : '<span class="app-tag">No synced roles</span>'}
          </div>
        </div>
      </article>
    </section>
    ${renderProfileWomDetails(womProfile, womLink)}
  `;
  bindWomLinkForm();
  bindWomUnlink();
}

async function renderAdmin() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  try {
    const [payload, rolePayload] = await Promise.all([
      getJSON('/api/admin/overview'),
      getJSON('/api/admin/discord-roles'),
    ]);
    state.admin.roleOptions = rolePayload.roles || [];
    const activeGiveaways = payload.overview.giveaways.filter((item) => item.status === 'active').length;
    const adminCount = payload.overview.users.filter((user) => user.isAdmin).length;
    summaryRoot.innerHTML = renderStats([
      ['Tracked users', String(payload.overview.users.length)],
      ['Live giveaways', String(activeGiveaways)],
      ['WOM links', String(payload.overview.wom?.linkedUsers || 0)],
      ['Admin users', String(adminCount)],
    ]);
    contentRoot.innerHTML = `
      <div id="admin-result"></div>
      <section class="app-split-callout">
        <article class="app-highlight">
          <p class="app-kicker">Operator view</p>
          <h3>Quick actions first</h3>
          <p>Use the top actions to grant rewards, launch giveaways, and refresh community data before you drop into tables and audits.</p>
        </article>
        <div class="app-inline-actions">
          <span class="app-chip">Actor: ${escapeHtml(payload.actor.displayName)}</span>
          <span class="app-chip">${payload.overview.wom?.configured ? 'WOM live' : 'WOM offline'}</span>
        </div>
      </section>
      <section class="app-grid app-grid--two">
        <form class="app-form" id="grant-form">
          <h3>Grant or deduct points</h3>
          <p>Use an internal user id or Discord id to write a ledger entry.</p>
          <div class="app-form-grid">
            <div><label for="grant-user-id">User ID</label><input id="grant-user-id" name="userId" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="1" /></div>
            <div><label for="grant-discord-id">Discord ID</label><input id="grant-discord-id" name="discordId" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Optional alternate lookup" /></div>
            <div><label for="grant-amount">Amount</label><input id="grant-amount" name="amount" type="number" inputmode="numeric" autocomplete="off" value="100" /></div>
            <div><label for="grant-description">Description</label><input id="grant-description" name="description" type="text" autocomplete="off" value="Clan reward grant" /></div>
          </div>
          <div class="app-actions"><button class="button" type="submit">Write ledger entry</button></div>
        </form>
        <form class="app-form" id="giveaway-form">
          <h3>Create giveaway</h3>
          <div class="app-form-grid">
            <div><label for="giveaway-title">Title</label><input id="giveaway-title" name="title" type="text" autocomplete="off" value="Weekly Ghosted Drop" /></div>
            <div><label for="giveaway-cost">Point cost</label><input id="giveaway-cost" name="pointCost" type="number" inputmode="numeric" autocomplete="off" value="25" /></div>
            <div><label for="giveaway-start">Start</label><input id="giveaway-start" name="startAt" type="datetime-local" autocomplete="off" /></div>
            <div><label for="giveaway-end">End</label><input id="giveaway-end" name="endAt" type="datetime-local" autocomplete="off" /></div>
            <div><label for="giveaway-max">Max entries</label><input id="giveaway-max" name="maxEntries" type="number" inputmode="numeric" autocomplete="off" value="3" /></div>
            <div>
              <label for="giveaway-role">Required Discord role</label>
              <select id="giveaway-role" name="requiredRoleId" aria-describedby="giveaway-role-note" ${state.admin.roleOptions.length ? '' : 'disabled'}>
                ${renderRoleOptions(state.admin.roleOptions)}
              </select>
              <p class="app-field-note" id="giveaway-role-note">${escapeHtml(renderRoleHelperText(rolePayload))}</p>
            </div>
          </div>
          <label for="giveaway-description">Description</label>
          <textarea id="giveaway-description" name="description" autocomplete="off">Launch-ready clan giveaway.</textarea>
          <div class="app-actions"><button class="button" type="submit">Create giveaway</button></div>
        </form>
      </section>
      <section class="app-grid app-grid--two">
        <form class="app-form" id="wom-refresh-form">
          <h3>Refresh Wise Old Man cache</h3>
          <p>Force Ghosted to drop cached WOM data and re-fetch the latest clan, player, or competition payloads.</p>
          <div class="app-form-grid">
            <div>
              <label for="wom-refresh-scope">Scope</label>
              <select id="wom-refresh-scope" name="scope">
                <option value="all">All clan caches</option>
                <option value="group">Clan only</option>
                <option value="player">One player</option>
                <option value="competition">One competition</option>
              </select>
            </div>
            <div><label for="wom-refresh-username">Username</label><input id="wom-refresh-username" name="username" type="text" autocomplete="off" placeholder="Needed for player refresh" /></div>
            <div><label for="wom-refresh-competition-id">Competition ID</label><input id="wom-refresh-competition-id" name="competitionId" type="number" inputmode="numeric" autocomplete="off" placeholder="Needed for competition refresh" /></div>
            <div class="app-metric">
              <span>Current status</span>
              <strong>${payload.overview.wom?.configured ? 'Configured' : 'Not configured'}</strong>
            </div>
          </div>
          <div class="app-actions"><button class="button" type="submit">Refresh WOM data</button></div>
        </form>
        <article class="app-card">
          <div class="app-card__row">
            <h3>Wise Old Man status</h3>
            <span class="app-chip">${payload.overview.wom?.configured ? 'Live' : 'Offline'}</span>
          </div>
          <div class="app-metric-grid">
            <div class="app-metric">
              <span>Linked users</span>
              <strong>${payload.overview.wom?.linkedUsers || 0}</strong>
            </div>
            <div class="app-metric">
              <span>Group config</span>
              <strong>${payload.overview.wom?.configured ? 'Ready' : 'Missing WOM_GROUP_ID'}</strong>
            </div>
          </div>
          <p class="app-panel-note">V1 is intentionally read-only for the Ghosted WOM group. Use this refresh tool to clear cache drift without editing group membership or competitions from Ghosted.</p>
        </article>
      </section>
      <section class="app-grid app-grid--two">
        <article class="app-card">
          <h3>Users</h3>
          <div class="app-table"><table><thead><tr><th>ID</th><th>User</th><th>Balance</th></tr></thead><tbody>
            ${payload.overview.users.map((user) => `<tr><td>${user.id}</td><td>${escapeHtml(user.displayName)}</td><td>${formatPoints(user.balance)}</td></tr>`).join('')}
          </tbody></table></div>
        </article>
        <article class="app-card">
          <h3>Giveaway draws</h3>
          <div class="app-actions">
            ${payload.overview.giveaways.map((item) => `<button class="button button--secondary" data-draw="${item.id}" ${item.status === 'scheduled' || item.status === 'completed' ? 'disabled' : ''}>Draw ${escapeHtml(item.title)}</button>`).join('') || '<span class="app-muted">No giveaways yet.</span>'}
          </div>
        </article>
      </section>
    `;
    bindAdminForms();
  } catch (error) {
    renderBanner(error.message, 'error');
    renderSignInState(contentRoot, 'Only admins can view this panel.');
  }
}

function bindAdminForms() {
  document.querySelector('#grant-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await getJSON('/api/admin/rewards/grant', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData.entries())) });
      renderBanner('Ledger entry written.', 'info', '#admin-result');
      await renderAdmin();
    } catch (error) {
      renderBanner(error.message, 'error', '#admin-result');
    }
  });

  document.querySelector('#giveaway-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    formData.pointCost = Number(formData.pointCost || 0);
    formData.maxEntries = Number(formData.maxEntries || 1);
    formData.startAt = toIsoLocal(formData.startAt);
    formData.endAt = toIsoLocal(formData.endAt);
    try {
      await getJSON('/api/admin/giveaways', { method: 'POST', body: JSON.stringify(formData) });
      renderBanner('Giveaway created.', 'info', '#admin-result');
      await renderAdmin();
    } catch (error) {
      renderBanner(error.message, 'error', '#admin-result');
    }
  });

  document.querySelectorAll('[data-draw]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await getJSON(`/api/admin/giveaways/${button.dataset.draw}/draw`, { method: 'POST' });
        renderBanner('Winner selected.', 'info', '#admin-result');
        await renderAdmin();
      } catch (error) {
        renderBanner(error.message, 'error', '#admin-result');
      }
    });
  });

  document.querySelector('#wom-refresh-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!formData.username) delete formData.username;
    if (!formData.competitionId) {
      delete formData.competitionId;
    } else {
      formData.competitionId = Number(formData.competitionId);
    }
    try {
      const result = await getJSON('/api/admin/wom/refresh', { method: 'POST', body: JSON.stringify(formData) });
      renderBanner(`Refreshed WOM cache. Cleared ${result.result.deleted || 0} cached item(s).`, 'info', '#admin-result');
      await renderAdmin();
    } catch (error) {
      renderBanner(error.message, 'error', '#admin-result');
    }
  });
}

function renderRoleOptions(roleOptions) {
  return [
    '<option value="">No role requirement</option>',
    ...roleOptions.map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.label)}</option>`),
  ].join('');
}

function renderRoleHelperText(rolePayload) {
  const roleCount = Number(rolePayload.roles?.length || 0);
  const aliasCount = Number(rolePayload.aliasCount || 0);
  if (roleCount) {
    if (rolePayload.guildSyncConfigured && aliasCount) {
      return `Discord guild roles are loaded with ${aliasCount} manual label override${aliasCount === 1 ? '' : 's'}.`;
    }
    if (rolePayload.guildSyncConfigured) {
      return 'Discord guild role names are available for giveaway targeting.';
    }
    return 'Role labels are coming from DISCORD_ROLE_LABELS_JSON overrides.';
  }
  if (rolePayload.guildSyncConfigured) {
    return 'No Discord role names were available. Check bot access or add DISCORD_ROLE_LABELS_JSON overrides.';
  }
  return 'Set DISCORD_GUILD_ID + DISCORD_BOT_TOKEN or DISCORD_ROLE_LABELS_JSON to enable role selection.';
}

function renderWomLinkPanel(womLink) {
  if (!state.config.womConfigured) {
    return '<div class="app-empty">Wise Old Man is not configured on this Ghosted instance yet.</div>';
  }
  if (womLink.linked) {
    return `
      <div class="app-card app-card--subtle">
        <div class="app-card__row">
          <h3>Wise Old Man link</h3>
          <span class="app-chip">Linked</span>
        </div>
        <p>Ghosted is linked to <strong>${escapeHtml(womLink.displayName || womLink.username)}</strong> in the configured clan group.</p>
        <div class="app-actions">
          <button class="button button--secondary" type="button" data-wom-unlink>Remove local link</button>
        </div>
      </div>
    `;
  }
  return `
    <form class="app-form" id="wom-link-form">
      <h3>Link RuneScape account</h3>
      <p>Enter the RSN that belongs to you in the Ghosted Wise Old Man group. Ghosted will track/update it and link it to your Discord account.</p>
      <div class="app-form-grid">
        <div>
          <label for="wom-username">RuneScape username</label>
          <input id="wom-username" name="username" type="text" autocomplete="off" spellcheck="false" placeholder="Your RSN" />
        </div>
      </div>
      <div class="app-actions">
        <button class="button" type="submit">Link account</button>
      </div>
    </form>
  `;
}

function renderProfileWomDetails(womProfile, womLink) {
  if (!state.config.womConfigured) return '';
  if (!womLink.linked || !womProfile) {
    return `
      <section class="app-grid app-grid--two">
        <article class="app-card">
          <div class="app-card__row">
            <h3>OSRS sync</h3>
            <span class="app-chip">${womLink.linked ? 'Loading' : 'Not linked'}</span>
          </div>
          <p>${womLink.linked ? 'Ghosted will show your weekly gains, achievements, and live competition entries here once the WOM profile loads.' : 'Link your account above to unlock Ghosted-to-WOM profile syncing.'}</p>
        </article>
      </section>
    `;
  }
  return `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Weekly gains</h3>
          <span class="app-chip">${escapeHtml(womProfile.player.displayName || womProfile.player.username)}</span>
        </div>
        <div class="app-metric-grid">
          <div class="app-metric">
            <span>Total XP</span>
            <strong>${formatMaybeNumber(womProfile.player.exp)}</strong>
          </div>
          <div class="app-metric">
            <span>EHP</span>
            <strong>${formatMaybeNumber(womProfile.player.ehp)}</strong>
          </div>
          <div class="app-metric">
            <span>EHB</span>
            <strong>${formatMaybeNumber(womProfile.player.ehb)}</strong>
          </div>
          <div class="app-metric">
            <span>Last import</span>
            <strong>${womProfile.player.lastImportedAt ? formatDate(womProfile.player.lastImportedAt) : 'Pending'}</strong>
          </div>
        </div>
        <pre class="app-codeblock">${escapeHtml(JSON.stringify(womProfile.gains, null, 2))}</pre>
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Achievements and competitions</h3>
          <span class="app-chip">${womProfile.competitions.length} ongoing</span>
        </div>
        ${renderAchievementFeed(womProfile.achievements.slice(0, 6))}
        ${renderCompetitionList(womProfile.competitions.slice(0, 4), { compact: true })}
      </article>
    </section>
  `;
}

function bindWomLinkForm() {
  document.querySelector('#wom-link-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await getJSON('/api/profile/wom-link', { method: 'POST', body: JSON.stringify(formData) });
      renderBanner('Wise Old Man account linked.', 'info');
      state.me = await getJSON('/api/me');
      renderAuth();
      await renderProfile();
    } catch (error) {
      renderBanner(error.message, 'error');
    }
  });
}

function bindWomUnlink() {
  document.querySelector('[data-wom-unlink]')?.addEventListener('click', async () => {
    try {
      await getJSON('/api/profile/wom-link', { method: 'DELETE' });
      renderBanner('Removed the local Wise Old Man link.', 'info');
      state.me = await getJSON('/api/me');
      renderAuth();
      await renderProfile();
    } catch (error) {
      renderBanner(error.message, 'error');
    }
  });
}

function renderClanPulse(clan) {
  return `
    <div class="app-metric-grid">
      <div class="app-metric">
        <span>Members</span>
        <strong>${clan.group.memberCount || 0}</strong>
      </div>
      <div class="app-metric">
        <span>Maxed total</span>
        <strong>${clan.statistics.maxedTotalCount || 0}</strong>
      </div>
      <div class="app-metric">
        <span>Average total</span>
        <strong>${formatMaybeNumber(clan.statistics.averageOverallLevel)}</strong>
      </div>
      <div class="app-metric">
        <span>Weekly leaders</span>
        <strong>${clan.featuredGains.entries.length || 0}</strong>
      </div>
    </div>
  `;
}

function renderLeaderboardTable(entries, { valueLabel = 'Value', valueFormatter = String } = {}) {
  if (!entries.length) {
    return '<div class="app-empty">No entries available yet.</div>';
  }
  return `
    <section class="app-table">
      <table>
        <thead><tr><th>Rank</th><th>Player</th><th>${escapeHtml(valueLabel)}</th></tr></thead>
        <tbody>
          ${entries.map((entry) => `
            <tr>
              <td>${entry.rank || '-'}</td>
              <td>${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')}</td>
              <td>${escapeHtml(valueFormatter(entry))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderAchievementFeed(entries) {
  if (!entries.length) {
    return '<div class="app-empty">No recent achievements yet.</div>';
  }
  return `
    <div class="app-feed">
      ${entries.map((entry) => `
        <article class="app-feed__item">
          <strong>${escapeHtml(entry.name || 'Achievement')}</strong>
          <div class="app-muted">${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')} • ${entry.createdAt ? formatDate(entry.createdAt) : 'Recently'}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderActivityFeed(entries) {
  if (!entries.length) {
    return '<div class="app-empty">No recent activity yet.</div>';
  }
  return `
    <div class="app-feed">
      ${entries.map((entry) => `
        <article class="app-feed__item">
          <strong>${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')}</strong>
          <div class="app-muted">${escapeHtml(entry.type || 'activity')} • ${entry.createdAt ? formatDate(entry.createdAt) : 'Recently'}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCompetitionList(entries, { compact = false } = {}) {
  if (!entries.length) {
    return '<div class="app-empty">No competitions are attached to the Ghosted WOM group yet.</div>';
  }
  return `
    <div class="app-feed">
      ${entries.map((entry) => `
        <article class="app-feed__item ${compact ? 'is-compact' : ''}">
          <div class="app-card__row">
            <strong>${escapeHtml(entry.title || 'Competition')}</strong>
            <span class="app-chip">${escapeHtml(entry.status || 'unknown')}</span>
          </div>
          <div class="app-muted">${escapeHtml(entry.metric || 'overall')} • ${formatCompetitionWindow(entry)}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCompetitionDetail(payload) {
  const competition = payload.competition;
  return `
    <div class="app-metric-grid">
      <div class="app-metric">
        <span>Metric</span>
        <strong>${escapeHtml(competition.metric || 'overall')}</strong>
      </div>
      <div class="app-metric">
        <span>Status</span>
        <strong>${escapeHtml(competition.status || 'unknown')}</strong>
      </div>
      <div class="app-metric">
        <span>Starts</span>
        <strong>${competition.startsAt ? formatDate(competition.startsAt) : 'TBD'}</strong>
      </div>
      <div class="app-metric">
        <span>Ends</span>
        <strong>${competition.endsAt ? formatDate(competition.endsAt) : 'TBD'}</strong>
      </div>
    </div>
    ${renderLeaderboardTable(competition.participants || [], { valueLabel: 'Progress', valueFormatter: formatCompetitionProgress })}
    <div class="app-card__row">
      <h3>Top history</h3>
      <span class="app-chip">${payload.topHistory.length}</span>
    </div>
    <div class="app-feed">
      ${payload.topHistory.map((entry) => `
        <article class="app-feed__item">
          <strong>${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')}</strong>
          <div class="app-muted">${entry.history.length} datapoint${entry.history.length === 1 ? '' : 's'}</div>
        </article>
      `).join('') || '<div class="app-empty">No history has been recorded yet.</div>'}
    </div>
  `;
}

function formatMaybeNumber(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: numeric % 1 === 0 ? 0 : 2 });
}

function formatHiscoreValue(entry) {
  const data = entry.raw || {};
  const raw = data.experience ?? data.kills ?? data.score ?? data.value ?? entry.value ?? 0;
  const rank = data.rank ? `Rank ${data.rank}` : 'Unranked';
  return `${formatMaybeNumber(raw)} • ${rank}`;
}

function formatGainValue(entry) {
  return `${formatMaybeNumber(entry.gained || 0)} gained`;
}

function formatCompetitionProgress(entry) {
  const gained = entry.progress?.gained ?? entry.raw?.gained ?? 0;
  const start = entry.progress?.start;
  const end = entry.progress?.end;
  if (start !== undefined && end !== undefined) {
    return `${formatMaybeNumber(gained)} gained (${formatMaybeNumber(start)} → ${formatMaybeNumber(end)})`;
  }
  return `${formatMaybeNumber(gained)} gained`;
}

function formatCompetitionWindow(entry) {
  const starts = entry.startsAt ? formatDate(entry.startsAt) : 'TBD';
  const ends = entry.endsAt ? formatDate(entry.endsAt) : 'TBD';
  return `${starts} → ${ends}`;
}

function renderStats(items) {
  return items.map((item) => {
    const normalized = Array.isArray(item)
      ? { label: item[0], value: item[1], href: null }
      : { href: null, ...item };
    const tag = normalized.href ? 'a' : 'article';
    const href = normalized.href ? ` href="${normalized.href}"` : '';
    const className = normalized.href ? 'app-stat app-stat--link' : 'app-stat';
    return `
      <${tag} class="${className}"${href}>
        <div class="app-stat__value">${normalized.value}</div>
        <div class="app-stat__label">${escapeHtml(normalized.label)}</div>
      </${tag}>
    `;
  }).join('');
}

function renderLedgerTable(entries) {
  if (!entries.length) {
    return '<div class="app-empty">No activity yet.</div>';
  }
  return `
    <section class="app-table">
      <table>
        <thead><tr><th>When</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          ${entries.map((entry) => `
            <tr>
              <td>${formatDate(entry.createdAt)}</td>
              <td>${escapeHtml(entry.entryType)}</td>
              <td>${escapeHtml(entry.description)}</td>
              <td>${entry.amount > 0 ? '+' : ''}${formatPoints(entry.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderBanner(message, variant = 'info', target = '[data-banner]') {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return;
  root.innerHTML = `<div class="app-banner ${variant === 'error' ? 'is-error' : variant === 'warning' ? 'is-warning' : ''}" role="${variant === 'error' ? 'alert' : 'status'}">${escapeHtml(message)}</div>`;
  window.GhostedSite?.announce?.(message);
}

function renderTwitchLeaveDialog() {
  return `
    <dialog class="app-dialog" data-twitch-confirm>
      <form method="dialog" class="app-dialog__body">
        <div>
          <p class="app-kicker">Leave Ghosted</p>
          <h3>Open Twitch?</h3>
          <p class="app-description">You’re about to leave Ghosted and open the live vghosted Twitch channel in a new tab.</p>
        </div>
        <div class="app-dialog__actions">
          <button class="button button--secondary" type="button" data-twitch-cancel>Stay here</button>
          <button class="button" type="button" data-twitch-confirm-open>Open Twitch</button>
        </div>
      </form>
    </dialog>
  `;
}

function handleTwitchLeaveLinkClick(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const link = event.target.closest('a[href]');
  if (!link || !shouldConfirmTwitchLink(link)) return;
  event.preventDefault();
  openTwitchLeaveDialog(link);
}

function shouldConfirmTwitchLink(link) {
  try {
    const url = new URL(link.href, window.location.origin);
    return url.origin === 'https://www.twitch.tv' && url.pathname.replace(/\/+$/, '') === '/vghosted';
  } catch {
    return false;
  }
}

function openTwitchLeaveDialog(link) {
  const dialog = document.querySelector('[data-twitch-confirm]');
  if (!dialog) return;
  state.ui.pendingExternalLink = {
    href: link.href,
    target: link.getAttribute('target') || '',
  };
  if (dialog.hasAttribute('open')) {
    return;
  }
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    return;
  }
  dialog.setAttribute('open', 'open');
}

function closeTwitchLeaveDialog() {
  const dialog = document.querySelector('[data-twitch-confirm]');
  if (!dialog) return;
  state.ui.pendingExternalLink = null;
  if (typeof dialog.close === 'function') {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
}

function confirmTwitchLeave() {
  const pending = state.ui.pendingExternalLink;
  if (!pending?.href) return closeTwitchLeaveDialog();
  closeTwitchLeaveDialog();
  if (pending.target === '_blank') {
    window.open(pending.href, '_blank', 'noopener,noreferrer');
    return;
  }
  window.location.assign(pending.href);
}

function renderSignInState(root, message) {
  const loginHref = state.config.authConfigured
    ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
    : state.config.devAuthEnabled
      ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
      : '';
  root.innerHTML = `
    <div class="app-empty">
      <p>${escapeHtml(message)}</p>
      ${loginHref ? `<a class="button" href="${loginHref}">Sign In With Discord</a>` : '<p class="app-muted">Configure Discord auth env vars to enable sign-in.</p>'}
    </div>
  `;
}

function formatPoints(value) {
  return `${Number(value).toLocaleString()} pts`;
}

function formatPointsFull(value) {
  return `${Number(value).toLocaleString()} points`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function toIsoLocal(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function renderReels(symbols) {
  const safeSymbols = normalizeReelSymbols(symbols);
  return [0, 1, 2].map((index) => {
    const symbol = safeSymbols[index % safeSymbols.length];
    return `
      <div class="casino-reel" data-reel="${index}">
        <div class="casino-reel__track">${renderReelItem(symbol)}</div>
      </div>
    `;
  }).join('');
}

function renderSymbolLegend(symbols) {
  return uniqueSymbols(symbols).map((symbol) => {
    const meta = getSlotSymbol(symbol);
    return `
      <span class="casino-symbol">
        <span class="casino-symbol__emoji" aria-hidden="true">${meta.emoji}</span>
        <span>${escapeHtml(meta.label)}</span>
      </span>
    `;
  }).join('');
}

function renderReelItem(symbol) {
  const meta = getSlotSymbol(symbol);
  return `
    <div class="casino-reel__item" data-symbol="${escapeHtml(symbol)}">
      <span class="casino-reel__emoji" aria-hidden="true">${meta.emoji}</span>
      <span class="casino-reel__name">${escapeHtml(meta.label)}</span>
    </div>
  `;
}

function hydrateCasinoMachines(root, games) {
  games.forEach((game) => {
    const machine = root.querySelector(`[data-machine="${cssEscape(game.slug)}"]`);
    if (machine) {
      resetMachine(machine, game.reelSymbols);
    }
  });
}

function startMachineSpin(machine, game) {
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    const safeSymbols = normalizeReelSymbols(game.reelSymbols);
    const orderedSymbols = rotateSymbols(safeSymbols, index);
    const strip = repeatSymbols(orderedSymbols, 5);
    const track = reel.querySelector('.casino-reel__track');
    reel.classList.add('is-spinning');
    reel.classList.remove('is-settling');
    track.innerHTML = strip.map(renderReelItem).join('');
    track.style.transition = 'none';
    track.style.transform = 'translateY(0)';
    track.style.setProperty('--loop-distance', `${orderedSymbols.length * REEL_ITEM_HEIGHT}px`);
    track.getBoundingClientRect();
    track.style.animation = `casinoReelLoop ${240 + (index * 45)}ms linear infinite`;
  });
}

async function settleMachineSpin(machine, game, finalSymbols) {
  const reels = [...machine.querySelectorAll('[data-reel]')];
  await Promise.all(reels.map((reel, index) => settleReel(reel, game.reelSymbols, finalSymbols[index], index)));
}

async function settleReel(reel, symbols, finalSymbol, index) {
  const safeSymbols = normalizeReelSymbols(symbols);
  const track = reel.querySelector('.casino-reel__track');
  const strip = [...repeatSymbols(rotateSymbols(safeSymbols, index + 1), 5), finalSymbol || safeSymbols[0]];
  reel.classList.remove('is-spinning');
  reel.classList.add('is-settling');
  track.style.animation = 'none';
  track.innerHTML = strip.map(renderReelItem).join('');
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.getBoundingClientRect();
  await wait(20);
  track.style.transition = `transform ${960 + (index * 260)}ms cubic-bezier(0.12, 0.8, 0.2, 1)`;
  track.style.transform = `translateY(-${(strip.length - 1) * REEL_ITEM_HEIGHT}px)`;
  await wait(980 + (index * 260));
  setReelFace(reel, finalSymbol || safeSymbols[0]);
}

function resetMachine(machine, symbols) {
  const safeSymbols = normalizeReelSymbols(symbols);
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    setReelFace(reel, safeSymbols[index % safeSymbols.length]);
  });
}

function setReelFace(reel, symbol) {
  const track = reel.querySelector('.casino-reel__track');
  reel.classList.remove('is-spinning', 'is-settling');
  track.style.animation = 'none';
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.innerHTML = renderReelItem(symbol);
}

function renderCasinoResult(root, result) {
  if (!root) return;
  const symbols = result.symbols.map((symbol) => getSlotSymbol(symbol).emoji).join(' ');
  const tone = result.payout > 0 ? 'info' : 'warning';
  const message = result.payout > 0
    ? `${symbols} Line hit. Won ${formatPointsFull(result.payout)} and moved to ${formatPointsFull(result.balance)}.`
    : `${symbols} No payout this time. Wager ${formatPointsFull(result.wager)}, balance ${formatPointsFull(result.balance)}.`;
  renderBanner(message, tone, root);
}

function describeSpinResult(result) {
  if (result.payout > 0) {
    return `Paid ${formatPointsFull(result.payout)} on ${result.symbols.map((symbol) => getSlotSymbol(symbol).label).join(', ')}.`;
  }
  return `No line hit. Net ${formatPointsFull(result.net)} on that pull.`;
}

function normalizeReelSymbols(symbols) {
  const filtered = (symbols || []).filter(Boolean);
  return filtered.length ? filtered : ['coin', 'moon', 'ghost'];
}

function uniqueSymbols(symbols) {
  return [...new Set(normalizeReelSymbols(symbols))];
}

function rotateSymbols(symbols, offset = 0) {
  const safeSymbols = normalizeReelSymbols(symbols);
  const normalizedOffset = ((offset % safeSymbols.length) + safeSymbols.length) % safeSymbols.length;
  return safeSymbols.slice(normalizedOffset).concat(safeSymbols.slice(0, normalizedOffset));
}

function repeatSymbols(symbols, repeats) {
  return Array.from({ length: repeats }, () => symbols).flat();
}

function getSlotSymbol(symbol) {
  return SLOT_SYMBOLS[symbol] || {
    emoji: '❔',
    label: String(symbol || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/"/g, '\\"');
}

function renderMachinePickerButton(game, isSelected) {
  return `
    <button class="casino-picker ${isSelected ? 'is-selected' : ''}" data-machine-select="${escapeHtml(game.slug)}" type="button">
      <div class="casino-picker__top">
        <strong>${escapeHtml(game.name)}</strong>
        <span>${formatPoints(game.cost)}</span>
      </div>
      <div class="casino-picker__meta">
        <span>${escapeHtml(game.volatility || 'Medium')}</span>
        <span>${formatPercent(game.hitRate)}</span>
      </div>
      <div class="casino-picker__legend">${renderSymbolLegend(game.reelSymbols)}</div>
    </button>
  `;
}

function renderCasinoPlayerStats(rewards) {
  return `
    <div class="casino-player-grid">
      <div class="casino-player-stat">
        <span class="app-muted">Balance</span>
        <strong>${formatPoints(rewards.balance)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Wagered today</span>
        <strong>${formatPoints(rewards.dailyWagered)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Remaining</span>
        <strong>${formatPoints(rewards.dailyRemaining)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Hit board</span>
        <strong>${rewards.spins.filter((spin) => spin.payout > 0).length} wins</strong>
      </div>
    </div>
    <div class="casino-meter">
      <div class="casino-meter__bar">
        <span class="casino-meter__fill" style="width: ${Math.min(100, Math.max(0, (rewards.dailyWagered / Math.max(1, rewards.dailyCap)) * 100))}%"></span>
      </div>
      <div class="app-muted">Daily cap: ${formatPoints(rewards.dailyCap)}</div>
    </div>
  `;
}

function renderPaytable(game) {
  if (!game?.paytable?.length) {
    return '<div class="app-empty">No paytable configured.</div>';
  }

  return `
    <div class="casino-paytable">
      ${game.paytable.map((entry) => `
        <div class="casino-paytable__row">
          <div class="casino-paytable__symbols">${entry.symbols.map(renderPaylineSymbol).join('')}</div>
          <div class="casino-paytable__copy">
            <strong>${escapeHtml(entry.label)}</strong>
            <span class="app-muted">${entry.multiplier}x wager</span>
          </div>
          <div class="casino-paytable__payout">${formatPoints(entry.payout)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPaylineSymbol(symbol) {
  if (symbol === 'any') {
    return '<span class="casino-payline-symbol is-any">Any</span>';
  }
  const meta = getSlotSymbol(symbol);
  return `<span class="casino-payline-symbol" title="${escapeHtml(meta.label)}">${meta.emoji}</span>`;
}

function renderCasinoHistory(spins) {
  if (!spins.length) {
    return '<div class="app-empty">Spin the cabinet and your run history shows up here.</div>';
  }

  return `
    <div class="casino-history">
      ${spins.slice(0, 8).map((spin) => `
        <div class="casino-history__row">
          <div>
            <strong>${escapeHtml(spin.game)}</strong>
            <div class="app-muted">${spin.symbols.map((symbol) => getSlotSymbol(symbol).emoji).join(' ')} ${escapeHtml(spin.outcome?.label || 'Spin')}</div>
          </div>
          <div class="casino-history__value ${spin.payout > 0 ? 'is-win' : ''}">
            ${spin.net >= 0 ? '+' : ''}${formatPoints(spin.net)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderReels(symbols) {
  const safeSymbols = normalizeReelSymbols(symbols);
  return [0, 1, 2].map((index) => {
    const symbol = safeSymbols[index % safeSymbols.length];
    return `
      <div class="casino-reel" data-reel="${index}">
        <div class="casino-reel__track">${renderReelItem(symbol)}</div>
      </div>
    `;
  }).join('');
}

function renderSymbolLegend(symbols) {
  return uniqueSymbols(symbols).map((symbol) => {
    const meta = getSlotSymbol(symbol);
    return `
      <span class="casino-symbol">
        <span class="casino-symbol__emoji" aria-hidden="true">${meta.emoji}</span>
        <span>${escapeHtml(meta.label)}</span>
      </span>
    `;
  }).join('');
}

function renderReelItem(symbol) {
  const meta = getSlotSymbol(symbol);
  return `
    <div class="casino-reel__item" data-symbol="${escapeHtml(symbol)}">
      <span class="casino-reel__emoji" aria-hidden="true">${meta.emoji}</span>
      <span class="casino-reel__name">${escapeHtml(meta.label)}</span>
    </div>
  `;
}

function hydrateCasinoMachine(root, game, latestResult) {
  const machine = root.querySelector(`[data-machine="${cssEscape(game.slug)}"]`);
  if (!machine) return;
  if (latestResult?.symbols?.length) {
    resetMachine(machine, latestResult.symbols);
    return;
  }
  resetMachine(machine, game.reelSymbols);
}

function startMachineSpin(machine, game) {
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    const safeSymbols = normalizeReelSymbols(game.reelSymbols);
    const orderedSymbols = rotateSymbols(safeSymbols, index);
    const strip = repeatSymbols(orderedSymbols, 5);
    const track = reel.querySelector('.casino-reel__track');
    reel.classList.add('is-spinning');
    reel.classList.remove('is-settling');
    track.innerHTML = strip.map(renderReelItem).join('');
    track.style.transition = 'none';
    track.style.transform = 'translateY(0)';
    track.style.setProperty('--loop-distance', `${orderedSymbols.length * REEL_ITEM_HEIGHT}px`);
    track.getBoundingClientRect();
    track.style.animation = `casinoReelLoop ${240 + (index * 45)}ms linear infinite`;
  });
}

async function settleMachineSpin(machine, game, finalSymbols) {
  const reels = [...machine.querySelectorAll('[data-reel]')];
  await Promise.all(reels.map((reel, index) => settleReel(reel, game.reelSymbols, finalSymbols[index], index)));
}

async function settleReel(reel, symbols, finalSymbol, index) {
  const safeSymbols = normalizeReelSymbols(symbols);
  const track = reel.querySelector('.casino-reel__track');
  const strip = [...repeatSymbols(rotateSymbols(safeSymbols, index + 1), 5), finalSymbol || safeSymbols[0]];
  reel.classList.remove('is-spinning');
  reel.classList.add('is-settling');
  track.style.animation = 'none';
  track.innerHTML = strip.map(renderReelItem).join('');
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.getBoundingClientRect();
  await wait(20);
  track.style.transition = `transform ${960 + (index * 260)}ms cubic-bezier(0.12, 0.8, 0.2, 1)`;
  track.style.transform = `translateY(-${(strip.length - 1) * REEL_ITEM_HEIGHT}px)`;
  await wait(980 + (index * 260));
  setReelFace(reel, finalSymbol || safeSymbols[0]);
}

function resetMachine(machine, symbols) {
  const safeSymbols = normalizeReelSymbols(symbols);
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    setReelFace(reel, safeSymbols[index % safeSymbols.length]);
  });
}

function setReelFace(reel, symbol) {
  const track = reel.querySelector('.casino-reel__track');
  reel.classList.remove('is-spinning', 'is-settling');
  track.style.animation = 'none';
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.innerHTML = renderReelItem(symbol);
}

function renderCasinoResultBoard(latestResult, game) {
  if (!latestResult) {
    return `
      <div class="casino-resultboard__label">Floor feed</div>
      <div class="casino-resultboard__headline">${escapeHtml(game.name)} is ready.</div>
      <div class="casino-resultboard__text">Pick your moment and send the reels.</div>
    `;
  }

  const outcome = latestResult.outcome || {};
  return `
    <div class="casino-resultboard__label">${escapeHtml(outcome.label || 'Result')}</div>
    <div class="casino-resultboard__headline">${escapeHtml(outcome.headline || `${game.name} resolved.`)}</div>
    <div class="casino-resultboard__text">${escapeHtml(outcome.detail || describeSpinResult(latestResult))}</div>
    <div class="casino-resultboard__symbols">${latestResult.symbols.map((symbol) => renderPaylineSymbol(symbol)).join('')}</div>
  `;
}

function renderCasinoResultBoardInto(root, latestResult, game) {
  if (!root) return;
  root.innerHTML = renderCasinoResultBoard(latestResult, game);
}

function describeSpinResult(result) {
  if (result.outcome?.detail) {
    return result.outcome.detail;
  }
  if (result.payout > 0) {
    return `Paid ${formatPointsFull(result.payout)} on ${result.symbols.map((symbol) => getSlotSymbol(symbol).label).join(', ')}.`;
  }
  return `No line hit. Net ${formatPointsFull(result.net)} on that pull.`;
}

function normalizeReelSymbols(symbols) {
  const filtered = (symbols || []).filter(Boolean);
  return filtered.length ? filtered : ['coin', 'moon', 'ghost'];
}

function uniqueSymbols(symbols) {
  return [...new Set(normalizeReelSymbols(symbols))];
}

function rotateSymbols(symbols, offset = 0) {
  const safeSymbols = normalizeReelSymbols(symbols);
  const normalizedOffset = ((offset % safeSymbols.length) + safeSymbols.length) % safeSymbols.length;
  return safeSymbols.slice(normalizedOffset).concat(safeSymbols.slice(0, normalizedOffset));
}

function repeatSymbols(symbols, repeats) {
  return Array.from({ length: repeats }, () => symbols).flat();
}

function getSlotSymbol(symbol) {
  const slotSymbols = {
    moon: { emoji: '\u{1F319}', label: 'Moon' },
    rune: { emoji: '\u2728', label: 'Rune' },
    coin: { emoji: '\u{1FA99}', label: 'Coin' },
    ghost: { emoji: '\u{1F47B}', label: 'Ghost' },
    crown: { emoji: '\u{1F451}', label: 'Crown' },
  };
  return slotSymbols[symbol] || {
    emoji: '\u2754',
    label: String(symbol || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
  };
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function renderMachinePickerButton(game, isSelected) {
  return `
    <button class="casino-picker ${isSelected ? 'is-selected' : ''}" data-machine-select="${escapeHtml(game.slug)}" type="button">
      <div class="casino-picker__top">
        <strong>${escapeHtml(game.name)}</strong>
        <span>${formatPoints(game.cost)}</span>
      </div>
      <div class="casino-picker__meta">
        <span>${escapeHtml(game.volatility || 'Medium')} volatility</span>
        <span>${game.freeSpinsRemaining ? `${game.freeSpinsRemaining} free` : `${game.paylinesCount} lines`}</span>
      </div>
      <div class="casino-picker__legend">${renderSymbolLegend(game.reelSymbols)}</div>
    </button>
  `;
}

function renderCasinoPlayerStats(rewards, game) {
  const latestWin = rewards.spins.find((spin) => spin.payout > 0);
  return `
    <div class="casino-player-grid">
      <div class="casino-player-stat">
        <span class="app-muted">Balance</span>
        <strong>${formatPoints(rewards.balance)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Selected machine</span>
        <strong>${escapeHtml(game.name)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Wagered today</span>
        <strong>${formatPoints(rewards.dailyWagered)}</strong>
      </div>
      <div class="casino-player-stat">
        <span class="app-muted">Latest win</span>
        <strong>${latestWin ? formatPoints(latestWin.payout) : 'None yet'}</strong>
      </div>
    </div>
    <div class="casino-meter">
      <div class="casino-meter__bar">
        <span class="casino-meter__fill" style="width: ${Math.min(100, Math.max(0, (rewards.dailyWagered / Math.max(1, rewards.dailyCap)) * 100))}%"></span>
      </div>
      <div class="app-muted">${formatPointsFull(rewards.dailyRemaining)} left before the daily cap closes the floor.</div>
    </div>
  `;
}

function renderPaytable(game) {
  if (!game?.paytable?.length) {
    return '<div class="app-empty">No paytable configured.</div>';
  }

  return `
    <div class="casino-paytable">
      ${game.paytable.map((entry) => `
        <div class="casino-paytable__row">
          <div class="casino-paytable__symbols">${entry.symbols.map(renderPaylineSymbol).join('')}</div>
          <div class="casino-paytable__copy">
            <strong>${escapeHtml(entry.label)}</strong>
            <span class="app-muted">${entry.kind === 'scatter' ? `${entry.freeSpins || 0} free spins` : `${entry.multiplier}x total bet`}</span>
          </div>
          <div class="casino-paytable__payout">${formatPoints(entry.payout)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPaylineSymbol(symbol) {
  if (symbol === 'any') {
    return '<span class="casino-payline-symbol is-any">Any</span>';
  }
  const meta = getSlotSymbol(symbol);
  return `<span class="casino-payline-symbol" title="${escapeHtml(meta.label)}">${meta.emoji}</span>`;
}

function renderCasinoHistory(spins) {
  if (!spins.length) {
    return '<div class="app-empty">Spin the cabinet and your run history shows up here.</div>';
  }

  return `
    <div class="casino-history">
      ${spins.slice(0, 8).map((spin) => `
        <div class="casino-history__row">
          <div>
            <strong>${escapeHtml(spin.game)}</strong>
            <div class="app-muted">${spin.symbols.map((symbol) => getSlotSymbol(symbol).emoji).join(' ')} ${escapeHtml(spin.outcome?.label || 'Spin')}</div>
          </div>
          <div class="casino-history__copy app-muted">${spin.usedFreeSpin ? 'Free spin' : formatPoints(spin.wager)}</div>
          <div class="casino-history__value ${spin.payout > 0 ? 'is-win' : ''}">
            ${spin.net >= 0 ? '+' : ''}${formatPoints(spin.net)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderReels(game) {
  const reelCount = Number(game?.reelCount || 5);
  const rows = Number(game?.rows || 3);
  const grid = buildIdleGrid(game);
  return Array.from({ length: reelCount }, (_, index) => `
    <div class="casino-reel" data-reel="${index}" style="--visible-rows:${rows}">
      <div class="casino-reel__track">${renderReelColumn(grid[index] || [])}</div>
    </div>
  `).join('');
}

function renderReelColumn(symbols) {
  return normalizeReelSymbols(symbols).map(renderReelItem).join('');
}

function renderSymbolLegend(symbols) {
  return uniqueSymbols(symbols).map((symbol) => {
    const meta = getSlotSymbol(symbol);
    return `
      <span class="casino-symbol">
        <span class="casino-symbol__emoji" aria-hidden="true">${meta.emoji}</span>
        <span>${escapeHtml(meta.label)}</span>
      </span>
    `;
  }).join('');
}

function renderReelItem(symbol) {
  const meta = getSlotSymbol(symbol);
  return `
    <div class="casino-reel__item" data-symbol="${escapeHtml(symbol)}">
      <span class="casino-reel__emoji" aria-hidden="true">${meta.emoji}</span>
      <span class="casino-reel__name">${escapeHtml(meta.label)}</span>
    </div>
  `;
}

function buildIdleGrid(game) {
  const pool = normalizeReelSymbols(game?.reelSymbols || []);
  const reelCount = Number(game?.reelCount || 5);
  const rows = Number(game?.rows || 3);
  return Array.from({ length: reelCount }, (_, reelIndex) =>
    Array.from({ length: rows }, (_, rowIndex) => pool[(reelIndex + rowIndex) % pool.length] || 'coin')
  );
}

function hydrateCasinoMachine(root, game, latestResult) {
  const machine = root.querySelector(`[data-machine="${cssEscape(game.slug)}"]`);
  if (!machine) return;
  if (latestResult?.grid?.length) {
    resetMachine(machine, latestResult.grid, game.rows);
    return;
  }
  resetMachine(machine, buildIdleGrid(game), game.rows);
}

function startMachineSpin(machine, game) {
  const rows = Number(game?.rows || 3);
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    const pool = normalizeReelSymbols(game.reelSymbols);
    const orderedSymbols = rotateSymbols(pool, index);
    const strip = repeatSymbols(orderedSymbols, 8);
    const track = reel.querySelector('.casino-reel__track');
    reel.classList.add('is-spinning');
    reel.classList.remove('is-settling');
    reel.style.setProperty('--visible-rows', String(rows));
    track.innerHTML = renderReelColumn(strip);
    track.style.transition = 'none';
    track.style.transform = 'translateY(0)';
    track.style.setProperty('--loop-distance', `${orderedSymbols.length * REEL_ITEM_HEIGHT}px`);
    track.getBoundingClientRect();
    track.style.animation = `casinoReelLoop ${220 + (index * 35)}ms linear infinite`;
  });
}

async function settleMachineSpin(machine, game, finalGrid) {
  const reels = [...machine.querySelectorAll('[data-reel]')];
  const rows = Number(game?.rows || 3);
  const grid = Array.isArray(finalGrid) && finalGrid.length ? finalGrid : buildIdleGrid(game);
  await Promise.all(reels.map((reel, index) => settleReel(reel, game.reelSymbols, grid[index] || [], index, rows)));
}

async function settleReel(reel, symbolPool, finalReel, index, rows) {
  const pool = normalizeReelSymbols(symbolPool);
  const track = reel.querySelector('.casino-reel__track');
  const target = normalizeReelSymbols(finalReel).slice(0, rows);
  while (target.length < rows) {
    target.push(pool[target.length % pool.length] || 'coin');
  }
  const strip = [...repeatSymbols(rotateSymbols(pool, index + 1), 6), ...target];
  reel.classList.remove('is-spinning');
  reel.classList.add('is-settling');
  reel.style.setProperty('--visible-rows', String(rows));
  track.style.animation = 'none';
  track.innerHTML = renderReelColumn(strip);
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.getBoundingClientRect();
  await wait(20);
  track.style.transition = `transform ${900 + (index * 180)}ms cubic-bezier(0.12, 0.8, 0.2, 1)`;
  track.style.transform = `translateY(-${(strip.length - rows) * REEL_ITEM_HEIGHT}px)`;
  await wait(920 + (index * 180));
  setReelFace(reel, target, rows);
}

function resetMachine(machine, grid, rows = 3) {
  machine.querySelectorAll('[data-reel]').forEach((reel, index) => {
    setReelFace(reel, Array.isArray(grid[index]) ? grid[index] : [grid[index]], rows);
  });
}

function setReelFace(reel, reelSymbols, rows = 3) {
  const track = reel.querySelector('.casino-reel__track');
  const normalized = normalizeReelSymbols(reelSymbols).slice(0, rows);
  while (normalized.length < rows) {
    normalized.push(normalized[normalized.length - 1] || 'coin');
  }
  reel.classList.remove('is-spinning', 'is-settling');
  reel.style.setProperty('--visible-rows', String(rows));
  track.style.animation = 'none';
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
  track.innerHTML = renderReelColumn(normalized);
}

function renderCasinoResultBoard(latestResult, game) {
  if (!latestResult) {
    return `
      <div class="casino-resultboard__label">Floor feed</div>
      <div class="casino-resultboard__headline">${escapeHtml(game.name)} is ready.</div>
      <div class="casino-resultboard__text">Match symbols on the paylines. Three scatters open a free-spin round.</div>
    `;
  }

  const outcome = latestResult.outcome || {};
  const lineSummary = latestResult.lineWins?.length
    ? `<div class="casino-resultboard__text">Paid lines: ${latestResult.lineWins.map((win) => `L${win.lineIndex + 1} ${getSlotSymbol(win.symbol).label} x${win.count}`).join(' | ')}</div>`
    : '';
  const featureSummary = latestResult.freeSpinsAwarded
    ? `<div class="casino-resultboard__text">Feature trigger: +${latestResult.freeSpinsAwarded} free spins. ${latestResult.freeSpinsRemaining} total banked.</div>`
    : latestResult.usedFreeSpin
      ? `<div class="casino-resultboard__text">Free spin consumed. ${latestResult.freeSpinsRemaining} remaining.</div>`
      : '';
  return `
    <div class="casino-resultboard__label">${escapeHtml(outcome.label || 'Result')}</div>
    <div class="casino-resultboard__headline">${escapeHtml(outcome.headline || `${game.name} resolved.`)}</div>
    <div class="casino-resultboard__text">${escapeHtml(outcome.detail || describeSpinResult(latestResult))}</div>
    ${lineSummary}
    ${featureSummary}
    <div class="casino-resultboard__symbols">${latestResult.symbols.map((symbol) => renderPaylineSymbol(symbol)).join('')}</div>
  `;
}

function renderCasinoResultBoardInto(root, latestResult, game) {
  if (!root) return;
  root.innerHTML = renderCasinoResultBoard(latestResult, game);
}

function describeSpinResult(result) {
  if (result.freeSpinsAwarded) {
    return `${result.freeSpinsAwarded} free spins awarded with ${result.scatter?.count || 0} scatters.`;
  }
  if (result.outcome?.detail) {
    return result.outcome.detail;
  }
  if (result.payout > 0) {
    return `Paid ${formatPointsFull(result.payout)} across ${result.lineWins?.length || 1} winning lines.`;
  }
  return result.usedFreeSpin
    ? `Free spin used. ${result.freeSpinsRemaining || 0} remaining.`
    : `No line hit. Net ${formatPointsFull(result.net)} on that pull.`;
}

function normalizeReelSymbols(symbols) {
  const values = Array.isArray(symbols) ? symbols : [symbols];
  const filtered = values.filter(Boolean);
  return filtered.length ? filtered : ['coin', 'moon', 'ghost'];
}

function uniqueSymbols(symbols) {
  return [...new Set(normalizeReelSymbols(symbols))];
}

function rotateSymbols(symbols, offset = 0) {
  const pool = normalizeReelSymbols(symbols);
  const normalizedOffset = ((offset % pool.length) + pool.length) % pool.length;
  return pool.slice(normalizedOffset).concat(pool.slice(0, normalizedOffset));
}

function repeatSymbols(symbols, repeats) {
  return Array.from({ length: repeats }, () => symbols).flat();
}

function getSlotSymbol(symbol) {
  const slotSymbols = {
    moon: { emoji: '\u{1F319}', label: 'Moon' },
    rune: { emoji: '\u2728', label: 'Rune' },
    coin: { emoji: '\u{1FA99}', label: 'Coin' },
    ghost: { emoji: '\u{1F47B}', label: 'Ghost' },
    crown: { emoji: '\u{1F451}', label: 'Crown' },
    mask: { emoji: '\u{1F3AD}', label: 'Mask' },
    gem: { emoji: '\u{1F48E}', label: 'Gem' },
    lantern: { emoji: '\u{1F3EE}', label: 'Lantern' },
    wild: { emoji: '\u{1F0CF}', label: 'Wild' },
    scatter: { emoji: '\u{1F52E}', label: 'Scatter' },
  };
  return slotSymbols[symbol] || {
    emoji: '\u2754',
    label: String(symbol || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
  };
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return `${(number * 100).toFixed(number < 0.1 ? 1 : 0)}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
