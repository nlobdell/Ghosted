(function () {
    const state = {
        initialized: false,
        pendingHref: '',
        navRoot: null,
        trigger: null,
        restoreFocus: true,
        shellPromise: null,
        shellData: null,
        shellNextPath: '',
    };

    const numberFormatter = new Intl.NumberFormat();
    const SHELL_DEFAULTS = {
        brand: {
            label: 'Ghosted',
            href: '/',
        },
        links: {
            twitch: {
                key: 'twitch',
                label: 'Twitch',
                href: 'https://www.twitch.tv/vghosted',
                rel: 'noopener noreferrer',
                presentation: 'link',
            },
            discord: {
                key: 'discord',
                label: 'Discord',
                href: 'https://discord.gg/ghosted',
                target: '_blank',
                rel: 'noopener noreferrer',
                presentation: 'button',
            },
        },
        utilityGroups: {
            public: ['twitch', 'discord'],
            app: ['twitch'],
        },
    };

    function ensureLiveRegion() {
        let region = document.querySelector('[data-site-live-region]');
        if (region) return region;
        region = document.createElement('div');
        region.className = 'site-live-region';
        region.setAttribute('data-site-live-region', '');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        document.body.appendChild(region);
        return region;
    }

    function announce(message) {
        if (!message) return;
        const region = ensureLiveRegion();
        region.textContent = '';
        window.setTimeout(() => {
            region.textContent = String(message);
        }, 20);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function renderAvatar(user, className) {
        const label = escapeHtml(user?.displayName || user?.username || 'Ghosted');
        if (user?.avatarUrl) {
            return `<img class="${className}" src="${user.avatarUrl}" alt="${label}" />`;
        }
        const fallback = escapeHtml(String(user?.displayName || user?.username || 'G').slice(0, 1).toUpperCase());
        return `<div class="${className}">${fallback}</div>`;
    }

    function normalizePath(path) {
        const value = String(path || '/').trim() || '/';
        return value.startsWith('/') ? value : '/';
    }

    function formatPoints(value) {
        return `${numberFormatter.format(Number(value || 0))} pts`;
    }

    function womRankLabel(shell) {
        const membership = shell?.wom?.membership;
        if (membership?.rankLabel) return membership.rankLabel;
        if (membership?.role) return membership.role;
        if (shell?.wom?.linked) return shell?.wom?.inGroup ? 'Member' : 'Linked, not in Ghosted group';
        return 'Discord only';
    }

    function womStatusLine(shell) {
        const wom = shell?.wom || {};
        if (!wom.configured) return 'Wise Old Man offline';
        if (!wom.linked) return 'Link your RSN from Profile';
        if (!wom.inGroup) return 'Linked, not in Ghosted group';
        return `${womRankLabel(shell)}${wom.membership?.groupName ? ` in ${wom.membership.groupName}` : ''}`;
    }

    function renderSignedInWidget(shell, variant) {
        const user = shell.user || {};
        const compact = variant === 'public';
        const mobile = variant === 'mobile';
        const subtitle = compact
            ? `${formatPoints(user.balance)} | ${womRankLabel(shell)}`
            : `${womStatusLine(shell)} | ${formatPoints(user.balance)}`;

        return `
      <div class="site-profile-widget site-profile-widget--signed-in site-profile-widget--${variant}">
        <a class="site-profile-widget__card" href="/app/profile/">
          ${renderAvatar(user, 'site-profile-widget__avatar')}
          <span class="site-profile-widget__copy">
            <strong>${escapeHtml(user.displayName || user.username || 'Ghosted member')}</strong>
            <span>${escapeHtml(subtitle)}</span>
          </span>
        </a>
        <div class="site-profile-widget__actions">
          ${user.isAdmin ? '<a class="button button--secondary button--small" href="/admin/">Admin</a>' : ''}
          <button class="button button--secondary button--small" type="button" data-site-logout>${mobile ? 'Log out' : 'Log Out'}</button>
        </div>
      </div>
    `;
    }

    function renderSignedOutWidget(shell, variant) {
        const canSignIn = !!shell?.auth?.canSignIn && !!shell?.auth?.loginHref;
        const compact = variant === 'public';
        return `
      <div class="site-profile-widget site-profile-widget--signed-out site-profile-widget--${variant}">
        <div class="site-profile-widget__copy">
          <strong>${compact ? 'Member access' : 'Sign in to Ghosted'}</strong>
          <span>${escapeHtml(shell?.wom?.configured ? 'Sync Discord, profile, and WOM status.' : 'Discord auth is available once configured.')}</span>
        </div>
        ${canSignIn
            ? `<a class="button button--small" href="${shell.auth.loginHref}">Sign In</a>`
            : '<span class="site-profile-widget__meta">Sign-in unavailable</span>'}
      </div>
    `;
    }

    function inferDesktopVariant(root) {
        if (root.classList.contains('app-auth')) return 'app';
        return root.dataset.siteAuthVariant || 'public';
    }

    function shellBrand(shell) {
        return shell?.brand || SHELL_DEFAULTS.brand;
    }

    function shellLinks(shell) {
        return shell?.links || SHELL_DEFAULTS.links;
    }

    function shellUtilityGroups(shell) {
        return shell?.utilityGroups || SHELL_DEFAULTS.utilityGroups;
    }

    function shellNavigation(shell) {
        return Array.isArray(shell?.navigation) ? shell.navigation : [];
    }

    function activeRouteKey(shell) {
        return shell?.activeRouteKey || '';
    }

    function renderAnchor(link, className, options = {}) {
        const attrs = [
            `class="${escapeHtml(className)}"`,
            `href="${escapeHtml(link.href)}"`,
        ];
        if (link.target) {
            attrs.push(`target="${escapeHtml(link.target)}"`);
        }
        if (link.rel) {
            attrs.push(`rel="${escapeHtml(link.rel)}"`);
        }
        if (options.key) {
            attrs.push(`data-site-nav-key="${escapeHtml(options.key)}"`);
        }
        if (options.active) {
            attrs.push('aria-current="page"');
        }
        return `<a ${attrs.join(' ')}>${escapeHtml(link.label)}</a>`;
    }

    function utilityLinksForGroup(shell, groupKey) {
        const groups = shellUtilityGroups(shell);
        const links = shellLinks(shell);
        return (groups[groupKey] || [])
            .map((key) => links[key])
            .filter(Boolean);
    }

    function renderUtilityLink(link, mount) {
        const linkClass = mount.dataset.siteLinkClass || '';
        const buttonClass = mount.dataset.siteButtonClass || linkClass || 'button button--small';
        const useButtonStyle = link.presentation === 'button' && !!buttonClass;
        const className = useButtonStyle ? buttonClass : (linkClass || buttonClass);
        return renderAnchor(link, className);
    }

    function renderUtilityGroup(shell, mount) {
        const groupKey = mount.dataset.siteUtilityGroup || '';
        return utilityLinksForGroup(shell, groupKey)
            .map((link) => renderUtilityLink(link, mount))
            .join('');
    }

    function renderNavigationMount(shell, mount) {
        const navLinkClass = mount.dataset.siteNavLinkClass || 'nav__link';
        const currentKey = activeRouteKey(shell);
        let html = shellNavigation(shell)
            .map((item) => {
                const isActive = item.key === currentKey;
                return renderAnchor(item, `${navLinkClass}${isActive ? ' is-active' : ''}`, {
                    key: item.key,
                    active: isActive,
                });
            })
            .join('');

        if (mount.dataset.siteUtilityGroup) {
            html += renderUtilityGroup(shell, mount);
        }

        mount.innerHTML = html;
    }

    function renderBrandMounts(shell) {
        const brand = shellBrand(shell);
        document.querySelectorAll('[data-site-brand]').forEach((anchor) => {
            anchor.textContent = brand.label;
            anchor.setAttribute('href', brand.href);
        });
    }

    function renderSiteShell(shell) {
        renderBrandMounts(shell);

        document.querySelectorAll('[data-site-nav], [data-site-nav-desktop]').forEach((mount) => {
            renderNavigationMount(shell, mount);
        });

        document.querySelectorAll('[data-site-utility-links]').forEach((mount) => {
            mount.innerHTML = renderUtilityGroup(shell, mount);
        });

        document.querySelectorAll('[data-auth]').forEach((root) => {
            const variant = root.dataset.siteAuthVariant || inferDesktopVariant(root);
            root.innerHTML = shell?.authenticated && shell?.user
                ? renderSignedInWidget(shell, variant)
                : renderSignedOutWidget(shell, variant);
        });
    }

    async function fetchShell({ nextPath = window.location.pathname } = {}) {
        const normalizedNext = normalizePath(nextPath);
        const response = await fetch(`/api/site-shell?next=${encodeURIComponent(normalizedNext)}`, {
            headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to load Ghosted site shell.');
        }
        state.shellData = payload;
        state.shellNextPath = normalizedNext;
        renderSiteShell(payload);
        return payload;
    }

    function getShell(options = {}) {
        const normalizedNext = normalizePath(options.nextPath || window.location.pathname);
        if (state.shellData && state.shellNextPath === normalizedNext) {
            renderSiteShell(state.shellData);
            return Promise.resolve(state.shellData);
        }
        if (!state.shellPromise || state.shellNextPath !== normalizedNext) {
            state.shellNextPath = normalizedNext;
            state.shellPromise = fetchShell({ nextPath: normalizedNext }).finally(() => {
                state.shellPromise = null;
            });
        }
        return state.shellPromise;
    }

    function refreshShell(options = {}) {
        return fetchShell(options);
    }

    async function logout() {
        const response = await fetch('/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error('Unable to sign out right now.');
        }
        state.shellData = null;
        state.shellNextPath = '';
        window.location.reload();
    }

    function renderTwitchDialog() {
        return `
      <dialog class="site-dialog" data-site-twitch-confirm aria-labelledby="site-twitch-confirm-title" aria-describedby="site-twitch-confirm-description">
        <form method="dialog" class="site-dialog__body">
          <div>
            <p class="eyebrow">Leave Ghosted</p>
            <h2 id="site-twitch-confirm-title">Open Twitch?</h2>
            <p id="site-twitch-confirm-description">You are about to leave Ghosted and open the live vghosted Twitch channel in this tab.</p>
          </div>
          <div class="site-dialog__actions">
            <button class="button button--secondary" type="button" data-site-twitch-cancel>Stay here</button>
            <button class="button" type="button" data-site-twitch-confirm-open>Open Twitch</button>
          </div>
        </form>
      </dialog>
    `;
    }

    function ensureDialog() {
        let dialog = document.querySelector('[data-site-twitch-confirm]');
        if (dialog) return dialog;
        document.body.insertAdjacentHTML('beforeend', renderTwitchDialog());
        dialog = document.querySelector('[data-site-twitch-confirm]');
        dialog?.querySelector('[data-site-twitch-cancel]')?.addEventListener('click', closeDialog);
        dialog?.querySelector('[data-site-twitch-confirm-open]')?.addEventListener('click', confirmLeave);
        dialog?.addEventListener('close', handleDialogClosed);
        return dialog;
    }

    function handleDialogClosed() {
        document.body.classList.remove('has-site-dialog-open');
        const trigger = state.trigger;
        const shouldRestoreFocus = state.restoreFocus;
        state.pendingHref = '';
        state.trigger = null;
        state.restoreFocus = true;

        if (shouldRestoreFocus && trigger && typeof trigger.focus === 'function') {
            window.requestAnimationFrame(() => trigger.focus());
        }
    }

    function shouldConfirmTwitchLink(link) {
        try {
            const url = new URL(link.href, window.location.origin);
            const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
            const path = url.pathname.replace(/\/+$/, '').toLowerCase();
            return hostname === 'twitch.tv' && path === '/vghosted';
        } catch {
            return false;
        }
    }

    function openDialog(link) {
        const dialog = ensureDialog();
        if (!dialog) return;

        state.pendingHref = link.href;
        state.trigger = link;
        state.restoreFocus = true;
        document.body.classList.add('has-site-dialog-open');

        if (dialog.hasAttribute('open')) {
            dialog.querySelector('[data-site-twitch-confirm-open]')?.focus();
            return;
        }

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', 'open');
        }

        dialog.querySelector('[data-site-twitch-confirm-open]')?.focus();
    }

    function closeDialog() {
        const dialog = document.querySelector('[data-site-twitch-confirm]');
        if (!dialog) return;

        if (typeof dialog.close === 'function' && dialog.hasAttribute('open')) {
            dialog.close();
            return;
        }

        dialog.removeAttribute('open');
        handleDialogClosed();
    }

    function confirmLeave() {
        if (!state.pendingHref) {
            closeDialog();
            return;
        }

        const href = state.pendingHref;
        state.restoreFocus = false;

        const dialog = document.querySelector('[data-site-twitch-confirm]');
        if (dialog) {
            if (typeof dialog.close === 'function' && dialog.hasAttribute('open')) {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
                handleDialogClosed();
            }
        }

        window.location.assign(href);
    }

    function handleDocumentClick(event) {
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

        const logoutButton = event.target.closest('[data-site-logout]');
        if (logoutButton) {
            event.preventDefault();
            logout().catch((error) => announce(error instanceof Error ? error.message : 'Unable to sign out right now.'));
            return;
        }

        const link = event.target.closest('a[href]');
        if (!link) return;

        if (state.navRoot) {
            const panel = state.navRoot.querySelector('.site-nav-panel');
            if (panel && panel.contains(link)) {
                closeNav({ root: state.navRoot, restoreFocus: false });
            }
        }

        if (!shouldConfirmTwitchLink(link)) return;

        event.preventDefault();
        openDialog(link);
    }

    function getFocusableElements(root) {
        if (!root) return [];
        return Array.from(
            root.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);
    }

    function getNavDrawer(root) {
        return root?.querySelector('[data-site-nav-drawer]') || root?.querySelector('.site-nav-drawer') || null;
    }

    function openNav(root) {
        if (!root) return;

        const drawer = getNavDrawer(root);
        const toggle = root.querySelector('[data-site-menu-toggle]');
        if (!drawer) return;

        root.setAttribute('data-nav-open', 'true');
        toggle?.setAttribute('aria-expanded', 'true');
        drawer.removeAttribute('hidden');
        document.body.classList.add('has-site-nav-open');
        state.navRoot = root;
        state.trigger = toggle || null;

        window.requestAnimationFrame(() => {
            const focusable = getFocusableElements(drawer);
            focusable[0]?.focus();
        });
    }

    function closeNav({ root = state.navRoot, restoreFocus = true } = {}) {
        if (!root) return;

        const drawer = getNavDrawer(root);
        const toggle = root.querySelector('[data-site-menu-toggle]');

        root.removeAttribute('data-nav-open');
        toggle?.setAttribute('aria-expanded', 'false');
        drawer?.setAttribute('hidden', '');
        document.body.classList.remove('has-site-nav-open');

        if (state.navRoot === root) {
            state.navRoot = null;
        }

        if (restoreFocus) {
            window.requestAnimationFrame(() => toggle?.focus());
        }
    }

    function handleNavKeydown(event) {
        const root = state.navRoot;
        if (!root || root.getAttribute('data-nav-open') !== 'true') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeNav();
            return;
        }

        if (event.key !== 'Tab') return;

        const drawer = getNavDrawer(root);
        const focusable = getFocusableElements(drawer);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function bindNav() {
        const roots = document.querySelectorAll('[data-site-shell]');
        if (!roots.length) return;

        roots.forEach((root) => {
            const toggle = root.querySelector('[data-site-menu-toggle]');
            const closeButtons = root.querySelectorAll('[data-site-nav-close]');
            const drawer = getNavDrawer(root);

            toggle?.setAttribute('aria-expanded', 'false');
            drawer?.setAttribute('hidden', '');

            toggle?.addEventListener('click', () => {
                if (root.getAttribute('data-nav-open') === 'true') {
                    closeNav({ root });
                } else {
                    openNav(root);
                }
            });

            closeButtons.forEach((button) => {
                button.addEventListener('click', () => closeNav({ root, restoreFocus: false }));
            });
        });

        document.addEventListener('keydown', handleNavKeydown);

        window.addEventListener('resize', () => {
            if (window.innerWidth > 980 && state.navRoot) {
                closeNav({ root: state.navRoot, restoreFocus: false });
            }
        });
    }

    function init() {
        if (state.initialized) return;
        state.initialized = true;

        ensureLiveRegion();
        ensureDialog();
        bindNav();
        document.addEventListener('click', handleDocumentClick);

        const year = document.getElementById('year');
        if (year) {
            year.textContent = String(new Date().getFullYear());
        }

        getShell().catch((error) => {
            announce(error instanceof Error ? error.message : 'Unable to load Ghosted shell.');
        });

        window.GhostedSite = {
            announce,
            getShell,
            refreshShell,
            logout,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
