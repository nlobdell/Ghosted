const state = {
  config: null,
  me: null,
  admin: {
    roleOptions: [],
  },
};

const numberFormatter = new Intl.NumberFormat();
const shortNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

document.addEventListener('DOMContentLoaded', () => {
  boot().catch((error) => {
    renderBanner(messageOf(error, 'Something went wrong loading Ghosted.'), 'error');
  });
});

async function boot() {
  state.config = await getJSON('/api/config');
  state.me = await getJSON('/api/me');
  renderAuth();

  const page = document.querySelector('[data-page]')?.dataset.page;
  if (!page) return;

  const handlers = {
    admin: renderAdmin,
    clan: renderClan,
    community: renderCommunity,
    competitions: renderCompetitions,
    dashboard: renderDashboard,
    giveaways: renderGiveaways,
    profile: renderProfile,
    rewards: renderRewards,
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
    authRoot.innerHTML = `
      <div class="app-user">
        ${renderUserAvatar(user, 'app-user__avatar')}
        <div>
          <div><strong>${escapeHtml(user.displayName)}</strong></div>
          <div class="app-muted">${formatPoints(user.balance)}</div>
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

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Balance', value: formatPoints(rewards.balance), href: '/app/rewards/' },
    { label: 'Active giveaways', value: String(activeGiveaways), href: '/app/giveaways/' },
    { label: 'Community live', value: String(clan?.group?.memberCount || 0), href: '/app/community/' },
    { label: 'WOM link', value: womLink.linked ? 'Linked' : 'Not linked', href: '/app/profile/' },
  ]);

  const actionsPanel = renderPanel({
    eyebrow: 'Next',
    title: 'Routes',
    chip: state.me.user.isAdmin ? 'Admin enabled' : 'Member tools',
    body: renderRouteList([
      {
        href: '/app/community/',
        label: 'Community',
        meta: `${clan?.group?.memberCount || 0} members`,
        featured: true,
      },
      {
        href: '/app/rewards/',
        label: 'Rewards',
        meta: formatPoints(rewards.balance),
      },
      {
        href: '/app/giveaways/',
        label: 'Giveaways',
        meta: `${activeGiveaways} active`,
      },
      {
        href: '/app/casino/',
        label: 'Casino',
        meta: `${recentSpins} logged`,
      },
      {
        href: '/app/profile/',
        label: 'Profile',
        meta: womLink.linked ? 'Linked' : 'Needs setup',
      },
    ]),
  });

  const profilePanel = renderPanel({
    eyebrow: 'Account',
    href: '/app/profile/',
    title: 'Identity',
    chip: womLink.linked ? 'WOM linked' : 'Discord only',
    link: true,
    body:
      renderMetricGrid([
        ['Display name', state.me.user.displayName],
        ['Username', `@${state.me.user.username}`],
        ['RuneScape', womLink.linked ? womLink.displayName || womLink.username : 'Link from profile'],
        ['Access', state.me.user.isAdmin ? 'Admin' : 'Member'],
      ]) +
      renderTagBlock('Perks', perks, 'Perks show up here after roles sync.'),
  });

  const communityPanel = renderPanel({
    title: 'Community pulse',
    chip: `${clan?.linkCoverage?.linkedUsers || 0} linked`,
    body: clan
      ? renderClanPulse(clan)
      : renderEmptyStateHtml('Configure WOM_GROUP_ID to unlock the Ghosted community view.'),
  });

  const competitionPanel = renderPanel({
    title: 'Competition watch',
    chip: `${liveCompetitions} live`,
    body: competitions
      ? renderCompetitionList((competitions.competitions || []).slice(0, 4), { compact: true })
      : renderEmptyStateHtml('Competition data appears here once WOM is configured.'),
  });

  contentRoot.innerHTML = [
    renderHighlight({
      eyebrow: 'Workspace',
      title: 'Scan. choose. move.',
      copy: 'Balance, live drops, clan pulse, and play stay in one flow.',
      actions: [
        renderLinkButton('/app/community/', 'Open Community', true),
        renderLinkButton('/app/rewards/', 'Open Rewards'),
      ],
      chips: [
        state.me.user.isAdmin ? 'Admin path available' : 'Member view',
        womLink.linked ? 'WOM ready' : 'Profile setup pending',
      ],
      theme: 'dashboard',
    }),
    `<section class="app-grid app-grid--two">${actionsPanel}${profilePanel}</section>`,
    `<section class="app-grid app-grid--two">${communityPanel}${competitionPanel}</section>`,
    `<section class="app-ledger-shell">
      ${renderSectionHeading({
        eyebrow: 'Recent activity',
        title: 'Latest entries',
        action: renderLinkButton('/app/rewards/', 'Open full ledger'),
      })}
      ${renderLedgerTable(rewards.entries.slice(0, 6))}
    </section>`,
  ].join('');
}

async function renderCommunity() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');

  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStatStrip([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Community page', value: 'Unavailable' },
      { label: 'Clan detail', value: 'Disabled' },
      { label: 'Competitions', value: 'Disabled' },
    ]);
    contentRoot.innerHTML = renderEmptyStateHtml(
      'Set WOM_GROUP_ID to unlock the Ghosted community overview.',
      renderLinkButton('/app/profile/', 'Open Profile')
    );
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

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Group members', value: String(clan.group.memberCount || 0), href: '/app/clan/' },
    { label: 'Linked users', value: String(clan.linkCoverage.linkedUsers || 0), href: '/app/profile/' },
    { label: 'Live competitions', value: String(liveCompetitions), href: '/app/competitions/' },
    { label: 'Upcoming', value: String(upcomingCompetitions), href: '/app/competitions/' },
  ]);

  contentRoot.innerHTML = [
    renderHighlight({
      eyebrow: 'Overview',
      title: clan.group.name || 'Ghosted',
      copy: clan.group.description || 'Group status, comps, and leaders in one glance.',
      actions: [
        renderLinkButton('/app/clan/', 'Clan detail', true),
        renderLinkButton('/app/competitions/', 'Competitions'),
      ],
      chips: [
        `${clan.linkCoverage.unlinkedUsers || 0} unlinked`,
        `${liveCompetitions} competitions live`,
      ],
      theme: 'community',
    }),
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        title: 'Clan pulse',
        chip: `${clan.linkCoverage.unlinkedUsers || 0} unlinked`,
        body: renderClanPulse(clan),
      })}
      ${renderPanel({
        title: 'Competition watch',
        chip: `${liveCompetitions} live`,
        body: renderCompetitionList(competitions.slice(0, 4), { compact: true }),
      })}
    </section>`,
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        title: 'Overall leaders',
        chip: `Top ${hiscores.entries.length}`,
        body: renderLeaderboardTable(hiscores.entries, {
          valueFormatter: formatHiscoreValue,
          valueLabel: 'Experience / rank',
        }),
      })}
      ${renderPanel({
        title: 'Weekly gains',
        chip: String((gains.period || 'week').toUpperCase()),
        body: renderLeaderboardTable(gains.entries, {
          valueFormatter: formatGainValue,
          valueLabel: 'Gained',
        }),
      })}
    </section>`,
  ].join('');
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

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Balance', value: formatPoints(rewards.balance), href: '/app/rewards/' },
    { label: 'Daily remaining', value: formatPoints(rewards.dailyRemaining), href: '/app/rewards/' },
    { label: 'Recent spins', value: String(rewards.spins.length), href: '/app/casino/' },
    { label: 'Ledger entries', value: String(rewards.entries.length), href: '/app/rewards/' },
  ]);

  contentRoot.innerHTML = [
    renderHighlight({
      eyebrow: 'Rewards',
      title: `${formatPointsFull(rewards.balance)} available`,
      copy:
        rewards.dailyCap === null
          ? 'No daily cap is active.'
          : `${formatPointsFull(rewards.dailyRemaining)} left today.`,
      actions: [
        renderLinkButton('/app/casino/', 'Open Casino', true),
        renderLinkButton('/app/giveaways/', 'Open Giveaways'),
      ],
      chips: [
        rewards.dailyCap === null ? 'Unlimited daily cap' : `${formatPoints(rewards.dailyRemaining)} left today`,
        `${rewards.entries.length} ledger rows`,
      ],
      theme: 'rewards',
    }),
    `<section class="app-ledger-shell">
      ${renderSectionHeading({
        eyebrow: 'Full ledger',
        title: 'Points timeline',
        copy: 'Every point movement in one table.',
      })}
      ${renderLedgerTable(rewards.entries)}
    </section>`,
  ].join('');
}

async function renderGiveaways() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');
  const payload = await getJSON('/api/giveaways');
  const activeCount = payload.giveaways.filter((item) => item.status === 'active').length;
  const sortedGiveaways = [...payload.giveaways].sort((left, right) => {
    const leftRank = giveawaySortRank(left.status);
    const rightRank = giveawaySortRank(right.status);
    return leftRank - rightRank || String(left.endAt || '').localeCompare(String(right.endAt || ''));
  });

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Active now', value: String(activeCount), href: '/app/giveaways/' },
    { label: 'Total giveaways', value: String(payload.giveaways.length), href: '/app/giveaways/' },
    { label: 'Entry type', value: 'Points + roles' },
    { label: 'Sign-in', value: state.me.authenticated ? 'Ready' : 'Browse only', href: '/app/profile/' },
  ]);

  contentRoot.innerHTML = [
    '<div id="giveaway-result"></div>',
    renderHighlight({
      eyebrow: 'Giveaways',
      title: 'Live drops first.',
      copy: 'Active entries stay on top with cost and access visible.',
      actions: [
        renderLinkButton('/app/rewards/', 'Check Balance', true),
        renderLinkButton('/app/profile/', 'Review Roles'),
      ],
      chips: [`${activeCount} active`, state.me.authenticated ? 'Member entry enabled' : 'Browse mode'],
      theme: 'giveaways',
    }),
    `<section class="app-grid app-grid--two">
      ${sortedGiveaways.length
        ? sortedGiveaways.map((item) => renderGiveawayPanel(item)).join('')
        : renderPanel({
          title: 'No giveaways yet',
          body: renderEmptyStateHtml('Ghosted has not published any giveaways yet.'),
        })}
    </section>`,
  ].join('');

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
        renderBanner(messageOf(error, 'Unable to enter giveaway.'), 'error', '#giveaway-result');
        button.disabled = false;
      }
    });
  });
}

async function renderClan() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');

  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStatStrip([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Clan page', value: 'Unavailable' },
    ]);
    contentRoot.innerHTML = renderEmptyStateHtml('Set WOM_GROUP_ID to load the Ghosted clan overview.');
    return;
  }

  const [clan, hiscores, gains] = await Promise.all([
    getJSON('/api/wom/clan'),
    getJSON('/api/wom/hiscores?metric=overall&limit=8'),
    getJSON('/api/wom/gains?metric=overall&period=week&limit=8'),
  ]);

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Group members', value: String(clan.group.memberCount || 0) },
    { label: 'Ghosted links', value: String(clan.linkCoverage.linkedUsers || 0), href: '/app/profile/' },
    { label: 'Maxed totals', value: String(clan.statistics.maxedTotalCount || 0) },
    { label: 'Avg total level', value: formatMaybeNumber(clan.statistics.averageOverallLevel) },
  ]);

  contentRoot.innerHTML = [
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        eyebrow: 'Group',
        title: clan.group.name || 'Ghosted',
        chip: clan.group.verified ? 'Verified' : 'Tracked',
        copy: clan.group.description || 'Roster and group stats.',
        body: renderMetricGrid([
          ['Clan chat', clan.group.clanChat || 'Not listed'],
          ['Home world', clan.group.homeworld || 'Unknown'],
          ['Average EHP', formatMaybeNumber(clan.statistics.averageEhp)],
          ['Average EHB', formatMaybeNumber(clan.statistics.averageEhb)],
        ]),
      })}
      ${renderPanel({
        eyebrow: 'Coverage',
        title: 'Link coverage',
        chip: `${clan.linkCoverage.unlinkedUsers || 0} unlinked`,
        body:
          renderMetricGrid([
            ['Tracked Discord users', String(clan.linkCoverage.trackedUsers || 0)],
            ['Linked RSNs', String(clan.linkCoverage.linkedUsers || 0)],
            ['Unlinked users', String(clan.linkCoverage.unlinkedUsers || 0)],
            ['WOM members', String(clan.linkCoverage.groupMemberCount || 0)],
          ]) +
          (!state.me.authenticated || state.me.user.womLink?.linked
            ? ''
            : '<p class="app-panel-note">Link your RSN from Profile to match Discord and WOM.</p>'),
      })}
    </section>`,
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        title: 'Overall hiscores',
        chip: `Top ${hiscores.entries.length}`,
        body: renderLeaderboardTable(hiscores.entries, {
          valueFormatter: formatHiscoreValue,
          valueLabel: 'Experience / rank',
        }),
      })}
      ${renderPanel({
        title: 'Weekly gains',
        chip: String((gains.period || 'week').toUpperCase()),
        body: renderLeaderboardTable(gains.entries, {
          valueFormatter: formatGainValue,
          valueLabel: 'Gained',
        }),
      })}
    </section>`,
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        title: 'Recent achievements',
        chip: String(clan.recentAchievements.length),
        body: renderAchievementFeed(clan.recentAchievements),
      })}
      ${renderPanel({
        title: 'Recent activity',
        chip: String(clan.recentActivity.length),
        body: renderActivityFeed(clan.recentActivity),
      })}
    </section>`,
  ].join('');
}

