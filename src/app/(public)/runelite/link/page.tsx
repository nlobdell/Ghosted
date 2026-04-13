import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RuneliteLinkPageClient } from './RuneliteLinkPageClient';
import { getConfiguredLoginHref } from '@/lib/auth/server-config';
import { AppError } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getRuneliteVerificationPairing } from '@/lib/server/runelite-link';

export const metadata: Metadata = {
  title: 'RuneLite Link',
};

export const dynamic = 'force-dynamic';

export default async function RuneliteLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = String(params.code ?? '').trim();
  const nextPath = `/runelite/link?code=${encodeURIComponent(code)}`;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(getConfiguredLoginHref(nextPath) ?? '/');
  }

  let pairing: ReturnType<typeof getRuneliteVerificationPairing> | null = null;
  let error: string | null = null;

  try {
    if (!code) {
      throw new AppError('A RuneLite pairing code is required.', 400);
    }
    pairing = getRuneliteVerificationPairing(getDatabase(), code);
  } catch (routeError) {
    error = routeError instanceof Error ? routeError.message : 'Failed to load RuneLite pairing.';
  }

  return (
    <main id="main-content" className="page-shell editorial-page">
      <section className="editorial-surface editorial-stack">
        <p className="kicker">Ghosted Authenticator</p>
        <h1>Link your RuneLite account to Ghosted.</h1>
        <p className="editorial-copy">
          Approve the linking request from Ghosted Authenticator to connect the current RuneLite account to your Hall
          profile and verified OSRS identity.
        </p>
      </section>

      {pairing ? (
        <RuneliteLinkPageClient
          userCode={pairing.userCode}
          username={pairing.username}
          expiresAt={pairing.expiresAt}
          initialStatus={
            pairing.status === 'pending'
            || pairing.status === 'approved'
            || pairing.status === 'denied'
            || pairing.status === 'expired'
            || pairing.status === 'conflict'
              ? pairing.status
              : 'expired'
          }
        />
      ) : (
        <section className="editorial-surface editorial-stack">
          <p className="kicker">Pairing error</p>
          <h2>This RuneLite link request is not available.</h2>
          <p className="editorial-copy">{error ?? 'Start a new link request from the plugin and try again.'}</p>
        </section>
      )}
    </main>
  );
}
