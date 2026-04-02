const state = {
  config: null,
  me: null,
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

const REEL_ITEM_HEIGHT = 88;
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
          <div class="app-muted">${formatPoints(user.balance)} points</div>
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
    renderSignInState(contentRoot, 'Sign in to view your points, giveaways, and spins in one place.');
    return;
  }

  const [rewards, giveaways] = await Promise.all([getJSON('/api/rewards'), getJSON('/api/giveaways')]);
  const activeGiveaways = giveaways.giveaways.filter((item) => item.status === 'active').length;
  const recentSpins = rewards.spins.length;
  summaryRoot.innerHTML = renderStats([
    ['Balance', formatPoints(rewards.balance)],
    ['Active giveaways', String(activeGiveaways)],
    ['Recent spins', String(recentSpins)],
    ['Recent entries', String(state.me.user.giveawayEntries)],
  ]);

  contentRoot.innerHTML = `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <h3>Quick launch</h3>
        <p>Jump into the parts of the app that actually move each week.</p>
        <div class="app-actions">
          <a class="button" href="/app/casino/">Open Casino</a>
          <a class="button button--secondary" href="/app/giveaways/">See Giveaways</a>
          <a class="button button--secondary" href="/app/rewards/">View Ledger</a>
        </div>
      </article>
      <article class="app-card">
        <h3>Role perks</h3>
        <p>${state.me.user.perks.length ? escapeHtml(state.me.user.perks.join(' • ')) : 'No synced perks yet. Link Discord roles and this panel will populate.'}</p>
        <ul class="app-list--tight">
          <li>Discord login creates your app account and wallet.</li>
          <li>Roles can gate giveaways and unlock reward perks.</li>
          <li>Admins get a separate surface for grants and winner draws.</li>
        </ul>
      </article>
    </section>
    ${renderLedgerTable(rewards.entries.slice(0, 8))}
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
          `${payload.result.symbols.join(' • ')} | Wager ${formatPoints(payload.result.wager)} | ` +
          `Payout ${formatPoints(payload.result.payout)} | Balance ${formatPoints(payload.result.balance)}`,
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
    renderSignInState(contentRoot, 'Sign in to see your balance, transaction history, and recent spins.');
    return;
  }

  const rewards = await getJSON('/api/rewards');
  summaryRoot.innerHTML = renderStats([
    ['Balance', formatPoints(rewards.balance)],
    ['Ledger entries', String(rewards.entries.length)],
    ['Recent spins', String(rewards.spins.length)],
    ['Auth', 'Discord-linked'],
  ]);
  contentRoot.innerHTML = renderLedgerTable(rewards.entries);
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
    ['Daily remaining', formatPoints(rewards.dailyRemaining)],
    ['Recent spins', String(rewards.spins.length)],
    ['Selected', escapeHtml(selectedGame?.name || 'None')],
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
              ${renderReels(selectedGame.reelSymbols)}
            </div>
          </div>
          <div class="casino-main__controls">
            <button class="button casino-machine__button" data-spin="${escapeHtml(selectedGame.slug)}">Spin ${escapeHtml(selectedGame.name)}</button>
            <div class="casino-machine__status app-muted" data-machine-status>${latestResult ? escapeHtml(describeSpinResult(latestResult)) : 'Pull the lever to start the round.'}</div>
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
            <div class="app-muted">Jackpot</div>
            <strong>${escapeHtml(selectedGame.jackpotLabel || formatPoints(selectedGame.topPayout))}</strong>
          </div>
          <div>
            <div class="app-muted">Hit rate</div>
            <strong>${formatPercent(selectedGame.hitRate)}</strong>
          </div>
          <div>
            <div class="app-muted">Top payout</div>
            <strong>${formatPoints(selectedGame.topPayout)}</strong>
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
          ${renderCasinoPlayerStats(rewards)}
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
          await settleMachineSpin(machine, selectedGame, payload.result.symbols);
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
  summaryRoot.innerHTML = renderStats([
    ['Total giveaways', String(payload.giveaways.length)],
    ['Active now', String(activeCount)],
    ['Entry type', 'Points + roles'],
    ['Sign-in', state.me.authenticated ? 'Ready' : 'Optional to browse'],
  ]);

  contentRoot.innerHTML = `
    <div id="giveaway-result"></div>
    <section class="app-grid app-grid--two">
      ${payload.giveaways.map((item) => `
        <article class="app-card">
          <div class="app-card__row">
            <h3>${escapeHtml(item.title)}</h3>
            <span class="app-chip">${escapeHtml(item.status)}</span>
          </div>
          <p>${escapeHtml(item.description)}</p>
          <ul class="app-list--tight">
            <li>Cost: ${formatPoints(item.pointCost)}</li>
            <li>Entries used: ${item.userEntries} / ${item.maxEntries}</li>
            <li>Closes: ${formatDate(item.endAt)}</li>
            <li>${item.requiredRoleId ? `Role gated: ${escapeHtml(item.requiredRoleId)}` : 'Open to linked members'}</li>
          </ul>
          <div class="app-actions">
            <button class="button" data-enter="${item.id}" ${item.canEnter ? '' : 'disabled'}>Enter giveaway</button>
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
          `Entry submitted. ${formatPoints(result.result.balance)} remaining with ${result.result.entriesRemaining} entries left.`,
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

async function renderProfile() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  if (!state.me.authenticated) {
    renderSignInState(contentRoot, 'Sign in to see your linked Discord identity, perks, and stats.');
    return;
  }
  const user = state.me.user;
  summaryRoot.innerHTML = renderStats([
    ['Balance', formatPoints(user.balance)],
    ['Discord ID', escapeHtml(user.discordId)],
    ['Giveaway entries', String(user.giveawayEntries)],
    ['Admin', user.isAdmin ? 'Yes' : 'No'],
  ]);
  contentRoot.innerHTML = `
    <section class="app-grid app-grid--two">
      <article class="app-card">
        <h3>Identity</h3>
        <p><strong>${escapeHtml(user.displayName)}</strong></p>
        <p class="app-muted">@${escapeHtml(user.username)}</p>
        <p>${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" style="width:72px;height:72px;border-radius:999px;">` : ''}</p>
      </article>
      <article class="app-card">
        <h3>Perks and roles</h3>
        <p>${user.perks.length ? escapeHtml(user.perks.join(' • ')) : 'No special perks synced yet.'}</p>
        <ul class="app-list--tight">
          ${user.roles.map((role) => `<li>${escapeHtml(role)}</li>`).join('') || '<li>No cached roles</li>'}
        </ul>
      </article>
    </section>
  `;
}

async function renderAdmin() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  try {
    const payload = await getJSON('/api/admin/overview');
    summaryRoot.innerHTML = renderStats([
      ['Tracked users', String(payload.overview.users.length)],
      ['Giveaways', String(payload.overview.giveaways.length)],
      ['Actor', escapeHtml(payload.actor.displayName)],
      ['Mode', 'Admin'],
    ]);
    contentRoot.innerHTML = `
      <div id="admin-result"></div>
      <section class="app-grid app-grid--two">
        <form class="app-form" id="grant-form">
          <h3>Grant or deduct points</h3>
          <p>Use an internal user id or Discord id to write a ledger entry.</p>
          <div class="app-form-grid">
            <div><label for="grant-user-id">User ID</label><input id="grant-user-id" name="userId" placeholder="1" /></div>
            <div><label for="grant-discord-id">Discord ID</label><input id="grant-discord-id" name="discordId" placeholder="Optional alternate lookup" /></div>
            <div><label for="grant-amount">Amount</label><input id="grant-amount" name="amount" type="number" value="100" /></div>
            <div><label for="grant-description">Description</label><input id="grant-description" name="description" value="Clan reward grant" /></div>
          </div>
          <div class="app-actions"><button class="button" type="submit">Write ledger entry</button></div>
        </form>
        <form class="app-form" id="giveaway-form">
          <h3>Create giveaway</h3>
          <div class="app-form-grid">
            <div><label for="giveaway-title">Title</label><input id="giveaway-title" name="title" value="Weekly Ghosted Drop" /></div>
            <div><label for="giveaway-cost">Point cost</label><input id="giveaway-cost" name="pointCost" type="number" value="25" /></div>
            <div><label for="giveaway-start">Start</label><input id="giveaway-start" name="startAt" type="datetime-local" /></div>
            <div><label for="giveaway-end">End</label><input id="giveaway-end" name="endAt" type="datetime-local" /></div>
            <div><label for="giveaway-max">Max entries</label><input id="giveaway-max" name="maxEntries" type="number" value="3" /></div>
            <div><label for="giveaway-role">Required role id</label><input id="giveaway-role" name="requiredRoleId" placeholder="Optional Discord role id" /></div>
          </div>
          <label for="giveaway-description">Description</label>
          <textarea id="giveaway-description" name="description">Launch-ready clan giveaway.</textarea>
          <div class="app-actions"><button class="button" type="submit">Create giveaway</button></div>
        </form>
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
}

function renderStats(items) {
  return items.map(([label, value]) => `
    <article class="app-stat">
      <div class="app-stat__value">${value}</div>
      <div class="app-stat__label">${escapeHtml(label)}</div>
    </article>
  `).join('');
}

function renderLedgerTable(entries) {
  if (!entries.length) {
    return '<div class="app-empty">No ledger entries yet.</div>';
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
  root.innerHTML = `<div class="app-banner ${variant === 'error' ? 'is-error' : variant === 'warning' ? 'is-warning' : ''}">${escapeHtml(message)}</div>`;
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
    ? `${symbols} Line hit. Won ${formatPoints(result.payout)} and moved to ${formatPoints(result.balance)}.`
    : `${symbols} No payout this time. Wager ${formatPoints(result.wager)}, balance ${formatPoints(result.balance)}.`;
  renderBanner(message, tone, root);
}

function describeSpinResult(result) {
  if (result.payout > 0) {
    return `Paid ${formatPoints(result.payout)} on ${result.symbols.map((symbol) => getSlotSymbol(symbol).label).join(', ')}.`;
  }
  return `No line hit. Net ${formatPoints(result.net)} on that pull.`;
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
    return `Paid ${formatPoints(result.payout)} on ${result.symbols.map((symbol) => getSlotSymbol(symbol).label).join(', ')}.`;
  }
  return `No line hit. Net ${formatPoints(result.net)} on that pull.`;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
