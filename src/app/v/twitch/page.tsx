import { redirect } from 'next/navigation';
import { HallTopbar } from '@/components/nav/HallTopbar';
import type { ShellData } from '@/lib/types';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getServerJSON } from '@/lib/server-api';
import { buildGhostedTwitchPlatformState } from '@/lib/server/twitch-platform-runtime';
import { isTwitchPlatformOperator, twitchPlatformLoginHref } from '@/lib/server/twitch-platform';
import TwitchPlatformConsoleClient from './TwitchPlatformConsoleClient';
import styles from './page.module.css';
import surfaceStyles from '../v-surface.module.css';

export const dynamic = 'force-dynamic';

export default async function TwitchPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [currentUser, shellData, params] = await Promise.all([
    getCurrentUser(),
    getServerJSON<ShellData>('/api/site-shell?next=%2Fv%2Ftwitch%2F'),
    searchParams,
  ]);

  if (!currentUser) {
    redirect(twitchPlatformLoginHref('/v/twitch/'));
  }

  if (!isTwitchPlatformOperator(currentUser)) {
    return (
      <div className="app-page app-shell app-shell--admin">
        <HallTopbar shellData={shellData} surface="admin" />
        <main id="main-content" className={`page-shell workspace-page ${styles.page} ${surfaceStyles.surface}`}>
          <section className={styles.operatorNotice}>
            <p className="kicker">Restricted console</p>
            <h1>Twitch operator access is limited.</h1>
            <p>
              Your Discord account is signed in, but it is not listed in
              {' '}
              <code>TWITCH_OPERATOR_DISCORD_IDS</code>
              .
            </p>
          </section>
        </main>
      </div>
    );
  }

  const initialState = await buildGhostedTwitchPlatformState(currentUser);

  return (
    <div className="app-page app-shell app-shell--admin">
      <HallTopbar shellData={shellData} surface="admin" />
      <main id="main-content" className={`page-shell workspace-page ${styles.page} ${surfaceStyles.surface}`}>
        <TwitchPlatformConsoleClient
          initialState={initialState}
          initialMessage={typeof params.message === 'string' ? params.message : null}
        />
      </main>
    </div>
  );
}