async function renderCompetitions() {
  const summaryRoot = document.querySelector('[data-summary]');
  const contentRoot = document.querySelector('[data-content]');

  if (!state.config.womConfigured) {
    summaryRoot.innerHTML = renderStatStrip([
      { label: 'Wise Old Man', value: 'Offline' },
      { label: 'Competitions', value: 'Unavailable' },
    ]);
    contentRoot.innerHTML = renderEmptyStateHtml('Set WOM_GROUP_ID to load Ghosted competition standings.');
    return;
  }

  const listing = await getJSON('/api/wom/competitions?limit=12');
  const competitions = listing.competitions || [];
  const selected = competitions[0] ? await getJSON(`/api/wom/competitions/${competitions[0].id}`) : null;
  const ongoing = competitions.filter((item) => item.status === 'ongoing').length;
  const upcoming = competitions.filter((item) => item.status === 'upcoming').length;
  const finished = competitions.filter((item) => item.status === 'finished').length;

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Tracked comps', value: String(competitions.length) },
    { label: 'Ongoing', value: String(ongoing) },
    { label: 'Upcoming', value: String(upcoming) },
    { label: 'Finished', value: String(finished) },
  ]);

  contentRoot.innerHTML = `<section class="app-grid app-grid--two">
    ${renderPanel({
      title: 'Competition board',
      chip: `${ongoing} live`,
      body: renderCompetitionList(competitions),
    })}
    ${renderPanel({
      title: selected?.competition?.title || 'No competition selected',
      chip: selected?.competition?.status || 'none',
      body: selected
        ? renderCompetitionDetail(selected)
        : renderEmptyStateHtml('No group competitions are available yet.'),
    })}
  </section>`;
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
      renderBanner(messageOf(error, 'Unable to load Wise Old Man profile.'), 'warning');
    }
  }

  summaryRoot.innerHTML = renderStatStrip([
    { label: 'Balance', value: formatPoints(user.balance), href: '/app/rewards/' },
    { label: 'WOM link', value: womLink.linked ? 'Linked' : 'Not linked' },
    { label: 'Roles synced', value: String(roleDetails.length) },
    { label: 'Access', value: user.isAdmin ? 'Admin' : 'Member', href: user.isAdmin ? '/admin/' : '/app/' },
  ]);

  contentRoot.innerHTML = [
    `<section class="app-grid app-grid--two">
      ${renderPanel({
        eyebrow: 'Profile',
        title: user.displayName,
        chip: `@${user.username}`,
        body:
          `<div class="app-identity">
            ${renderUserAvatar(user, 'app-avatar')}
            <div>
              <h3>${escapeHtml(user.displayName)}</h3>
              <p class="app-muted">@${escapeHtml(user.username)}</p>
            </div>
          </div>` +
          renderMetricGrid([
            ['Discord ID', user.discordId || 'Not synced'],
            ['Roles synced', String(roleDetails.length)],
            ['Wise Old Man', womLink.linked ? womLink.displayName || womLink.username : 'Not linked'],
            ['Access', user.isAdmin ? 'Admin' : 'Member'],
          ]) +
          renderWomLinkPanel(womLink),
      })}
      ${renderPanel({
        eyebrow: 'Access',
        title: 'Roles and perks',
        chip: `${roleDetails.length} synced`,
        body:
          renderTagBlock('Perks', perks, 'No synced perks') +
          renderTagBlock(
            'Roles',
            roleDetails.map((role) => role.label),
            'No synced roles'
          ),
      })}
    </section>`,
    renderProfileWomDetails(womProfile, womLink),
  ].join('');

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

    summaryRoot.innerHTML = renderStatStrip([
      ['Tracked users', String(payload.overview.users.length)],
      ['Live giveaways', String(activeGiveaways)],
      ['WOM links', String(payload.overview.wom?.linkedUsers || 0)],
      ['Admin users', String(adminCount)],
    ]);

    contentRoot.innerHTML = [
      '<div id="admin-result"></div>',
      renderHighlight({
        eyebrow: 'Admin',
        title: 'Run Ghosted',
        copy: 'Grant points, launch drops, and refresh WOM data.',
        chips: [
          `Actor: ${payload.actor.displayName}`,
          payload.overview.wom?.configured ? 'WOM live' : 'WOM offline',
        ],
        theme: 'admin',
      }),
      `<section class="app-grid app-grid--two">
        ${renderAdminGrantForm()}
        ${renderAdminGiveawayForm(rolePayload)}
      </section>`,
      `<section class="app-grid app-grid--two">
        ${renderAdminWomRefreshForm(payload)}
        ${renderPanel({
          eyebrow: 'Wise Old Man',
          title: 'Status',
          chip: payload.overview.wom?.configured ? 'Live' : 'Offline',
          body:
            renderMetricGrid([
              ['Linked users', String(payload.overview.wom?.linkedUsers || 0)],
              ['Group config', payload.overview.wom?.configured ? 'Ready' : 'Missing WOM_GROUP_ID'],
            ]) +
            '<p class="app-panel-note">Ghosted is intentionally read-only for the WOM group. Use refresh to clear cache drift without editing membership from this console.</p>',
        })}
      </section>`,
      `<section class="app-grid app-grid--two">
        ${renderPanel({
          title: 'Users',
          body: renderDenseTable(
            ['ID', 'User', 'Balance'],
            payload.overview.users.map((user) => [
              escapeHtml(String(user.id)),
              escapeHtml(user.displayName),
              formatPoints(user.balance),
            ]),
            'No users found.'
          ),
        })}
        ${renderPanel({
          title: 'Giveaway draws',
          body:
            payload.overview.giveaways.length
              ? `<div class="app-actions">
                  ${payload.overview.giveaways.map((item) => `
                    <button class="button button--secondary" data-draw="${item.id}" ${item.status === 'scheduled' || item.status === 'completed' ? 'disabled' : ''}>
                      Draw ${escapeHtml(item.title)}
                    </button>
                  `).join('')}
                </div>`
              : '<div class="app-muted">No giveaways yet.</div>',
        })}
      </section>`,
    ].join('');

    bindAdminForms();
  } catch (error) {
    renderBanner(messageOf(error, 'Unable to load admin surface.'), 'error');
    renderSignInState(contentRoot, 'Only admins can view this panel.');
  }
}

