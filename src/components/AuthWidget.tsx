'use client';
import { useEffect, useState } from 'react';
import type { ShellData } from '@/lib/types';

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
      .then((response) => response.json())
      .then(setShell)
      .catch(() => null);
  }, []);

  if (!shell) return null;

  if (shell.authenticated && shell.user) {
    const user = shell.user;
    const subtitle = variant === 'public'
      ? `${formatPts(user.balance)} | ${user.womLink?.membership?.rankLabel ?? user.womLink?.membership?.role ?? (user.womLink?.linked ? 'Member' : 'Discord only')}`
      : `${user.womLink?.linked ? (user.womLink.membership?.rankLabel ?? user.womLink.membership?.role ?? 'Member') : 'Link your RSN from Profile'} | ${formatPts(user.balance)}`;

    return (
      <div className={`site-profile-widget site-profile-widget--signed-in site-profile-widget--${variant}`}>
        <a className="site-profile-widget__card" href="/app/profile/">
          {user.avatarUrl ? (
            <img className="site-profile-widget__avatar" src={user.avatarUrl} alt={user.displayName} />
          ) : (
            <div className="site-profile-widget__avatar">
              {(user.displayName || user.username || 'G').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="site-profile-widget__copy">
            <strong>{user.displayName || user.username || 'Ghosted member'}</strong>
            <span>{subtitle}</span>
          </span>
        </a>
        <div className="site-profile-widget__actions">
          {user.isAdmin ? (
            <a className="button button--secondary button--small" href="/admin/">Admin</a>
          ) : null}
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

  const canSignIn = Boolean(shell.auth?.canSignIn && shell.auth?.loginHref);
  const compact = variant === 'public';

  return (
    <div className={`site-profile-widget site-profile-widget--signed-out site-profile-widget--${variant}`}>
      <div className="site-profile-widget__copy">
        <strong>{compact ? 'Member access' : 'Sign in to Ghosted'}</strong>
        <span>
          {shell.wom?.configured
            ? 'Sync Discord, profile, and WOM status.'
            : 'Discord auth is available once configured.'}
        </span>
      </div>
      {canSignIn ? (
        <a className="button button--small" href={shell.auth.loginHref}>Sign In</a>
      ) : (
        <span className="site-profile-widget__hint">Sign-in unavailable</span>
      )}
    </div>
  );
}
