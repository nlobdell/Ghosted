'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { GhostedLogo } from '@/components/GhostedLogo';

const PUBLIC_LINKS = [
  { href: '/roster/', label: 'Roster' },
  { href: '/news/', label: 'News' },
  { href: '/media/', label: 'Media' },
  { href: '/about/', label: 'About' },
];

export function PublicNav({ hallHref }: { hallHref: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = 'ghosted-public-nav-drawer';

  function isActive(href: string) {
    const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedHref = href !== '/' && href.endsWith('/') ? href.slice(0, -1) : href;
    if (normalizedHref === '/') return normalizedPath === '/';
    return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
  }

  return (
    <header className="site-nav site-nav--revealed">
      <div className="container">
        <div className="nav-shell nav-shell--public">
          <div className="nav-slot nav-slot--brand">
            <Link href="/" className="nav-brand">
              <GhostedLogo className="nav-brand-logo" sizes="44px" decorative />
              <span className="nav-brand__copy">
                <strong>Ghosted</strong>
                <span>Discord-first clan</span>
              </span>
            </Link>
          </div>

          <div className="nav-slot nav-slot--links">
            <nav aria-label="Public navigation" className="nav-links">
              <div className="nav-link-group">
                {PUBLIC_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="nav-link nav-link--small"
                    aria-current={isActive(link.href) ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>

          <div className="nav-slot nav-slot--cta">
            <Link href={hallHref} className="button button--small">
              Enter the Hall
            </Link>
          </div>

          <button
            type="button"
            className="nav-toggle button button--secondary button--small"
            aria-expanded={open}
            aria-controls={drawerId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <div id={drawerId} className="nav-drawer">
          <div className="nav-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Public navigation" className="nav-drawer-panel">
            <div className="nav-drawer-header">
              <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
                <GhostedLogo className="nav-brand-logo nav-brand-logo--drawer" sizes="48px" decorative />
                <span className="nav-brand__copy">
                  <strong>Ghosted</strong>
                  <span>Public layer</span>
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
            <div className="nav-drawer-links">
              {PUBLIC_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link"
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href={hallHref} className="button" onClick={() => setOpen(false)}>
                Enter the Hall
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
