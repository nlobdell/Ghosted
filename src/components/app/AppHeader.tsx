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
        <div className="nav-inner">

          {/* Logo */}
          <Link href="/" className="nav-brand">
            <span className="nav-brand-dot" aria-hidden="true" />
            Ghosted
          </Link>

          {/* Desktop nav (hidden on mobile via CSS) */}
          <nav aria-label="App navigation" className="nav-links">
            {APP_NAV.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                className="nav-link nav-link--sm"
                aria-current={active === l.key ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop tools (hidden on mobile via CSS) */}
          <div className="nav-auth">
            <a
              href="https://www.twitch.tv/vghosted"
              target="_blank"
              rel="noopener noreferrer"
              className="button button--secondary button--small"
            >
              Twitch
            </a>
            <AuthWidget variant="app" />
          </div>

          {/* Mobile toggle (hidden on desktop via CSS) */}
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

      {/* Mobile drawer */}
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

            <nav aria-label="App navigation" className="nav-drawer-links">
              {APP_NAV.map((l) => (
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
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