function bindAdminForms() {
  document.querySelector('#grant-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await getJSON('/api/admin/rewards/grant', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      renderBanner('Ledger entry written.', 'info', '#admin-result');
      await renderAdmin();
    } catch (error) {
      renderBanner(messageOf(error, 'Unable to write ledger entry.'), 'error', '#admin-result');
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
      renderBanner(messageOf(error, 'Unable to create giveaway.'), 'error', '#admin-result');
    }
  });

  document.querySelectorAll('[data-draw]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await getJSON(`/api/admin/giveaways/${button.dataset.draw}/draw`, { method: 'POST' });
        renderBanner('Winner selected.', 'info', '#admin-result');
        await renderAdmin();
      } catch (error) {
        renderBanner(messageOf(error, 'Unable to draw winner.'), 'error', '#admin-result');
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
      renderBanner(messageOf(error, 'Unable to refresh WOM cache.'), 'error', '#admin-result');
    }
  });
}

function renderAdminGrantForm() {
  return `
    <form class="app-form" id="grant-form">
      <p class="app-kicker">Rewards</p>
      <h3>Grant or deduct points</h3>
      <p>Use an internal user id or Discord id to write a ledger entry.</p>
      <div class="app-form-grid">
        <div>
          <label for="grant-user-id">User ID</label>
          <input id="grant-user-id" name="userId" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="1" />
        </div>
        <div>
          <label for="grant-discord-id">Discord ID</label>
          <input id="grant-discord-id" name="discordId" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Alternate lookup..." />
        </div>
        <div>
          <label for="grant-amount">Amount</label>
          <input id="grant-amount" name="amount" type="number" inputmode="numeric" autocomplete="off" value="100" />
        </div>
        <div>
          <label for="grant-description">Description</label>
          <input id="grant-description" name="description" type="text" autocomplete="off" value="Clan reward grant" />
        </div>
      </div>
      <div class="app-actions">
        <button class="button" type="submit">Write ledger entry</button>
      </div>
    </form>
  `;
}

