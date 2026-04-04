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
      <div className="nav-inner">

        {/* Logo */}
        <Link href="/" className="nav-brand">
          <span className="nav-brand-dot" aria-hidden="true" />
          Ghosted
        </Link>

        {/* Desktop links (hidden on mobile via CSS) */}
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="nav-link"
              aria-current={active === l.key ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
          {EXTERNAL_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--small"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop auth (hidden on mobile via CSS) */}
        <div className="nav-auth">
          <AuthWidget variant="public" />
        </div>

        {/* Mobile toggle (hidden on desktop via CSS) */}
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

      {/* Mobile drawer */}
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
                Ghosted
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
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  className="nav-link"
                  aria-current={active === l.key ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              {EXTERNAL_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--small"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
