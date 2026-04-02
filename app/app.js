const state = {
  config: null,
  me: null,
  admin: {
    pages: [],
    selectedPageSlug: null,
    editor: null,
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
    summaryRoot.innerHTML = '';
    renderSignInState(contentRoot, 'Sign in to view your points, giveaways, and spins in one place.');
    return;
  }

  const [rewards, giveaways] = await Promise.all([getJSON('/api/rewards'), getJSON('/api/giveaways')]);
  const activeGiveaways = giveaways.giveaways.filter((item) => item.status === 'active').length;
  const recentSpins = rewards.spins.length;
  const perksText = state.me.user.perks.length
    ? escapeHtml(state.me.user.perks.join(', '))
    : 'Role perks appear here once Discord roles sync.';
  summaryRoot.innerHTML = renderStats([
    ['Balance', formatPoints(rewards.balance)],
    ['Active giveaways', String(activeGiveaways)],
    ['Recent spins', String(recentSpins)],
    ['Recent entries', String(state.me.user.giveawayEntries)],
  ]);

  contentRoot.innerHTML = `
    <section class="app-dashboard-grid">
      <article class="app-panel">
        <div class="app-panel__header">
          <div>
            <p class="app-kicker">Launch Pad</p>
            <h3>Pick the next lane.</h3>
          </div>
          <span class="app-chip">${state.me.user.isAdmin ? 'Admin access' : 'Member tools'}</span>
        </div>
        <div class="app-route-list">
          <a class="app-route" href="/app/casino/">
            <div>
              <strong>Casino floor</strong>
              <p>Spin cabinets, trigger features, and keep the points loop moving.</p>
            </div>
            <span class="app-route__meta">${recentSpins} logged</span>
          </a>
          <a class="app-route" href="/app/giveaways/">
            <div>
              <strong>Giveaway board</strong>
              <p>Check live drops, role gates, and how many entries you still have to send.</p>
            </div>
            <span class="app-route__meta">${activeGiveaways} active</span>
          </a>
          <a class="app-route" href="/app/rewards/">
            <div>
              <strong>Rewards ledger</strong>
              <p>See the record behind every wager, payout, grant, and giveaway entry.</p>
            </div>
            <span class="app-route__meta">${rewards.entries.length} entries</span>
          </a>
        </div>
      </article>
      <article class="app-panel">
        <div class="app-panel__header">
          <div>
            <p class="app-kicker">Account Bind</p>
            <h3>Discord-linked status.</h3>
          </div>
          <span class="app-chip">${formatPoints(rewards.balance)}</span>
        </div>
        <div class="app-panel-list">
          <div>
            <span>Display name</span>
            <strong>${escapeHtml(state.me.user.displayName)}</strong>
          </div>
          <div>
            <span>Role perks</span>
            <strong>${perksText}</strong>
          </div>
          <div>
            <span>Giveaway entries used</span>
            <strong>${state.me.user.giveawayEntries}</strong>
          </div>
          <div>
            <span>Admin surface</span>
            <strong>${state.me.user.isAdmin ? 'Unlocked' : 'Member only'}</strong>
          </div>
        </div>
        <p class="app-panel-note">Discord login anchors identity, roles, and access across the app.</p>
      </article>
    </section>
    <section class="app-ledger-shell">
      <div class="app-card__row">
        <div>
          <p class="app-kicker">Recent Activity</p>
          <h3>Latest ledger entries</h3>
        </div>
        <a class="button button--secondary button--small" href="/app/rewards/">Open full ledger</a>
      </div>
      ${renderLedgerTable(rewards.entries.slice(0, 6))}
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
    const [payload, pagesPayload] = await Promise.all([
      getJSON('/api/admin/overview'),
      getJSON('/api/admin/pages'),
    ]);
    state.admin.pages = pagesPayload.pages;
    if (!state.admin.selectedPageSlug || !state.admin.pages.some((page) => page.slug === state.admin.selectedPageSlug)) {
      state.admin.selectedPageSlug = state.admin.pages[0]?.slug || null;
    }
    summaryRoot.innerHTML = renderStats([
      ['Tracked users', String(payload.overview.users.length)],
      ['Giveaways', String(payload.overview.giveaways.length)],
      ['Editable pages', String(state.admin.pages.length)],
      ['Actor', escapeHtml(payload.actor.displayName)],
      ['Mode', 'Admin tools'],
    ]);
    contentRoot.innerHTML = `
      <div id="admin-result"></div>
      <section class="app-card admin-editor-card">
        <div class="app-card__row">
          <div>
            <p class="app-kicker">Visual Editor</p>
            <h3>Edit page copy in a live preview.</h3>
          </div>
          <div class="admin-editor-actions">
            <button class="button button--secondary button--small" type="button" data-editor-reload>Reload page</button>
            <button class="button button--small" type="button" data-editor-save>Save page</button>
          </div>
        </div>
        <div class="admin-editor-shell">
          <aside class="admin-editor-sidebar">
            <section class="admin-editor-panel">
              <div class="app-card__row">
                <strong>Pages</strong>
                <span class="app-chip">${state.admin.pages.length} pages</span>
              </div>
              <div class="admin-editor-page-list" data-editor-page-list>
                ${renderAdminPageButtons(state.admin.pages, state.admin.selectedPageSlug)}
              </div>
            </section>
            <section class="admin-editor-panel">
              <div class="app-card__row">
                <strong>Page settings</strong>
                <span class="app-chip" data-editor-preview-route>Loading</span>
              </div>
              <div class="admin-editor-meta" data-editor-page-meta></div>
              <label for="editor-doc-title">Page title</label>
              <input id="editor-doc-title" type="text" data-editor-doc-title />
              <label for="editor-doc-description">Meta description</label>
              <textarea id="editor-doc-description" data-editor-doc-description></textarea>
            </section>
            <section class="admin-editor-panel">
              <div class="app-card__row">
                <strong>Selected block</strong>
                <span class="app-chip" data-editor-node-tag>Select one</span>
              </div>
              <div class="admin-editor-empty" data-editor-selection-empty>Click text in the preview to edit it.</div>
              <div data-editor-fields hidden>
                <label for="editor-node-text">Text</label>
                <textarea id="editor-node-text" data-editor-node-text></textarea>
                <div data-editor-link-fields hidden>
                  <label for="editor-node-href">Link</label>
                  <input id="editor-node-href" type="text" data-editor-node-href />
                  <label class="admin-editor-checkbox">
                    <input type="checkbox" data-editor-node-blank />
                    <span>Open in new tab</span>
                  </label>
                </div>
              </div>
            </section>
            <section class="admin-editor-panel">
              <div class="app-card__row">
                <strong>Editable blocks</strong>
                <span class="app-chip" data-editor-node-count>0</span>
              </div>
              <div class="admin-editor-node-list" data-editor-node-list></div>
            </section>
          </aside>
          <div class="admin-editor-preview-shell">
            <div class="admin-editor-preview-bar">
              <span class="app-chip">Preview</span>
              <span class="app-muted">Scripts are disabled here so the layout stays stable while you edit.</span>
            </div>
            <div class="admin-editor-preview-frame">
              <iframe title="Ghosted page editor preview" data-editor-preview sandbox="allow-same-origin"></iframe>
            </div>
          </div>
        </div>
      </section>
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
    bindAdminEditorControls();
    if (state.admin.selectedPageSlug) {
      await loadAdminEditorPage(state.admin.selectedPageSlug);
    }
  } catch (error) {
    renderBanner(error.message, 'error');
    renderSignInState(contentRoot, 'Only admins can view this panel.');
  }
}

