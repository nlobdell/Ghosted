import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getGhostedBuildId } from '@/lib/server/app-build';
import { buildLootChestGameState } from '@/lib/server/twitch-loot-chest';
import { isTwitchPlatformOperator, twitchPlatformLoginHref } from '@/lib/server/twitch-platform';
import TwitchLootChestHostOverlayClient from '../giveaways/host/TwitchLootChestHostOverlayClient';
import styles from '../giveaways/host/page.module.css';

export const dynamic = 'force-dynamic';

export default async function TwitchLootChestHostOverlayPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(twitchPlatformLoginHref('/v/host'));
  }

  if (!isTwitchPlatformOperator(currentUser)) {
    return (
      <main className={styles.hostPage}>
        <section className={styles.lockedCard}>
          <p className={styles.eyebrow}>Restricted host surface</p>
          <h1>Twitch loot chest host access is limited.</h1>
          <p>
            Your Discord account is signed in, but it is not listed in <code>TWITCH_OPERATOR_DISCORD_IDS</code>.
          </p>
        </section>
      </main>
    );
  }

  const initialState = await buildLootChestGameState(currentUser);
  const buildId = getGhostedBuildId();

  return <TwitchLootChestHostOverlayClient initialState={initialState} buildId={buildId} />;
}
