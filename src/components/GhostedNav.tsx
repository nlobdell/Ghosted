'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthWidget } from '@/components/AuthWidget';
import { GhostedLogo } from '@/components/GhostedLogo';
import type { ShellData } from '@/lib/types';
import {
  EXTERNAL_NAV_LINKS,
  NAV_GROUP_LABELS,
  getActiveNavKey,
  getVisibleGroupedLinks,
} from '@/lib/navigation';

export function GhostedNav({ sticky = false }: { sticky?: boolean }) {
  const pathname = usePathname();
  const activeKey = getActiveNavKey(pathname);
  const [open, setOpen] = useState(false);
  const [shell, setShell] = useState<ShellData | null>(null);
  const [hasScrolledPastThreshold, setHasScrolledPastThreshold] = useState(false);

  useEffect(() => {
    fetch(`/api/site-shell?next=${encodeURIComponent(window.location.pathname)}`, {
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.json())
      .then(setShell)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (sticky) return;

    const onScroll = () => {
      setHasScrolledPastThreshold(window.scrollY > 28);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sticky]);

  const viewer = {
    authenticated: Boolean(shell?.authenticated),
    isAdmin: Boolean(shell?.user?.isAdmin),
  };
  const groupedLinks = getVisibleGroupedLinks(viewer);
  const drawerId = 'ghosted-nav-drawer';
  const revealed = sticky || hasScrolledPastThreshold;
  const wrapperClassName = sticky ? 'app-header' : `site-nav${revealed ? ' site-nav--revealed' : ''}`;

  const navShell = (
    <div className="nav-shell">
      <div className="nav-slot nav-slot--brand">
        <Link href="/" className="nav-brand">
          <GhostedLogo className="nav-brand-logo" sizes="44px" decorative />
          <span className="nav-brand__copy">
            <strong>Ghosted</strong>
            <span>Clan hall</span>
          </span>
        </Link>
      </div>

      <div className="nav-slot nav-slot--links">
        <nav aria-label="Primary navigation" className="nav-links">
          <div className="nav-link-group">
            {groupedLinks.map((bucket, bucketIndex) => (
              <span key={bucketIndex} className="nav-bucket">
                {bucketIndex > 0 && bucket.group !== undefined && (
                  <span className="nav-divider" aria-hidden="true" />
                )}
                {bucket.links.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="nav-link nav-link--small"
                    aria-current={activeKey === link.key ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </span>
            ))}
          </div>
          <div className="nav-utility-links">
            {EXTERNAL_NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link nav-link--small nav-link--utility"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <div className="nav-slot nav-slot--auth">
        <div className="nav-auth">
          <AuthWidget variant="public" shellData={shell} />
        </div>
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
  );

  const drawer = open ? (
    <div id={drawerId} className="nav-drawer">
      <div className="nav-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Primary navigation" className="nav-drawer-panel">
        <div className="nav-drawer-header">
          <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
            <GhostedLogo className="nav-brand-logo nav-brand-logo--drawer" sizes="48px" decorative />
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

        <AuthWidget variant="mobile" shellData={shell} />

        <div className="nav-drawer-links">
          {groupedLinks.map((bucket, bucketIndex) => {
            const groupLabel = bucket.group ? NAV_GROUP_LABELS[bucket.group] : null;
            return (
              <div key={bucketIndex} className={groupLabel ? 'nav-drawer-group' : undefined}>
                {groupLabel ? (
                  <span className="nav-drawer-group__label">{groupLabel}</span>
                ) : null}
                {bucket.links.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="nav-link"
                    aria-current={activeKey === link.key ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            );
          })}
          {EXTERNAL_NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link nav-link--utility"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (sticky) {
    return (
      <header className={wrapperClassName}>
        <div className="container">{navShell}</div>
        {drawer}
      </header>
    );
  }

  if (!revealed) {
    return null;
  }

  return (
    <nav className={wrapperClassName} aria-label="Primary navigation">
      <div className="container">
        {navShell}
      </div>
      {drawer}
    </nav>
  );
}