function renderAdminPageButtons(pages, selectedSlug) {
  return pages.map((page) => `
    <button
      class="admin-editor-page ${page.slug === selectedSlug ? 'is-selected' : ''}"
      type="button"
      data-page-editor-load="${escapeHtml(page.slug)}"
    >
      <strong>${escapeHtml(page.title)}</strong>
      <span>${escapeHtml(page.route)}</span>
    </button>
  `).join('');
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

function bindAdminEditorControls() {
  document.querySelectorAll('[data-page-editor-load]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.admin.selectedPageSlug = button.dataset.pageEditorLoad;
      syncAdminPageButtons();
      await loadAdminEditorPage(state.admin.selectedPageSlug);
    });
  });

  document.querySelector('[data-editor-reload]')?.addEventListener('click', async () => {
    if (!state.admin.selectedPageSlug) return;
    await loadAdminEditorPage(state.admin.selectedPageSlug);
    renderBanner('Page reloaded from disk.', 'info', '#admin-result');
  });

  document.querySelector('[data-editor-save]')?.addEventListener('click', async () => {
    const editor = state.admin.editor;
    if (!editor?.page) return;
    const button = document.querySelector('[data-editor-save]');
    button.disabled = true;
    try {
      const payload = await getJSON(`/api/admin/pages/${editor.page.slug}`, {
        method: 'POST',
        body: JSON.stringify({ html: serializeAdminEditorDocument(editor.sourceDocument) }),
      });
      updateAdminPageMetadata(payload.page);
      renderBanner(`Saved ${payload.page.title}.`, 'info', '#admin-result');
      await loadAdminEditorPage(payload.page.slug);
    } catch (error) {
      renderBanner(error.message, 'error', '#admin-result');
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('[data-editor-doc-title]')?.addEventListener('input', (event) => {
    const value = event.currentTarget.value;
    updateAdminEditorHeadField('title', value);
  });

  document.querySelector('[data-editor-doc-description]')?.addEventListener('input', (event) => {
    const value = event.currentTarget.value;
    updateAdminEditorHeadField('description', value);
  });

  document.querySelector('[data-editor-node-text]')?.addEventListener('input', (event) => {
    updateAdminEditorNodeField('text', event.currentTarget.value);
  });

  document.querySelector('[data-editor-node-href]')?.addEventListener('input', (event) => {
    updateAdminEditorNodeField('href', event.currentTarget.value);
  });

  document.querySelector('[data-editor-node-blank]')?.addEventListener('change', (event) => {
    updateAdminEditorNodeField('blank', event.currentTarget.checked);
  });
}

async function loadAdminEditorPage(slug) {
  const previewFrame = document.querySelector('[data-editor-preview]');
  if (!previewFrame) return;
  previewFrame.srcdoc = '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;color:#fff;background:#100d18;">Loading preview...</body></html>';
  try {
    const payload = await getJSON(`/api/admin/pages/${slug}`);
    state.admin.selectedPageSlug = slug;
    updateAdminPageMetadata(payload.page);
    state.admin.editor = createAdminEditorState(payload.page);
    syncAdminPageButtons();
    syncAdminEditorSidebar();
    await mountAdminEditorPreview();
    const firstNodeId = state.admin.editor.nodes[0]?.id || null;
    if (firstNodeId) {
      selectAdminEditorNode(firstNodeId, { scroll: false });
    }
  } catch (error) {
    renderBanner(error.message, 'error', '#admin-result');
  }
}

function updateAdminPageMetadata(page) {
  const pages = state.admin.pages || [];
  const index = pages.findIndex((entry) => entry.slug === page.slug);
  const summary = {
    slug: page.slug,
    title: page.title,
    route: page.route,
    path: page.path,
    updatedAt: page.updatedAt,
  };
  if (index >= 0) {
    pages[index] = { ...pages[index], ...summary };
  } else {
    pages.push(summary);
  }
}

function createAdminEditorState(page) {
  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(page.html, 'text/html');
  const previewDocument = parser.parseFromString(page.html, 'text/html');
  const selector = 'h1, h2, h3, h4, h5, h6, p, a, button, li, label, strong, small';
  const sourceNodes = [...sourceDocument.querySelectorAll(selector)].filter(isEditablePreviewNode);
  const previewNodes = [...previewDocument.querySelectorAll(selector)].filter(isEditablePreviewNode);
  const nodes = sourceNodes.map((node, index) => {
    const id = `ghosted-node-${index + 1}`;
    const previewNode = previewNodes[index];
    node.dataset.ghostedNodeId = id;
    node.dataset.ghostedEditable = 'true';
    if (previewNode) {
      previewNode.dataset.ghostedNodeId = id;
      previewNode.dataset.ghostedEditable = 'true';
    }
    return {
      id,
      tag: node.tagName.toLowerCase(),
      label: describeEditableNode(node),
      isLink: node.matches('a, button'),
    };
  });

  const base = previewDocument.createElement('base');
  base.href = new URL(page.route, window.location.origin).toString();
  previewDocument.head.prepend(base);

  const style = previewDocument.createElement('style');
  style.textContent = `
    [data-ghosted-editable="true"] { cursor: pointer; transition: outline-color 120ms ease, box-shadow 120ms ease; }
    [data-ghosted-editable="true"]:hover { outline: 2px solid rgba(123, 223, 246, 0.95); outline-offset: 4px; }
    [data-ghosted-editable="true"][data-ghosted-selected="true"] { outline: 3px solid rgba(255, 209, 102, 0.98); outline-offset: 4px; box-shadow: 0 0 0 8px rgba(255, 209, 102, 0.16); }
    html { scroll-behavior: smooth; }
  `;
  previewDocument.head.append(style);

  return {
    page,
    sourceDocument,
    previewDocument,
    nodes,
    selectedNodeId: null,
  };
}

function isEditablePreviewNode(node) {
  if (!node) return false;
  const text = node.textContent?.replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (node.closest('script, style, noscript')) return false;
  return true;
}

function describeEditableNode(node) {
  const text = node.textContent.replace(/\s+/g, ' ').trim();
  const preview = text.length > 48 ? `${text.slice(0, 48)}…` : text;
  return `${node.tagName.toLowerCase()} · ${preview}`;
}

async function mountAdminEditorPreview() {
  const editor = state.admin.editor;
  const previewFrame = document.querySelector('[data-editor-preview]');
  if (!editor || !previewFrame) return;
  const previewMarkup = serializeAdminEditorDocument(editor.previewDocument);
  await new Promise((resolve) => {
    previewFrame.onload = () => resolve();
    previewFrame.srcdoc = previewMarkup;
  });
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  doc.addEventListener('click', (event) => {
    const node = event.target.closest('[data-ghosted-node-id]');
    const link = event.target.closest('a');
    if (link) {
      event.preventDefault();
    }
    if (!node) return;
    event.preventDefault();
    selectAdminEditorNode(node.dataset.ghostedNodeId);
  });
}

function syncAdminPageButtons() {
  const pageList = document.querySelector('[data-editor-page-list]');
  if (!pageList) return;
  pageList.innerHTML = renderAdminPageButtons(state.admin.pages, state.admin.selectedPageSlug);
  pageList.querySelectorAll('[data-page-editor-load]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.admin.selectedPageSlug = button.dataset.pageEditorLoad;
      syncAdminPageButtons();
      await loadAdminEditorPage(state.admin.selectedPageSlug);
    });
  });
}

