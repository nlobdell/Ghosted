'use client';
/* eslint-disable @next/next/no-img-element -- Discord avatar URLs are dynamic and not routed through next/image yet. */
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
} from '@/components/ui/AppUI';
import { formatDate, formatPoints, getJSON } from '@/lib/api';
import type { OsrsClaimSource, PublicNameSource, ShellData, WomLink, WomMeData } from '@/lib/types';
import styles from './page.module.css';

type WomLinkMutationResponse = {
  ok: boolean;
  message?: string;
  result: WomLink;
};

type OsrsClaimChallengeResponse = {
  ok: boolean;
  message?: string;
  challenge: {
    requestedUsername: string;
    expiresAt: string;
  };
};

function normalizeHallProfileCopy(text: string) {
  return text
    .replace(/\bWOM\b/g, 'Wise Old Man')
    .replaceAll('Companion', 'Ghostling')
    .replaceAll('companion', 'Ghostling');
}

function claimSourceLabel(claimSource: OsrsClaimSource | null | undefined) {
  if (claimSource === 'runelite_plugin') return 'RuneLite plugin verified';
  if (claimSource === 'manual_wom') return 'Manual Wise Old Man link';
  return 'Not claimed yet';
}

function publicNameSourceLabel(source: PublicNameSource | null | undefined) {
  return source === 'osrs' ? 'Claimed OSRS name' : 'Discord name';
}

