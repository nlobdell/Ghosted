'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  MetricGrid,
  TagBlock,
  EmptyState,
  Banner,
  FormField,
} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import type { ShellData, WomMeData } from '@/lib/types';
import styles from './page.module.css';

export default function ProfilePage() {
  const [shell, setShell] = useState<ShellData | null>(null);
  const [womMe, setWomMe] = useState<WomMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);
  const [rsn, setRsn] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const shellData = await getJSON<ShellData>('/api/site-shell').catch((nextError: Error) => {
          if (nextError.message.includes('401') || nextError.message.toLowerCase().includes('unauthorized')) {
            setAuthed(false);
            return null;
          }
          throw nextError;
        });
        if (!shellData) return;
        setShell(shellData);
        if (!shellData.authenticated) {
          setAuthed(false);
          return;
        }
        const womData = await getJSON<WomMeData>('/api/wom/me').catch(() => null);
        setWomMe(womData);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleWomLink(event: React.FormEvent) {
    event.preventDefault();
    if (!rsn.trim()) return;
    setLinking(true);
    setLinkResult(null);
    try {
      const response = await fetch('/api/profile/wom-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rsn.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        setLinkResult({ ok: false, message: payload.error ?? 'Failed to link account.' });
      } else {
        setLinkResult({ ok: true, message: payload.message ?? 'WOM account linked.' });
        setRsn('');
        const womData = await getJSON<WomMeData>('/api/wom/me').catch(() => null);
        setWomMe(womData);
        const shellData = await getJSON<ShellData>('/api/site-shell').catch(() => null);
        if (shellData) setShell(shellData);
      }
    } catch (nextError) {
      setLinkResult({ ok: false, message: nextError instanceof Error ? nextError.message : 'Failed to link account.' });
    } finally {
      setLinking(false);
    }
  }

  async function handleWomUnlink() {
    setLinking(true);
    setLinkResult(null);
    try {
      const response = await fetch('/api/profile/wom-link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        setLinkResult({ ok: false, message: payload.error ?? 'Failed to unlink account.' });
      } else {
        setLinkResult({ ok: true, message: payload.message ?? 'WOM account unlinked.' });
        setWomMe(null);
        const shellData = await getJSON<ShellData>('/api/site-shell').catch(() => null);
        if (shellData) setShell(shellData);
      }
    } catch (nextError) {
      setLinkResult({ ok: false, message: nextError instanceof Error ? nextError.message : 'Failed to unlink account.' });
    } finally {
      setLinking(false);
    }
  }

  const user = shell?.user;
  const wom = shell?.wom;

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Hall', href: '/app/' },
          { label: 'Profile' },
        ]}
        title="Ghosted identity setup"
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading profile..." variant="info" />
      ) : !authed || !shell?.authenticated ? (
        <EmptyState
          message="Sign in to view and manage your profile."
          action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : (
        <>
          <AppGrid>
            <Panel
              tier="primary"
              title="Identity"
              eyebrow="Your account"
              body={(
                <div className="app-stack">
                  <div className="profile-identity">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="profile-identity__avatar"
                      />
                    ) : (
                      <div className="profile-identity__avatar profile-identity__avatar--fallback">
                        {(user?.displayName || user?.username || 'G').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="profile-identity__copy">
                      <strong className="profile-identity__name">{user?.displayName || 'Ghosted member'}</strong>
                      <span className="profile-identity__handle">{user?.username ? `@${user.username}` : ''}</span>
                    </div>
                  </div>

                  <MetricGrid
                    items={[
                      ['Balance', user ? formatPoints(user.balance) : '-'],
                      ['Admin', user?.isAdmin ? 'Yes' : 'No'],
                      ['WOM status', wom?.linked ? 'Linked' : 'Not linked'],
                      ['Clan', wom?.membership?.groupName ?? '-'],
                    ]}
                  />

                  {linkResult ? <Banner message={linkResult.message} variant={linkResult.ok ? 'info' : 'error'} /> : null}

                  {wom?.linked ? (
                    <div className="app-stack app-stack--compact">
                      <p className="app-panel-note">
                        Linked as{' '}
                        <strong className="profile-identity__inline-strong">
                          {womMe?.displayName ?? womMe?.username ?? wom?.membership?.rankLabel ?? 'Member'}
                        </strong>
                      </p>
                      <button
                        className="button button--secondary button--small app-button-start"
                        type="button"
                        disabled={linking}
                        onClick={handleWomUnlink}
                      >
                        {linking ? 'Unlinking...' : 'Unlink WOM account'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleWomLink} className="app-form">
                      <FormField label="RuneScape username" note="Link your Wise Old Man profile to unlock clan features.">
                        <input
                          type="text"
                          placeholder="Enter RSN..."
                          value={rsn}
                          onChange={(event) => setRsn(event.target.value)}
                          className="input-base"
                          required
                        />
                      </FormField>
                      <button
                        className="button button--secondary button--small app-button-start"
                        type="submit"
                        disabled={linking || !rsn.trim()}
                      >
                        {linking ? 'Linking...' : 'Link WOM account'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            />

            <Panel
              tier="meta"
              title="Roles and perks"
              eyebrow="Discord sync"
              body={(
                <div className="app-stack">
                  <TagBlock
                    label="Your roles"
                    values={user?.roles ?? []}
                    emptyMessage="No roles synced"
                  />
                  <TagBlock
                    label="Active perks"
                    values={user?.perks ?? []}
                    emptyMessage="No perks active"
                  />
                  {user?.roleDetails && user.roleDetails.length > 0 ? (
                    <div className="profile-role-list">
                      <p className="profile-role-list__label">Role details</p>
                      {user.roleDetails.map((role) => (
                        <div key={role.id} className="profile-role-row">
                          <span>{role.label}</span>
                          <span>{role.source}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            />
          </AppGrid>

          <StatStrip
            leadIndex={0}
            stats={[
              { label: 'Balance', value: user ? formatPoints(user.balance) : '-', href: '/app/rewards/' },
              { label: 'WOM link', value: wom?.linked ? 'Linked' : 'Not linked' },
              { label: 'Clan rank', value: wom?.membership?.rankLabel ?? '-' },
              { label: 'Roles', value: user ? String(user.roles.length) : '-' },
            ]}
          />
        </>
      )}
    </main>
  );
}