function syncAdminEditorSidebar() {
  const editor = state.admin.editor;
  if (!editor) return;
  const titleInput = document.querySelector('[data-editor-doc-title]');
  const descriptionInput = document.querySelector('[data-editor-doc-description]');
  const pageMeta = document.querySelector('[data-editor-page-meta]');
  const previewRoute = document.querySelector('[data-editor-preview-route]');
  const nodeCount = document.querySelector('[data-editor-node-count]');
  const nodeList = document.querySelector('[data-editor-node-list]');
  if (titleInput) {
    titleInput.value = editor.sourceDocument.querySelector('title')?.textContent?.trim() || '';
  }
  if (descriptionInput) {
    descriptionInput.value = getAdminMetaDescription(editor.sourceDocument);
  }
  if (pageMeta) {
    pageMeta.innerHTML = `
      <div><span>Route</span><strong>${escapeHtml(editor.page.route)}</strong></div>
      <div><span>File</span><strong>${escapeHtml(editor.page.path)}</strong></div>
      <div><span>Updated</span><strong>${formatDate(editor.page.updatedAt)}</strong></div>
    `;
  }
  if (previewRoute) {
    previewRoute.textContent = editor.page.route;
  }
  if (nodeCount) {
    nodeCount.textContent = String(editor.nodes.length);
  }
  if (nodeList) {
    nodeList.innerHTML = editor.nodes.map((node) => `
      <button
        class="admin-editor-node ${node.id === editor.selectedNodeId ? 'is-selected' : ''}"
        type="button"
        data-editor-node-select="${escapeHtml(node.id)}"
      >
        ${escapeHtml(node.label)}
      </button>
    `).join('');
    nodeList.querySelectorAll('[data-editor-node-select]').forEach((button) => {
      button.addEventListener('click', () => selectAdminEditorNode(button.dataset.editorNodeSelect));
    });
  }
  syncAdminEditorSelectionFields();
}

