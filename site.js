(function () {
  const state = {
    initialized: false,
    pendingHref: '',
    navRoot: null,
    trigger: null,
    restoreFocus: true,
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
    if (dialog.hasAttribute('open')) {
      dialog.querySelector('[data-site-twitch-confirm-open]')?.focus();
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      document.body.classList.add('has-site-dialog-open');
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
    const link = event.target.closest('a[href]');
    if (!link || !shouldConfirmTwitchLink(link)) return;
    event.preventDefault();
    openDialog(link);
  }

  function openNav() {
    const root = document.querySelector('[data-site-shell]');
    if (!root) return;
    root.setAttribute('data-nav-open', 'true');
    document.body.classList.add('has-site-nav-open');
    state.navRoot = root;
    window.requestAnimationFrame(() => {
      root.querySelector('[data-site-nav] a, [data-site-nav] button')?.focus();
    });
  }

  function closeNav({ restoreFocus = true } = {}) {
    const root = state.navRoot || document.querySelector('[data-site-shell]');
    if (!root) return;
    root.removeAttribute('data-nav-open');
    document.body.classList.remove('has-site-nav-open');
    const toggle = root.querySelector('[data-site-menu-toggle]');
    state.navRoot = null;
    if (restoreFocus) {
      window.requestAnimationFrame(() => toggle?.focus());
    }
  }

  function bindNav() {
    const root = document.querySelector('[data-site-shell]');
    if (!root) return;
    const toggle = root.querySelector('[data-site-menu-toggle]');
    const close = root.querySelector('[data-site-nav-close]');
    const links = root.querySelectorAll('[data-site-nav] a[href]');

    toggle?.addEventListener('click', () => {
      if (root.getAttribute('data-nav-open') === 'true') {
        closeNav();
        return;
      }
      openNav();
    });
    close?.addEventListener('click', () => closeNav());
    links.forEach((link) => link.addEventListener('click', () => closeNav({ restoreFocus: false })));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root.getAttribute('data-nav-open') === 'true') {
        closeNav();
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
    window.GhostedSite = {
      announce,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