export default function ProfilePage() {
  const [shell, setShell] = useState<ShellData | null>(null);
  const [womMe, setWomMe] = useState<WomMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);
  const [rsn, setRsn] = useState('');
  const [linking, setLinking] = useState(false);
  const [savingPublicName, setSavingPublicName] = useState(false);
  const [issuingClaimChallenge, setIssuingClaimChallenge] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; message: string } | null>(null);

  function syncShellWom(nextLink: WomLink) {
    setShell((current) => {
      if (!current) return current;
      return {
        ...current,
        wom: {
          ...current.wom,
          linked: Boolean(nextLink.linked),
          username: nextLink.username ?? null,
          displayName: nextLink.displayName ?? null,
          publicNameSource: nextLink.publicNameSource ?? current.wom.publicNameSource,
          claimSource: nextLink.claimSource ?? current.wom.claimSource ?? null,
          verifiedAt: nextLink.verifiedAt ?? current.wom.verifiedAt ?? null,
          inGroup: Boolean(nextLink.inGroup),
          membership: nextLink.membership,
          lastSyncedAt: nextLink.lastSyncedAt ?? null,
        },
        user: current.user
          ? {
            ...current.user,
            publicNameSource: nextLink.publicNameSource ?? current.user.publicNameSource,
            womLink: nextLink,
          }
          : current.user,
      };
    });
  }

  async function refreshLinkedState() {
    const [womData, shellData] = await Promise.all([
      getJSON<WomMeData>('/api/wom/me').catch(() => null),
      getJSON<ShellData>('/api/site-shell').catch(() => null),
    ]);
    setWomMe(womData);
    if (shellData) setShell(shellData);
  }

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
        setError(nextError instanceof Error ? normalizeHallProfileCopy(nextError.message) : 'Failed to load profile.');
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
      const payload = await getJSON<WomLinkMutationResponse>('/api/profile/wom-link', {
        method: 'POST',
        body: JSON.stringify({ username: rsn.trim() }),
      });
      syncShellWom(payload.result);
      setLinkResult({ ok: true, message: normalizeHallProfileCopy(payload.message ?? 'Wise Old Man account linked.') });
      setRsn('');
      await refreshLinkedState();
    } catch (nextError) {
      setLinkResult({
        ok: false,
        message: nextError instanceof Error ? normalizeHallProfileCopy(nextError.message) : 'Failed to link account.',
      });
    } finally {
      setLinking(false);
    }
  }

  async function handleWomUnlink() {
    setLinking(true);
    setLinkResult(null);
    try {
      const payload = await getJSON<WomLinkMutationResponse>('/api/profile/wom-link', {
        method: 'DELETE',
      });
      syncShellWom(payload.result);
      setLinkResult({ ok: true, message: normalizeHallProfileCopy(payload.message ?? 'Wise Old Man account unlinked.') });
      setWomMe(null);
      await refreshLinkedState();
    } catch (nextError) {
      setLinkResult({
        ok: false,
        message: nextError instanceof Error ? normalizeHallProfileCopy(nextError.message) : 'Failed to unlink account.',
      });
    } finally {
      setLinking(false);
    }
  }

  async function handlePublicNameSource(source: PublicNameSource) {
    setSavingPublicName(true);
    setLinkResult(null);
    try {
      const payload = source === 'discord'
        ? await getJSON<WomLinkMutationResponse>('/api/profile/public-name-source', {
          method: 'DELETE',
        })
        : await getJSON<WomLinkMutationResponse>('/api/profile/public-name-source', {
          method: 'POST',
          body: JSON.stringify({ source }),
        });
      syncShellWom(payload.result);
      await refreshLinkedState();
      setLinkResult({
        ok: true,
        message: normalizeHallProfileCopy(payload.message ?? 'Public name preference updated.'),
      });
    } catch (nextError) {
      setLinkResult({
        ok: false,
        message: nextError instanceof Error ? normalizeHallProfileCopy(nextError.message) : 'Failed to update public name preference.',
      });
    } finally {
      setSavingPublicName(false);
    }
  }

  async function handleIssueClaimChallenge() {
    setIssuingClaimChallenge(true);
    setLinkResult(null);
    try {
      const payload = await getJSON<OsrsClaimChallengeResponse>('/api/profile/osrs-claim-challenge', {
        method: 'POST',
      });
      setLinkResult({
        ok: true,
        message: normalizeHallProfileCopy(
          payload.message
          ?? `Verification code sent to your Discord DMs for ${payload.challenge.requestedUsername}.`,
        ),
      });
    } catch (nextError) {
      setLinkResult({
        ok: false,
        message: nextError instanceof Error ? normalizeHallProfileCopy(nextError.message) : 'Failed to send claim challenge.',
      });
    } finally {
      setIssuingClaimChallenge(false);
    }
  }

  const user = shell?.user;
  const wom = shell?.wom;
  const publicNameSource = user?.publicNameSource ?? wom?.publicNameSource ?? 'discord';
  const currentClaimSource = wom?.claimSource ?? null;
  const isPluginVerified = Boolean(wom?.verifiedAt);
  const profileSummary = wom?.linked
    ? 'Your Hall identity and Wise Old Man account are connected.'
    : 'Link your Wise Old Man account to load your clan status in the Hall.';

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading profile..." variant="info" />
      ) : !authed || !shell?.authenticated ? (
        <EmptyState
          message="Sign in to view and manage your profile."
          action={<Link href="/auth/login?next=%2Fhall%2Fprofile%2F" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : (
        <>
          <AppContext
            breadcrumbs={[
              { label: 'Hall', href: '/hall/' },
              { label: 'Profile' },
            ]}
            title="Identity and Wise Old Man link"
            summary={profileSummary}
            className={styles.context}
          />

          <AppGrid className={styles.profileGrid}>
            <Panel
              className="profile-identity-panel"
              tier="primary"
              eyebrow="Profile check"
              title="Identity and Wise Old Man link"
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

                  <div className={styles.linkStatus}>
                    <strong>{wom?.linked ? 'Wise Old Man is linked and ready.' : 'Wise Old Man still needs to be linked.'}</strong>
                    <span>
                      {wom?.linked
                        ? `Ghosted is tracking you as ${womMe?.player?.displayName ?? wom?.displayName ?? wom?.username ?? 'your linked account'} across the Hall.`
                        : 'Add the RuneScape username your clan tracks so your Hall profile matches live clan data.'}
                    </span>
                  </div>

                  <MetricGrid
                    items={[
                      ['Balance', user ? formatPoints(user.balance) : '-'],
                      ['Public name', publicNameSourceLabel(publicNameSource)],
                      ['Wise Old Man status', wom?.linked ? 'Linked' : 'Not linked'],
                      ['Claim source', claimSourceLabel(currentClaimSource)],
                      ['Verification', isPluginVerified ? 'Verified' : (wom?.linked ? 'Pending' : '-')],
                      ['Clan', wom?.membership?.groupName ?? '-'],
                    ]}
                  />
                  {linkResult ? <Banner message={linkResult.message} variant={linkResult.ok ? 'info' : 'error'} /> : null}

                  <div className={styles.claimControls}>
                    <div className={styles.claimHeader}>
                      <strong>Public member name</strong>
                      <span>Ghostlings, member cards, and public share surfaces use this name.</span>
                    </div>
                    <div className={styles.claimCurrent}>
                      <strong className={styles.claimCurrentLabel}>{user?.displayName ?? 'Ghosted member'}</strong>
                      <span className={styles.claimCurrentMeta}>
                        {publicNameSource === 'osrs'
                          ? 'Public surfaces are showing your claimed OSRS identity.'
                          : 'Public surfaces are still using your Discord identity.'}
                      </span>
                    </div>
                    <div className={styles.claimToggle}>
                      <button
                        type="button"
                        className={`button button--small ${publicNameSource === 'discord' ? '' : 'button--secondary'}`}
                        disabled={savingPublicName || publicNameSource === 'discord'}
                        onClick={() => void handlePublicNameSource('discord')}
                      >
                        {publicNameSource === 'discord' ? 'Using Discord name' : 'Use Discord name'}
                      </button>
                      <button
                        type="button"
                        className={`button button--small ${publicNameSource === 'osrs' ? '' : 'button--secondary'}`}
                        disabled={savingPublicName || linking || !wom?.linked || publicNameSource === 'osrs'}
                        onClick={() => void handlePublicNameSource('osrs')}
                      >
                        {publicNameSource === 'osrs' ? 'Using OSRS name' : 'Use OSRS name'}
                      </button>
                    </div>
                    <div className={styles.claimFacts}>
                      <span>Claim source: <strong>{claimSourceLabel(currentClaimSource)}</strong></span>
                      <span>
                        Verification:{' '}
                        <strong>{wom?.verifiedAt ? `Verified ${formatDate(wom.verifiedAt)}` : (wom?.linked ? 'Plugin verification pending' : 'Not available')}</strong>
                      </span>
                    </div>
                    {wom?.linked && currentClaimSource !== 'runelite_plugin' ? (
                      <div className={styles.claimActions}>
                        <button
                          type="button"
                          className="button button--secondary button--small app-button-start"
                          disabled={issuingClaimChallenge}
                          onClick={() => void handleIssueClaimChallenge()}
                        >
                          {issuingClaimChallenge ? 'Sending code...' : 'Send RuneLite verification code'}
                        </button>
                        <span className={styles.claimHint}>
                          This sends a one-time code to your Discord DMs for the upcoming RuneLite verification flow.
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {wom?.linked ? (
                    <div className="app-stack app-stack--compact">
                      <p className="app-panel-note">
                        Linked as{' '}
                        <strong className="profile-identity__inline-strong">
                          {womMe?.player?.displayName ?? womMe?.player?.username ?? wom?.displayName ?? wom?.username ?? wom?.membership?.rankLabel ?? 'Member'}
                        </strong>
                      </p>
                      <button
                        className="button button--secondary button--small app-button-start"
                        type="button"
                        disabled={linking}
                        onClick={handleWomUnlink}
                      >
                        {linking ? 'Unlinking...' : 'Unlink Wise Old Man account'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleWomLink} className="app-form">
                      <FormField label="RuneScape username" note="Use the RuneScape username your clan tracks in Wise Old Man.">
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
                        {linking ? 'Linking...' : 'Link Wise Old Man account'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            />

            <Panel
              className="profile-perks-panel"
              tier="meta"
              eyebrow="Supporting"
              title="Roles and perks"
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
            className="profile-scoreboard"
            leadIndex={0}
            stats={[
              { label: 'Balance', value: user ? formatPoints(user.balance) : '-', href: '/hall/rewards/' },
              { label: 'Wise Old Man link', value: wom?.linked ? 'Linked' : 'Not linked' },
              { label: 'Clan rank', value: wom?.membership?.rankLabel ?? '-' },
              { label: 'Roles', value: user ? String(user.roles.length) : '-' },
            ]}
          />

          <Panel
            className="profile-link-state"
            tier="meta"
            eyebrow="Synced details"
            title="Wise Old Man clan state"
            body={(
              wom?.linked ? (
                <MetricGrid
                  items={[
                    ['Display', womMe?.player?.displayName ?? wom?.displayName ?? wom?.username ?? '-'],
                    ['Build', womMe?.player?.build ?? '-'],
                    ['Status', womMe?.player?.status ?? '-'],
                    ['Clan rank', wom?.membership?.rankLabel ?? '-'],
                    ['Updated', formatDate(womMe?.player?.updatedAt ?? null)],
                    ['Last sync', formatDate(wom?.lastSyncedAt ?? null)],
                    ['Competitions', String(womMe?.competitions?.length ?? 0)],
                    ['Achievements', String(womMe?.achievements?.length ?? 0)],
                  ]}
                />
              ) : (
                <EmptyState message="Link your Wise Old Man account to load your clan status here." />
              )
            )}
          />
        </>
      )}
    </main>
  );
}