function syncAdminEditorSelectionFields() {
  const editor = state.admin.editor;
  const empty = document.querySelector('[data-editor-selection-empty]');
  const fields = document.querySelector('[data-editor-fields]');
  const tag = document.querySelector('[data-editor-node-tag]');
  const textInput = document.querySelector('[data-editor-node-text]');
  const hrefInput = document.querySelector('[data-editor-node-href]');
  const blankInput = document.querySelector('[data-editor-node-blank]');
  const linkFields = document.querySelector('[data-editor-link-fields]');
  if (!editor?.selectedNodeId) {
    if (empty) empty.hidden = false;
    if (fields) fields.hidden = true;
    if (tag) tag.textContent = 'Select one';
    return;
  }
  const sourceNode = getEditorNode(editor.sourceDocument, editor.selectedNodeId);
  if (!sourceNode) return;
  const isLink = sourceNode.matches('a, button');
  if (empty) empty.hidden = true;
  if (fields) fields.hidden = false;
  if (tag) tag.textContent = sourceNode.tagName.toLowerCase();
  if (textInput) textInput.value = sourceNode.textContent?.replace(/\s+/g, ' ').trim() || '';
  if (hrefInput) hrefInput.value = sourceNode.getAttribute('href') || '';
  if (blankInput) blankInput.checked = sourceNode.getAttribute('target') === '_blank';
  if (linkFields) linkFields.hidden = !isLink;
}

