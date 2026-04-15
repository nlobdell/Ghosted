import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import type { VOperatorAppTab } from '@/lib/types';
import { buildGhostedVOperatorAppState } from '@/lib/server/twitch-platform-runtime';
import { isTwitchPlatformOperator, twitchPlatformLoginHref } from '@/lib/server/twitch-platform';
import VOperatorAppClient from './VOperatorAppClient';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

function normalizeTab(value: string | undefined): VOperatorAppTab {
  if (value === 'live' || value === 'queue' || value === 'setup' || value === 'diagnostics') {
    return value;
  }
  return 'live';
}

export default async function VOperatorAppPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; tab?: string }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  if (!currentUser) {
    redirect(twitchPlatformLoginHref('/v?tab=live'));
  }

  if (!isTwitchPlatformOperator(currentUser)) {
    return (
      <main className={styles.page}>
        <section className={styles.operatorNotice}>
          <p className={styles.eyebrow}>Restricted control app</p>
          <h1 className={styles.pageTitle}>Operator access is limited.</h1>
          <p className={styles.pageSummary}>
            Your Discord account is signed in, but it is not listed in <code>TWITCH_OPERATOR_DISCORD_IDS</code>.
          </p>
        </section>
      </main>
    );
  }

  const initialState = await buildGhostedVOperatorAppState(currentUser);

  return (
    <main className={styles.page}>
      <VOperatorAppClient
        initialState={initialState}
        initialTab={normalizeTab(params.tab)}
        initialMessage={typeof params.message === 'string' ? params.message : null}
      />
    </main>
  );
}
