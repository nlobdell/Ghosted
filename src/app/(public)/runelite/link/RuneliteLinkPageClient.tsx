'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Banner } from '@/components/ui/AppUI';
import { getJSON } from '@/lib/api';
import type { RuneliteLinkStatus } from '@/lib/types';

type ConfirmResponse = {
  ok: boolean;
  message?: string;
  link: RuneliteLinkStatus;
};

type Props = {
  userCode: string;
  username: string;
  expiresAt: string;
  initialStatus: 'pending' | 'approved' | 'denied' | 'expired' | 'conflict';
};

function statusCopy(status: Props['initialStatus']) {
  if (status === 'approved') {
    return {
      title: 'This RuneLite account is already linked.',
      detail: 'You can head back to your Hall profile whenever you are ready.',
      tone: 'info' as const,
    };
  }

  if (status === 'expired') {
    return {
      title: 'This pairing code expired.',
      detail: 'Return to the Ghosted Authenticator plugin and start a fresh link request.',
      tone: 'error' as const,
    };
  }

  if (status === 'conflict') {
    return {
      title: 'This RuneLite account is already claimed elsewhere.',
      detail: 'If this looks wrong, contact a Ghosted admin before trying again.',
      tone: 'error' as const,
    };
  }

  return {
    title: 'This pairing can no longer be approved.',
    detail: 'Return to the plugin and start a fresh link request.',
    tone: 'error' as const,
  };
}

export function RuneliteLinkPageClient({
  userCode,
  username,
  expiresAt,
  initialStatus,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; link?: RuneliteLinkStatus | null } | null>(
    initialStatus === 'pending'
      ? null
      : {
        ok: initialStatus === 'approved',
        message: `${statusCopy(initialStatus).title} ${statusCopy(initialStatus).detail}`.trim(),
        link: null,
      },
  );

  async function handleConfirm() {
    setSubmitting(true);
    setResult(null);
    try {
      const payload = await getJSON<ConfirmResponse>('/api/runelite/pairings/confirm', {
        method: 'POST',
        body: JSON.stringify({ userCode }),
      });
      setResult({
        ok: true,
        message: payload.message ?? 'RuneLite account linked.',
        link: payload.link,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to approve RuneLite link.',
        link: null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = initialStatus !== 'pending';
  const blockedCopy = blocked ? statusCopy(initialStatus) : null;

  return (
    <section className="editorial-surface editorial-stack">
      <p className="kicker">RuneLite pairing</p>
      <h1>Approve Ghosted Authenticator for {username}.</h1>
      <p className="editorial-copy">
        This links the currently running RuneLite account to your Ghosted profile and upgrades your clan-facing OSRS
        identity to a plugin-verified claim.
      </p>

      <div className="app-inline-actions">
        <span className="app-chip">Code {userCode}</span>
        <span className="app-chip">Expires {new Date(expiresAt).toLocaleString()}</span>
      </div>

      {blockedCopy ? (
        <Banner
          message={`${blockedCopy.title} ${blockedCopy.detail}`.trim()}
          variant={blockedCopy.tone === 'info' ? 'info' : 'error'}
        />
      ) : null}

      {result ? (
        <Banner message={result.message} variant={result.ok ? 'info' : 'error'} />
      ) : null}

      {result?.ok && result.link?.linked ? (
        <div className="app-stack app-stack--compact">
          <span className="app-chip">Linked username {result.link.username ?? username}</span>
          <span className="app-chip">Verified {result.link.lastVerifiedAt ? new Date(result.link.lastVerifiedAt).toLocaleString() : 'just now'}</span>
        </div>
      ) : null}

      <div className="app-inline-actions">
        <button
          type="button"
          className="button"
          disabled={submitting || blocked || Boolean(result?.ok)}
          onClick={() => void handleConfirm()}
        >
          {submitting ? 'Approving...' : (result?.ok ? 'Linked' : 'Approve link')}
        </button>
        <Link href="/hall/profile/" className="button button--secondary">
          Open Hall profile
        </Link>
      </div>

      <p className="app-panel-note">
        Ghosted will validate the requested RuneScape name against the configured Wise Old Man clan group before the
        link is finalized.
      </p>
    </section>
  );
}
