'use client';
import { useEffect, useState } from 'react';
import type { ShellData } from '@/lib/types';
import { formatPoints } from '@/lib/api';

const numberFormatter = new Intl.NumberFormat();

function formatPts(value: number) {
  return `${numberFormatter.format(value)} pts`;
}

interface Props {
  variant: 'public' | 'app' | 'mobile';
}

export function AuthWidget({ variant }: Props) {
  const [shell, setShell] = useState<ShellData | null>(null);

  useEffect(() => {
    fetch(`/api/site-shell?next=${encodeURIComponent(window.location.pathname)}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then(setShell)
      .catch(() => null);
  }, []);

  if (!shell) return null;

  if (shell.authenticated && shell.user) {
    const u = shell.user;
    const subtitle =
      variant === 'public'
        ? `${formatPts(u.balance)} | ${u.womLink?.membership?.rankLabel ?? u.womLink?.membership?.role ?? (u.womLink?.linked ? 'Member' : 'Discord only')}`
        : `${u.womLink?.linked ? (u.womLink.membership?.rankLabel ?? u.womLink.membership?.role ?? 'Member') : 'Link your RSN from Profile'} | ${formatPts(u.balance)}`;

    return (
      <div className={`site-profile-widget site-profile-widget--signed-in site-profile-widget--${variant}`}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
        <a className="site-profile-widget__card" href="/app/profile/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minHeight: '2.6rem', padding: '0.32rem 0.45rem', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1.05rem', background: 'rgba(255,255,255,0.035)', textDecoration: 'none', minWidth: 0, flex: '1 1 auto' }}>
          {u.avatarUrl ? (
            <img className="site-profile-widget__avatar" src={u.avatarUrl} alt={u.displayName}
              style={{ width: '3.8rem', height: '3.8rem', borderRadius: '0.85rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#f3f1f9', overflow: 'hidden', flex: '0 0 auto' }} />
          ) : (
            <div className="site-profile-widget__avatar"
              style={{ width: '3.8rem', height: '3.8rem', borderRadius: '0.85rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#f3f1f9', overflow: 'hidden', flex: '0 0 auto' }}>
              {(u.displayName || u.username || 'G').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="site-profile-widget__copy" style={{ display: 'grid', gap: '0.08rem', minWidth: 0, flex: '1 1 auto' }}>
            <strong style={{ color: '#f3f1f9', fontSize: '0.92rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.displayName || u.username || 'Ghosted member'}
            </strong>
            <span style={{ fontSize: '0.72rem', lineHeight: 1.3, color: '#9d96ad' }}>{subtitle}</span>
          </span>
        </a>
        <div className="site-profile-widget__actions" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
          {u.isAdmin && (
            <a className="button button--secondary button--small" href="/admin/">Admin</a>
          )}
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={() => {
              fetch('/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
                .then(() => window.location.reload())
                .catch(() => null);
            }}
          >
            {variant === 'mobile' ? 'Log out' : 'Log Out'}
          </button>
        </div>
      </div>
    );
  }

  const canSignIn = !!shell.auth?.canSignIn && !!shell.auth?.loginHref;
  const compact = variant === 'public';

  return (
    <div className={`site-profile-widget site-profile-widget--signed-out site-profile-widget--${variant}`}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.55rem', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', background: 'rgba(255,255,255,0.03)' }}>
      <div className="site-profile-widget__copy" style={{ display: 'grid', gap: '0.08rem' }}>
        <strong style={{ color: '#f3f1f9', fontSize: '0.92rem' }}>
          {compact ? 'Member access' : 'Sign in to Ghosted'}
        </strong>
        <span style={{ fontSize: '0.72rem', color: '#9d96ad' }}>
          {shell.wom?.configured
            ? 'Sync Discord, profile, and WOM status.'
            : 'Discord auth is available once configured.'}
        </span>
      </div>
      {canSignIn ? (
        <a className="button button--small" href={shell.auth.loginHref}>Sign In</a>
      ) : (
        <span style={{ fontSize: '0.72rem', color: '#9d96ad' }}>Sign-in unavailable</span>
      )}
    </div>
  );
}
