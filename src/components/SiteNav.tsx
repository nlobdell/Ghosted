'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthWidget } from './AuthWidget';

const NAV_LINKS = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'app', label: 'App Hub', href: '/app/' },
];

const UTILITY_LINKS = [
  { label: 'Twitch', href: 'https://www.twitch.tv/vghosted', rel: 'noopener noreferrer' },
  { label: 'Discord', href: 'https://discord.gg/ghosted', target: '_blank', rel: 'noopener noreferrer' },
];

function getActiveKey(path: string): string {
  if (path === '/') return 'home';
  if (path.startsWith('/app')) return 'app';
  return '';
}

export function SiteNav() {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="site-nav container site-shell-nav"
      aria-label="Primary"
      style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', minHeight: 'var(--spacing-header)', padding: '0.85rem 1.1rem', border: '1px solid rgba(255, 244, 224, 0.08)', borderRadius: 'var(--radius-pill)', background: 'rgba(10, 9, 11, 0.76)', backdropFilter: 'blur(18px)', boxShadow: 'var(--shadow-soft)' }}
    >
      <Link
        href="/"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', textDecoration: 'none' }}
      >
        <span style={{ display: 'inline-block', width: '0.85rem', height: '0.85rem', borderRadius: '0.28rem', background: 'linear-gradient(135deg, #9b6bff, #5f4b8b)', boxShadow: '0 0 20px rgba(155, 107, 255, 0.28)', transform: 'rotate(45deg)', flexShrink: 0 }} aria-hidden="true" />
        Ghosted
      </Link>

      {/* Mobile menu toggle */}
      <button
        className="button button--secondary button--small site-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav-panel"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'none' }}
      >
        <span aria-hidden="true" style={{ position: 'relative', display: 'block', width: '1.1rem', height: '2px', borderRadius: '999px', background: 'currentColor' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.02em' }}>Menu</span>
      </button>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60 }}
          id="site-nav-panel"
        >
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(5, 4, 6, 0.72)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            style={{ position: 'absolute', top: 0, right: 0, width: 'min(24rem, calc(100vw - 1rem))', height: '100dvh', padding: 'max(1rem, var(--safe-top)) 1rem calc(1rem + var(--safe-bottom))', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10, 9, 11, 0.98)', boxShadow: '-24px 0 60px rgba(0,0,0,0.28)', display: 'grid', alignContent: 'start', gap: '1rem', overflowY: 'auto', overscrollBehavior: 'contain' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Link href="/" onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ display: 'inline-block', width: '0.85rem', height: '0.85rem', borderRadius: '0.28rem', background: 'linear-gradient(135deg, #9b6bff, #5f4b8b)', transform: 'rotate(45deg)', flexShrink: 0 }} aria-hidden="true" />
                Ghosted
              </Link>
              <button className="button button--secondary button--small" type="button" onClick={() => setOpen(false)} aria-label="Close navigation menu">Close</button>
            </div>
            <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <AuthWidget variant="mobile" />
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={activeKey === link.key ? 'page' : undefined}
                  style={{ display: 'flex', alignItems: 'center', minHeight: '2.55rem', padding: '0.5rem 0.85rem', borderRadius: '999px', color: activeKey === link.key ? '#f3f1f9' : '#9d96ad', background: activeKey === link.key ? 'rgba(255,255,255,0.04)' : 'transparent', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 700 }}
                >
                  {link.label}
                </Link>
              ))}
              {UTILITY_LINKS.map((link) => (
                <a key={link.label} href={link.href} target={link.target} rel={link.rel}
                  className="button button--small" style={{ justifyContent: 'flex-start' }}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', flex: '1 1 auto', minWidth: 0 }}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            aria-current={activeKey === link.key ? 'page' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: '2.55rem', padding: '0.5rem 0.85rem', borderRadius: '999px', color: activeKey === link.key ? '#f3f1f9' : '#9d96ad', background: activeKey === link.key ? 'rgba(255,255,255,0.04)' : 'transparent', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 700, transition: 'color var(--ease-standard), background-color var(--ease-standard)' }}
          >
            {link.label}
          </Link>
        ))}
        {UTILITY_LINKS.map((link) => (
          <a key={link.label} href={link.href} target={link.target} rel={link.rel}
            className="button button--small">{link.label}</a>
        ))}
      </div>

      {/* Desktop auth */}
      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem', flexShrink: 0, maxWidth: 'min(20rem, 28vw)' }}>
        <AuthWidget variant="public" />
      </div>
    </nav>
  );
}