function selectAdminEditorNode(nodeId, options = {}) {
  const editor = state.admin.editor;
  const previewDoc = document.querySelector('[data-editor-preview]')?.contentDocument;
  if (!editor || !previewDoc) return;
  const previous = editor.selectedNodeId ? getEditorNode(previewDoc, editor.selectedNodeId) : null;
  if (previous) {
    previous.removeAttribute('data-ghosted-selected');
  }
  editor.selectedNodeId = nodeId;
  const next = getEditorNode(previewDoc, nodeId);
  if (next) {
    next.setAttribute('data-ghosted-selected', 'true');
    if (options.scroll !== false) {
      next.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }
  syncAdminEditorSidebar();
}

function updateAdminEditorHeadField(kind, value) {
  const editor = state.admin.editor;
  if (!editor) return;
  if (kind === 'title') {
    let title = editor.sourceDocument.querySelector('title');
    if (!title) {
      title = editor.sourceDocument.createElement('title');
      editor.sourceDocument.head.append(title);
    }
    title.textContent = value;
    return;
  }
  if (kind === 'description') {
    setAdminMetaDescription(editor.sourceDocument, value);
  }
}

function updateAdminEditorNodeField(kind, value) {
  const editor = state.admin.editor;
  const sourceNode = editor?.selectedNodeId ? getEditorNode(editor.sourceDocument, editor.selectedNodeId) : null;
  const previewNode = editor?.selectedNodeId ? getEditorNode(document.querySelector('[data-editor-preview]')?.contentDocument, editor.selectedNodeId) : null;
  if (!sourceNode || !previewNode) return;
  if (kind === 'text') {
    sourceNode.textContent = value;
    previewNode.textContent = value;
  }
  if (kind === 'href') {
    if (value) {
      sourceNode.setAttribute('href', value);
      previewNode.setAttribute('href', value);
    } else {
      sourceNode.removeAttribute('href');
      previewNode.removeAttribute('href');
    }
  }
  if (kind === 'blank') {
    if (value) {
      sourceNode.setAttribute('target', '_blank');
      previewNode.setAttribute('target', '_blank');
      sourceNode.setAttribute('rel', 'noopener noreferrer');
      previewNode.setAttribute('rel', 'noopener noreferrer');
    } else {
      sourceNode.removeAttribute('target');
      previewNode.removeAttribute('target');
    }
  }
  editor.nodes = editor.nodes.map((node) => node.id === editor.selectedNodeId
    ? { ...node, label: describeEditableNode(sourceNode), isLink: sourceNode.matches('a, button') }
    : node);
  syncAdminEditorSidebar();
}

function getAdminMetaDescription(doc) {
  return doc?.querySelector('meta[name="description"]')?.getAttribute('content') || '';
}

function setAdminMetaDescription(doc, value) {
  if (!doc) return;
  let meta = doc.querySelector('meta[name="description"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'description');
    doc.head.append(meta);
  }
  meta.setAttribute('content', value);
}

function getEditorNode(doc, nodeId) {
  if (!doc || !nodeId) return null;
  return doc.querySelector(`[data-ghosted-node-id="${cssEscape(nodeId)}"]`);
}

function serializeAdminEditorDocument(doc) {
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
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
      <div class="app-muted">${formatPoints(rewards.dailyRemaining)} left before the daily cap closes the floor.</div>
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
    return `Paid ${formatPoints(result.payout)} across ${result.lineWins?.length || 1} winning lines.`;
  }
  return result.usedFreeSpin
    ? `Free spin used. ${result.freeSpinsRemaining || 0} remaining.`
    : `No line hit. Net ${formatPoints(result.net)} on that pull.`;
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
