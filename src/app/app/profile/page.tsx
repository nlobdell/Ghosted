'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid,
  MetricGrid, TagBlock, EmptyState, Banner, FormField,

} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import type { ShellData, WomMeData } from '@/lib/types';

export default function DashboardPage() {
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
        const shellData = await getJSON<ShellData>('/api/site-shell').catch((err: Error) => {
          if (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized')) {
            setAuthed(false);
            return null;
          }
          throw err;
        });
        if (!shellData) return;
        setShell(shellData);
        if (!shellData.authenticated) { setAuthed(false); return; }
        const womData = await getJSON<WomMeData>('/api/wom/me').catch(() => null);
        setWomMe(womData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleWomLink(e: React.FormEvent) {
    e.preventDefault();
    if (!rsn.trim()) return;
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await fetch('/api/profile/wom-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rsn.trim() }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (!res.ok) {
        setLinkResult({ ok: false, message: data.error ?? 'Failed to link account.' });
      } else {
        setLinkResult({ ok: true, message: data.message ?? 'WOM account linked!' });
        setRsn('');
        const womData = await getJSON<WomMeData>('/api/wom/me').catch(() => null);
        setWomMe(womData);
        const shellData = await getJSON<ShellData>('/api/site-shell').catch(() => null);
        if (shellData) setShell(shellData);
      }
    } catch (err) {
      setLinkResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to link account.' });
    } finally {
      setLinking(false);
    }
  }

  async function handleWomUnlink() {
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await fetch('/api/profile/wom-unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (!res.ok) {
        setLinkResult({ ok: false, message: data.error ?? 'Failed to unlink account.' });
      } else {
        setLinkResult({ ok: true, message: data.message ?? 'WOM account unlinked.' });
        setWomMe(null);
        const shellData = await getJSON<ShellData>('/api/site-shell').catch(() => null);
        if (shellData) setShell(shellData);
      }
    } catch (err) {
      setLinkResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to unlink account.' });
    } finally {
      setLinking(false);
    }
  }

  const user = shell?.user;
  const wom = shell?.wom;

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Profile' },
        ]}
        title="Identity setup"
      />

      {error && <Banner message={error} variant="error" />}

      {loading ? (
        <Banner message="Loading profile…" variant="info" />
      ) : !authed || !shell?.authenticated ? (
        <EmptyState
          message="Sign in to view and manage your profile."
          action={<Link href="/api/auth/discord" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Balance', value: user ? formatPoints(user.balance) : '—', href: '/app/rewards/' },
              { label: 'WOM link', value: wom?.linked ? 'Linked' : 'Not linked' },
              { label: 'Clan rank', value: wom?.membership?.rankLabel ?? '—' },
              { label: 'Roles synced', value: user ? String(user.roles.length) : '—' },
              { label: 'Access', value: user?.isAdmin ? 'Admin' : 'Member' },
            ]}
          />

          <AppGrid>
            <Panel
              title="Identity"
              eyebrow="Your account"
              body={
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {user?.avatarUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        style={{ width: '3.5rem', height: '3.5rem', borderRadius: '999px', border: '2px solid rgba(155, 107, 255, 0.3)' }}
                      />
                      <div>
                        <strong style={{ display: 'block', color: '#f3f1f9' }}>{user.displayName}</strong>
                        <span style={{ color: '#9d96ad', fontSize: '0.84rem' }}>@{user.username}</span>
                      </div>
                    </div>
                  )}
                  <MetricGrid
                    items={[
                      ['Balance', user ? formatPoints(user.balance) : '—'],
                      ['Admin', user?.isAdmin ? 'Yes' : 'No'],
                      ['WOM status', wom?.linked ? `Linked` : 'Not linked'],
                      ['Clan', wom?.membership?.groupName ?? '—'],
                    ]}
                  />

                  {linkResult && (
                    <Banner message={linkResult.message} variant={linkResult.ok ? 'info' : 'error'} />
                  )}

                  {wom?.linked ? (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <p style={{ margin: 0, color: '#9d96ad' }}>
                        Linked as{' '}
                        <strong style={{ color: '#f3f1f9' }}>
                          {womMe?.displayName ?? womMe?.username ?? wom?.membership?.rankLabel ?? 'Member'}
                        </strong>
                      </p>
                      <button
                        className="button button--secondary button--small"
                        type="button"
                        disabled={linking}
                        onClick={handleWomUnlink}
                        style={{ justifySelf: 'start' }}
                      >
                        {linking ? 'Unlinking…' : 'Unlink WOM account'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleWomLink} style={{ display: 'grid', gap: '0.8rem' }}>
                      <FormField label="RuneScape username" note="Link your Wise Old Man profile to unlock clan features.">
                        <input
                          type="text"
                          placeholder="Enter RSN…"
                          value={rsn}
                          onChange={(e) => setRsn(e.target.value)}
                          className="input-base"
                          required
                        />
                      </FormField>
                      <button
                        className="button button--secondary button--small"
                        type="submit"
                        disabled={linking || !rsn.trim()}
                        style={{ justifySelf: 'start' }}
                      >
                        {linking ? 'Linking…' : 'Link WOM account'}
                      </button>
                    </form>
                  )}
                </div>
              }
            />

            <Panel
              title="Roles & perks"
              eyebrow="Discord sync"
              body={
                <div style={{ display: 'grid', gap: '1rem' }}>
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
                  {user?.roleDetails && user.roleDetails.length > 0 && (
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      <p style={{ margin: 0, color: '#9d96ad', fontSize: '0.84rem' }}>Role details</p>
                      {user.roleDetails.map((r) => (
                        <div
                          key={r.id}
                          style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <span style={{ color: '#d6d1df' }}>{r.label}</span>
                          <span style={{ color: '#9d96ad', fontSize: '0.82rem' }}>{r.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </AppGrid>
        </>
      )}
    </main>
  );
}
