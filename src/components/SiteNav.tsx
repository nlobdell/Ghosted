'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthWidget } from './AuthWidget';

const NAV_LINKS = [
  { key: 'home', label: 'Home',    href: '/' },
  { key: 'app',  label: 'App Hub', href: '/app/' },
];

const EXTERNAL_LINKS = [
  { label: 'Twitch',  href: 'https://www.twitch.tv/vghosted' },
  { label: 'Discord', href: 'https://discord.gg/ghosted' },
];

function getActiveKey(path: string) {
  if (path === '/') return 'home';
  if (path.startsWith('/app')) return 'app';
  return '';
}

export function SiteNav() {
  const active = getActiveKey(usePathname());
  const [open, setOpen] = useState(false);

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="nav-shell">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-dot" aria-hidden="true" />
          <span className="nav-brand__copy">
            <strong>Ghosted</strong>
            <span>Clan hall</span>
          </span>
        </Link>

        <div className="nav-links">
          <div className="nav-link-group">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="nav-link"
                aria-current={active === link.key ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="nav-utility-links">
            {EXTERNAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link nav-link--small"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="nav-auth">
          <AuthWidget variant="public" />
        </div>

        <button
          type="button"
          className="nav-toggle button button--secondary button--small"
          aria-expanded={open}
          aria-controls="site-nav-drawer"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      {open && (
        <div id="site-nav-drawer" className="nav-drawer">
          <div
            className="nav-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="nav-drawer-panel"
          >
            <div className="nav-drawer-header">
              <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
                <span className="nav-brand-dot" aria-hidden="true" />
                <span className="nav-brand__copy">
                  <strong>Ghosted</strong>
                  <span>Clan hall</span>
                </span>
              </Link>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                Close
              </button>
            </div>

            <AuthWidget variant="mobile" />

            <div className="nav-drawer-links">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="nav-link"
                  aria-current={active === link.key ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