function renderAdminGiveawayForm(rolePayload) {
  return `
    <form class="app-form" id="giveaway-form">
      <p class="app-kicker">Giveaways</p>
      <h3>Create giveaway</h3>
      <div class="app-form-grid">
        <div>
          <label for="giveaway-title">Title</label>
          <input id="giveaway-title" name="title" type="text" autocomplete="off" value="Weekly Ghosted Drop" />
        </div>
        <div>
          <label for="giveaway-cost">Point cost</label>
          <input id="giveaway-cost" name="pointCost" type="number" inputmode="numeric" autocomplete="off" value="25" />
        </div>
        <div>
          <label for="giveaway-start">Start</label>
          <input id="giveaway-start" name="startAt" type="datetime-local" autocomplete="off" />
        </div>
        <div>
          <label for="giveaway-end">End</label>
          <input id="giveaway-end" name="endAt" type="datetime-local" autocomplete="off" />
        </div>
        <div>
          <label for="giveaway-max">Max entries</label>
          <input id="giveaway-max" name="maxEntries" type="number" inputmode="numeric" autocomplete="off" value="3" />
        </div>
        <div>
          <label for="giveaway-role">Required Discord role</label>
          <select id="giveaway-role" name="requiredRoleId" aria-describedby="giveaway-role-note" ${state.admin.roleOptions.length ? '' : 'disabled'}>
            ${renderRoleOptions(state.admin.roleOptions)}
          </select>
          <p class="app-field-note" id="giveaway-role-note">${escapeHtml(renderRoleHelperText(rolePayload))}</p>
        </div>
      </div>
      <div>
        <label for="giveaway-description">Description</label>
        <textarea id="giveaway-description" name="description" autocomplete="off">Launch-ready clan giveaway.</textarea>
      </div>
      <div class="app-actions">
        <button class="button" type="submit">Create giveaway</button>
      </div>
    </form>
  `;
}

