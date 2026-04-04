'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthWidget } from '@/components/AuthWidget';

const APP_NAV = [
  { key: 'community', label: 'Community', href: '/app/community/' },
  { key: 'competitions', label: 'Competitions', href: '/app/competitions/' },
  { key: 'rewards', label: 'Rewards', href: '/app/rewards/' },
  { key: 'giveaways', label: 'Giveaways', href: '/app/giveaways/' },
  { key: 'profile', label: 'Profile', href: '/app/profile/' },
  { key: 'casino', label: 'Casino', href: '/app/casino/' },
];

function getActiveKey(path: string): string {
  if (path.startsWith('/app/community') || path.startsWith('/app/clan')) return 'community';
  if (path.startsWith('/app/competitions')) return 'competitions';
  if (path.startsWith('/app/rewards')) return 'rewards';
  if (path.startsWith('/app/giveaways')) return 'giveaways';
  if (path.startsWith('/app/profile')) return 'profile';
  if (path.startsWith('/app/casino')) return 'casino';
  return '';
}

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '2.55rem',
  padding: '0.45rem 0.78rem',
  borderRadius: '999px',
  color: active ? '#f3f1f9' : '#9d96ad',
  background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
  textDecoration: 'none',
  fontSize: '0.88rem',
  fontWeight: 700,
  letterSpacing: '0.01em',
  transition: 'color var(--ease-standard), background-color var(--ease-standard)',
});

export function AppHeader() {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);
  const [open, setOpen] = useState(false);

  return (
    <header
      className="app-page"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        paddingTop: 'calc(var(--safe-top) + 0.85rem)',
        background: 'transparent',
      }}
    >
      <div
        style={{
          width: `min(1180px, calc(100vw - 2rem))`,
          marginInline: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          minHeight: 'var(--spacing-header)',
          padding: '0.85rem 1.1rem',
          border: '1px solid rgba(255, 244, 224, 0.08)',
          borderRadius: '999px',
          background: 'rgba(10, 9, 11, 0.76)',
          backdropFilter: 'blur(18px)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <Link
          href="/"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          <span style={{ display: 'inline-block', width: '0.85rem', height: '0.85rem', borderRadius: '0.28rem', background: 'linear-gradient(135deg, #9b6bff, #5f4b8b)', boxShadow: '0 0 20px rgba(155, 107, 255, 0.28)', transform: 'rotate(45deg)', flexShrink: 0 }} aria-hidden="true" />
          Ghosted
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginLeft: 'auto' }}
          className="app-nav--desktop"
        >
          {APP_NAV.map((link) => (
            <Link key={link.key} href={link.href} style={navLinkStyle(activeKey === link.key)} aria-current={activeKey === link.key ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginLeft: '0.85rem' }}>
          <a
            href="https://www.twitch.tv/vghosted"
            rel="noopener noreferrer"
            className="button button--secondary button--small app-header__utility"
            style={{ whiteSpace: 'nowrap' }}
          >
            Twitch
          </a>
          <div className="app-auth" style={{ display: 'flex', alignItems: 'center' }}>
            <AuthWidget variant="app" />
          </div>
          <button
            className="button button--secondary button--small site-menu-toggle"
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'none' }}
          >
            <span aria-hidden="true" style={{ display: 'block', width: '1.1rem', height: '2px', borderRadius: '999px', background: 'currentColor' }} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,4,6,0.72)', backdropFilter: 'blur(8px)' }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog" aria-modal="true" aria-label="Primary navigation"
            style={{ position: 'absolute', top: 0, right: 0, width: 'min(24rem, calc(100vw - 1rem))', height: '100dvh', padding: 'max(1rem, var(--safe-top)) 1rem calc(1rem + var(--safe-bottom))', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,9,11,0.98)', boxShadow: '-24px 0 60px rgba(0,0,0,0.28)', display: 'grid', alignContent: 'start', gap: '1rem', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', textDecoration: 'none' }}>Ghosted</Link>
              <button className="button button--secondary button--small" onClick={() => setOpen(false)} aria-label="Close">Close</button>
            </div>
            <AuthWidget variant="mobile" />
            <nav style={{ display: 'grid', gap: '0.7rem' }}>
              {APP_NAV.map((link) => (
                <Link key={link.key} href={link.href} onClick={() => setOpen(false)} style={{ ...navLinkStyle(activeKey === link.key), width: '100%', justifyContent: 'flex-start' }}>
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
