'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthWidget } from '@/components/AuthWidget';

const APP_NAV = [
  { key: 'community',   label: 'Community',   href: '/app/community/' },
  { key: 'competitions',label: 'Competitions', href: '/app/competitions/' },
  { key: 'rewards',     label: 'Rewards',      href: '/app/rewards/' },
  { key: 'giveaways',   label: 'Giveaways',    href: '/app/giveaways/' },
  { key: 'profile',     label: 'Profile',      href: '/app/profile/' },
  { key: 'casino',      label: 'Casino',       href: '/app/casino/' },
];

function getActiveKey(path: string) {
  if (path.startsWith('/app/community') || path.startsWith('/app/clan')) return 'community';
  if (path.startsWith('/app/competitions')) return 'competitions';
  if (path.startsWith('/app/rewards'))      return 'rewards';
  if (path.startsWith('/app/giveaways'))    return 'giveaways';
  if (path.startsWith('/app/profile'))      return 'profile';
  if (path.startsWith('/app/casino'))       return 'casino';
  return '';
}

export function AppHeader() {
  const active = getActiveKey(usePathname());
  const [open, setOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="container">
        <div className="nav-shell nav-shell--app">
          <Link href="/" className="nav-brand">
            <span className="nav-brand-dot" aria-hidden="true" />
            <span className="nav-brand__copy">
              <strong>Ghosted</strong>
              <span>Member tools</span>
            </span>
          </Link>

          <nav aria-label="App navigation" className="nav-links">
            <div className="nav-link-group">
              {APP_NAV.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="nav-link nav-link--small"
                  aria-current={active === link.key ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="nav-auth">
            <a
              href="https://www.twitch.tv/vghosted"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link nav-link--small"
            >
              Twitch
            </a>
            <AuthWidget variant="app" />
          </div>

          <button
            type="button"
            className="nav-toggle button button--secondary button--small"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-drawer">
          <div
            className="nav-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="App navigation"
            className="nav-drawer-panel"
          >
            <div className="nav-drawer-header">
              <Link href="/" className="nav-brand">
                <span className="nav-brand-dot" aria-hidden="true" />
                <span className="nav-brand__copy">
                  <strong>Ghosted</strong>
                  <span>Member tools</span>
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

            <nav aria-label="App navigation" className="nav-drawer-links">
              {APP_NAV.map((link) => (
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
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