function renderAdminWomRefreshForm(payload) {
  return `
    <form class="app-form" id="wom-refresh-form">
      <p class="app-kicker">Wise Old Man</p>
      <h3>Refresh cache</h3>
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
        <div>
          <label for="wom-refresh-username">Username</label>
          <input id="wom-refresh-username" name="username" type="text" autocomplete="off" placeholder="Needed for player refresh..." />
        </div>
        <div>
          <label for="wom-refresh-competition-id">Competition ID</label>
          <input id="wom-refresh-competition-id" name="competitionId" type="number" inputmode="numeric" autocomplete="off" placeholder="Needed for competition refresh..." />
        </div>
        <div class="app-metric">
          <span>Current status</span>
          <strong>${payload.overview.wom?.configured ? 'Configured' : 'Not configured'}</strong>
        </div>
      </div>
      <div class="app-actions">
        <button class="button" type="submit">Refresh WOM data</button>
      </div>
    </form>
  `;
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
    return renderEmptyStateHtml('Wise Old Man is not configured on this Ghosted instance yet.');
  }

  if (womLink.linked) {
    return renderPanel({
      title: 'Wise Old Man link',
      chip: 'Linked',
      subtle: true,
      body: `
        <p>Linked to <strong>${escapeHtml(womLink.displayName || womLink.username)}</strong>.</p>
        <div class="app-actions">
          <button class="button button--secondary" type="button" data-wom-unlink>Remove local link</button>
        </div>
      `,
    });
  }

  return `
    <form class="app-form" id="wom-link-form">
      <p class="app-kicker">Wise Old Man</p>
      <h3>Link RuneScape account</h3>
      <p>Enter your RSN to sync Ghosted with WOM.</p>
      <div class="app-form-grid">
        <div>
          <label for="wom-username">RuneScape username</label>
          <input id="wom-username" name="username" type="text" autocomplete="off" spellcheck="false" placeholder="Your RSN..." />
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
    return `<section class="app-grid app-grid--two">
      ${renderPanel({
        eyebrow: 'OSRS sync',
        title: womLink.linked ? 'Waiting for profile data' : 'Link to unlock OSRS sync',
        chip: womLink.linked ? 'Loading' : 'Not linked',
        body: `<p>${womLink.linked
          ? 'Weekly gains and competition activity will appear here once WOM loads.'
          : 'Link your account above to unlock OSRS sync.'}</p>`,
      })}
    </section>`;
  }

  return `<section class="app-grid app-grid--two">
    ${renderPanel({
      eyebrow: 'Weekly gains',
      title: womProfile.player.displayName || womProfile.player.username,
      chip: 'WOM profile',
      body:
        renderMetricGrid([
          ['Total XP', formatMaybeNumber(womProfile.player.exp)],
          ['EHP', formatMaybeNumber(womProfile.player.ehp)],
          ['EHB', formatMaybeNumber(womProfile.player.ehb)],
          ['Last import', womProfile.player.lastImportedAt ? formatDate(womProfile.player.lastImportedAt) : 'Pending'],
        ]) +
        renderWomGainSummary(womProfile.gains),
    })}
    ${renderPanel({
      eyebrow: 'Achievements and competitions',
      title: 'Recent OSRS movement',
      chip: `${womProfile.competitions.length} ongoing`,
      body:
        renderAchievementFeed(womProfile.achievements.slice(0, 6)) +
        renderCompetitionList(womProfile.competitions.slice(0, 4), { compact: true }),
    })}
  </section>`;
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
      renderBanner(messageOf(error, 'Unable to link Wise Old Man account.'), 'error');
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
      renderBanner(messageOf(error, 'Unable to remove Wise Old Man link.'), 'error');
    }
  });
}

function renderClanPulse(clan) {
  return renderMetricGrid([
    ['Members', String(clan.group.memberCount || 0)],
    ['Maxed total', String(clan.statistics.maxedTotalCount || 0)],
    ['Average total', formatMaybeNumber(clan.statistics.averageOverallLevel)],
    ['Weekly leaders', String(clan.featuredGains.entries.length || 0)],
  ]);
}

function renderLeaderboardTable(entries, { valueLabel = 'Value', valueFormatter = String } = {}) {
  return renderDenseTable(
    ['Rank', 'Player', valueLabel],
    entries.map((entry) => [
      escapeHtml(String(entry.rank || '-')),
      escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown'),
      escapeHtml(valueFormatter(entry)),
    ]),
    'No entries available yet.'
  );
}

function renderAchievementFeed(entries) {
  if (!entries.length) {
    return renderEmptyStateHtml('No recent achievements yet.');
  }

  return `
    <div class="app-feed">
      ${entries.map((entry) => `
        <article class="app-feed__item">
          <strong>${escapeHtml(entry.name || 'Achievement')}</strong>
          <div class="app-muted">${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')} / ${entry.createdAt ? formatDate(entry.createdAt) : 'Recently'}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderActivityFeed(entries) {
  if (!entries.length) {
    return renderEmptyStateHtml('No recent activity yet.');
  }

  return `
    <div class="app-feed">
      ${entries.map((entry) => `
        <article class="app-feed__item">
          <strong>${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')}</strong>
          <div class="app-muted">${escapeHtml(entry.type || 'activity')} / ${entry.createdAt ? formatDate(entry.createdAt) : 'Recently'}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCompetitionList(entries, { compact = false } = {}) {
  if (!entries.length) {
    return renderEmptyStateHtml('No competitions are attached to the Ghosted WOM group yet.');
  }

  return `
    <div class="app-feed app-feed--timeline">
      ${entries.map((entry) => `
        <article class="app-feed__item ${compact ? 'is-compact' : ''}">
          <div class="app-card__row">
            <strong>${escapeHtml(entry.title || 'Competition')}</strong>
            <span class="app-chip">${escapeHtml(entry.status || 'unknown')}</span>
          </div>
          <div class="app-muted">${escapeHtml(entry.metric || 'overall')}</div>
          <div class="app-feed__meta">${formatCompetitionWindow(entry)}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCompetitionDetail(payload) {
  const competition = payload.competition;

  return [
    renderMetricGrid([
      ['Metric', competition.metric || 'overall'],
      ['Status', competition.status || 'unknown'],
      ['Starts', competition.startsAt ? formatDate(competition.startsAt) : 'TBD'],
      ['Ends', competition.endsAt ? formatDate(competition.endsAt) : 'TBD'],
    ]),
    renderLeaderboardTable(competition.participants || [], {
      valueFormatter: formatCompetitionProgress,
      valueLabel: 'Progress',
    }),
    renderSectionHeading({
      eyebrow: 'Top history',
      title: `${payload.topHistory.length} tracked players`,
    }),
    payload.topHistory.length
      ? `<div class="app-feed">
          ${payload.topHistory.map((entry) => `
            <article class="app-feed__item">
              <strong>${escapeHtml(entry.player?.displayName || entry.player?.username || 'Unknown')}</strong>
              <div class="app-muted">${entry.history.length} datapoint${entry.history.length === 1 ? '' : 's'}</div>
            </article>
          `).join('')}
        </div>`
      : renderEmptyStateHtml('No history has been recorded yet.'),
  ].join('');
}

function renderGiveawayPanel(item) {
  return renderPanel({
    title: item.title,
    chip: item.status,
    body: `
      ${item.description ? `<p class="app-panel-note">${escapeHtml(item.description)}</p>` : ''}
      ${renderMetricGrid([
        ['Cost', formatPoints(item.pointCost)],
        ['Entries', `${item.userEntries} / ${item.maxEntries}`],
        ['Closes', formatDate(item.endAt)],
        ['Access', item.requiredRole ? item.requiredRole.label : 'Linked members'],
      ])}
      <div class="app-actions">
        <button class="button" data-enter="${item.id}" ${item.canEnter ? '' : 'disabled'}>Enter</button>
      </div>
    `,
  });
}

function renderStatStrip(items) {
  return items.map((item) => {
    const normalized = Array.isArray(item)
      ? { label: item[0], value: item[1], href: null }
      : { href: null, ...item };
    const tag = normalized.href ? 'a' : 'article';
    const href = normalized.href ? ` href="${normalized.href}"` : '';
    const className = normalized.href ? 'app-stat app-stat--link' : 'app-stat';

    return `
      <${tag} class="${className}"${href}>
        <div class="app-stat__value">${escapeHtml(normalized.value)}</div>
        <div class="app-stat__label">${escapeHtml(normalized.label)}</div>
      </${tag}>
    `;
  }).join('');
}

function renderHighlight({ eyebrow = '', title, copy = '', actions = [], chips = [], theme = 'dashboard' }) {
  return `
    <section class="app-split-callout">
      <article class="app-highlight">
        <div class="app-highlight__content">
          ${eyebrow ? `<p class="app-kicker">${escapeHtml(eyebrow)}</p>` : ''}
          <h3>${escapeHtml(title)}</h3>
          <div class="app-inline-actions">
            ${actions.join('')}
          </div>
        </div>
        ${renderFlavorStage(theme, chips)}
      </article>
    </section>
  `;
}

function renderSectionHeading({ eyebrow = '', title, copy = '', action = '' }) {
  return `
    <div class="app-section-heading">
      <div>
        ${eyebrow ? `<p class="app-kicker">${escapeHtml(eyebrow)}</p>` : ''}
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${action || ''}
    </div>
  `;
}

function renderPanel({ eyebrow = '', title, chip = '', body = '', copy = '', href = '', link = false, subtle = false }) {
  const tag = href || link ? 'a' : 'article';
  const className = [href || link ? 'app-panel app-panel--link' : 'app-card', subtle ? 'app-card--subtle' : '']
    .filter(Boolean)
    .join(' ');
  const attrs = href || link ? ` href="${href || '#'}"` : '';

  return `
    <${tag} class="${className}"${attrs}>
      <div class="app-panel__header">
        <div>
          ${eyebrow ? `<p class="app-kicker">${escapeHtml(eyebrow)}</p>` : ''}
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${chip ? `<span class="app-chip">${escapeHtml(chip)}</span>` : ''}
      </div>
      <div class="app-panel__body">${body}</div>
    </${tag}>
  `;
}

function renderMetricGrid(items) {
  return `
    <div class="app-metric-grid">
      ${items.map(([label, value]) => `
        <div class="app-metric">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRouteList(routes) {
  return `
    <div class="app-route-list">
      ${routes.map((route) => `
        <a class="app-route ${route.featured ? 'app-route--featured' : ''}" href="${route.href}">
          <div>
            <strong>${escapeHtml(route.label)}</strong>
            ${route.copy ? `<p>${escapeHtml(route.copy)}</p>` : ''}
          </div>
          <span class="app-route__meta">${escapeHtml(route.meta)}</span>
        </a>
      `).join('')}
    </div>
  `;
}

function renderFlavorStage(theme, chips) {
  const themes = {
    admin: {
      label: 'Control room',
      title: 'Operator lane',
      art: ['/src/casino/assets/symbols/crown.svg', '/src/casino/assets/symbols/rune.svg'],
    },
    community: {
      label: 'Clan watch',
      title: 'Roster and comps',
      art: ['/src/casino/assets/symbols/rune.svg', '/src/casino/assets/symbols/ghost.svg'],
    },
    giveaways: {
      label: 'Drop board',
      title: 'Live entries',
      art: ['/src/casino/assets/symbols/scatter.svg', '/src/casino/assets/symbols/crown.svg'],
    },
    rewards: {
      label: 'Ledger',
      title: 'Balance rail',
      art: ['/src/casino/assets/symbols/coin.svg', '/src/casino/assets/symbols/rune.svg'],
    },
    dashboard: {
      label: 'Command center',
      title: 'Ghosted flow',
      art: ['/src/casino/assets/symbols/ghost.svg', '/src/casino/assets/symbols/rune.svg'],
    },
  };
  const selected = themes[theme] || themes.dashboard;
  return `
    <aside class="app-stage" aria-label="${escapeHtml(selected.label)}">
      <div class="app-stage__header">
        <span>${escapeHtml(selected.label)}</span>
        <strong>${escapeHtml(selected.title)}</strong>
      </div>
      <div class="app-stage__art">
        ${selected.art.map((src, index) => `
          <img src="${src}" alt="" class="app-stage__icon app-stage__icon--${index + 1}" />
        `).join('')}
      </div>
      <div class="app-stage__chips">
        ${chips.map((chip) => `<span class="app-chip">${escapeHtml(chip)}</span>`).join('')}
      </div>
    </aside>
  `;
}

function renderTagBlock(label, values, emptyMessage) {
  const tags = values?.length
    ? values.map((value) => `<span class="app-tag">${escapeHtml(value)}</span>`).join('')
    : `<span class="app-tag">${escapeHtml(emptyMessage)}</span>`;

  return `
    <div>
      <p class="app-muted">${escapeHtml(label)}</p>
      <div class="app-tags">${tags}</div>
    </div>
  `;
}

function renderDenseTable(columns, rows, emptyMessage) {
  if (!rows.length) {
    return renderEmptyStateHtml(emptyMessage);
  }

  return `
    <section class="app-table">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderLedgerTable(entries) {
  return renderDenseTable(
    ['When', 'Type', 'Description', 'Amount'],
    entries.map((entry) => [
      escapeHtml(formatDate(entry.createdAt)),
      escapeHtml(entry.entryType),
      escapeHtml(entry.description),
      `${entry.amount > 0 ? '+' : ''}${escapeHtml(formatPoints(entry.amount))}`,
    ]),
    'No activity yet.'
  );
}

function renderWomGainSummary(gains) {
  const records = Object.entries(gains || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 6);

  if (!records.length) {
    return '<p class="app-panel-note">No gain snapshot yet.</p>';
  }

  return `
    <div class="app-feed app-feed--timeline">
      ${records.map(([label, value]) => `
        <article class="app-feed__item is-compact">
          <strong>${escapeHtml(label.replaceAll('_', ' '))}</strong>
          <div class="app-feed__meta">${escapeHtml(formatMaybeNumber(value))}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderEmptyStateHtml(message, actionHtml = '') {
  return `
    <div class="app-empty">
      <p>${escapeHtml(message)}</p>
      ${actionHtml}
    </div>
  `;
}

function renderLinkButton(href, label, secondary = false) {
  return `<a class="button ${secondary ? 'button--secondary' : ''}" href="${href}">${escapeHtml(label)}</a>`;
}

function renderUserAvatar(user, className) {
  if (user.avatarUrl) {
    return `<img class="${className}" src="${user.avatarUrl}" alt="${escapeHtml(user.displayName)}" />`;
  }

  return `<div class="${className}">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</div>`;
}

function renderSignInState(root, message) {
  const loginHref = state.config.authConfigured
    ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}`
    : state.config.devAuthEnabled
      ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`
      : '';

  root.innerHTML = renderEmptyStateHtml(
    message,
    loginHref ? `<a class="button" href="${loginHref}">Sign In With Discord</a>` : '<p class="app-muted">Configure Discord auth env vars to enable sign-in.</p>'
  );
}

function renderBanner(message, variant = 'info', target = '[data-banner]') {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return;

  root.innerHTML = `<div class="app-banner ${variant === 'error' ? 'is-error' : variant === 'warning' ? 'is-warning' : ''}" role="${variant === 'error' ? 'alert' : 'status'}">${escapeHtml(message)}</div>`;
  window.GhostedSite?.announce?.(message);
}

function giveawaySortRank(status) {
  if (status === 'active') return 0;
  if (status === 'scheduled') return 1;
  return 2;
}

function formatMaybeNumber(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return shortNumberFormatter.format(numeric);
}

function formatHiscoreValue(entry) {
  const data = entry.raw || {};
  const raw = data.experience ?? data.kills ?? data.score ?? data.value ?? entry.value ?? 0;
  const rank = data.rank ? `Rank ${data.rank}` : 'Unranked';
  return `${formatMaybeNumber(raw)} / ${rank}`;
}

function formatGainValue(entry) {
  return `${formatMaybeNumber(entry.gained || 0)} gained`;
}

function formatCompetitionProgress(entry) {
  const gained = entry.progress?.gained ?? entry.raw?.gained ?? 0;
  const start = entry.progress?.start;
  const end = entry.progress?.end;
  if (start !== undefined && end !== undefined) {
    return `${formatMaybeNumber(gained)} gained (${formatMaybeNumber(start)} to ${formatMaybeNumber(end)})`;
  }
  return `${formatMaybeNumber(gained)} gained`;
}

function formatCompetitionWindow(entry) {
  const starts = entry.startsAt ? formatDate(entry.startsAt) : 'TBD';
  const ends = entry.endsAt ? formatDate(entry.endsAt) : 'TBD';
  return `${starts} to ${ends}`;
}

function formatPoints(value) {
  return `${numberFormatter.format(Number(value || 0))} pts`;
}

function formatPointsFull(value) {
  return `${numberFormatter.format(Number(value || 0))} points`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return dateTimeFormatter.format(date);
}

function toIsoLocal(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function messageOf(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
