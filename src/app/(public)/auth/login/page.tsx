import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DiscordLoginButton } from './DiscordLoginButton';
import styles from './page.module.css';
import { isDiscordAuthConfigured } from '@/lib/auth/server-config';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import { normalizeLocalPath } from '@/lib/server/core';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in with Discord to reach the Ghosted Hall, profile tools, and RuneLite pairing approvals.',
};

function describeDestination(nextPath: string) {
  const pathname = nextPath.split('?')[0] || '/';

  if (pathname.startsWith('/runelite/link')) {
    return {
      chip: 'RuneLite pairing',
      label: 'RuneLite pairing approval',
      summary: 'After Discord approves the session, Ghosted sends you back to finish the RuneLite account link.',
    };
  }

  if (pathname.startsWith('/hall/profile')) {
    return {
      chip: 'Hall profile',
      label: 'your Hall profile',
      summary: 'After Discord approves the session, Ghosted returns you to profile settings, clan verification, and account linking.',
    };
  }

  if (pathname.startsWith('/hall/rewards')) {
    return {
      chip: 'Rewards vault',
      label: 'your rewards vault',
      summary: 'After Discord approves the session, Ghosted drops you back into your points balance, perks, and reward tools.',
    };
  }

  if (pathname.startsWith('/hall/ghostling')) {
    return {
      chip: 'Ghostling space',
      label: 'your Ghostling space',
      summary: 'After Discord approves the session, Ghosted returns you to your Ghostling identity and live clan state.',
    };
  }

  if (pathname.startsWith('/hall')) {
    return {
      chip: 'Hall access',
      label: 'the Hall',
      summary: 'After Discord approves the session, Ghosted returns you to the Hall with your member state already loaded.',
    };
  }

  return {
    chip: 'Ghosted access',
    label: 'Ghosted',
    summary: 'After Discord approves the session, Ghosted returns you to the page that sent you here.',
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = normalizeLocalPath(params.next ?? '/hall/');

  if (process.env.ENABLE_DEV_AUTH === 'true') {
    redirect(`/auth/dev-login?next=${encodeURIComponent(nextPath)}`);
  }

  const destination = describeDestination(nextPath);
  const fallbackHref = `/api/auth/signin?callbackUrl=${encodeURIComponent(nextPath)}`;
  const canSignIn = isDiscordAuthConfigured();

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.page}`}>
      <section className={`editorial-surface editorial-surface--hero ${styles.hero}`}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className="kicker">Secure Discord sign-in</p>
            <div className={styles.heroChips}>
              <span className="app-chip">Ghosted checkpoint</span>
              <span className="app-chip">{destination.chip}</span>
            </div>
            <h1 className={styles.heroTitle}>Enter Ghosted through a branded clan checkpoint.</h1>
            <p className={styles.heroSummary}>
              Use your Discord identity to unlock the Hall, profile tools, Ghostling state, and RuneLite pairing
              approval. Ghosted does not ask for your Jagex, RuneLite, or email password on this page.
            </p>
            {canSignIn ? (
              <div className={styles.heroActions}>
                <DiscordLoginButton callbackUrl={nextPath} fallbackHref={fallbackHref} />
                <Link className="button button--secondary" href="/">
                  Back to site
                </Link>
              </div>
            ) : (
              <div className="app-banner is-warning">
                <p>Discord sign-in is not configured on this deployment yet. Check the auth env and Discord redirect URI, then try again.</p>
              </div>
            )}
          </div>

          <aside className={styles.signalStack} aria-label="Sign-in trust details">
            <div className={styles.trustMeta}>
              <span className={styles.trustMetaLabel}>Return destination</span>
              <strong className={styles.trustMetaValue}>{destination.label}</strong>
              <p className={styles.trustMetaCopy}>{destination.summary}</p>
            </div>
            <div className={styles.signalCard}>
              <span className={styles.signalCardLabel}>Why Discord</span>
              <strong className={styles.signalCardTitle}>One identity for the Hall and the clan surface.</strong>
              <p className={styles.signalCardCopy}>
                Discord powers Ghosted membership, display identity, clan roles, and the verification handoff into
                RuneLite pairing.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.supportList} aria-label="Sign-in notes">
        <article className={styles.supportRow}>
          <p className="kicker">What unlocks</p>
          <h3>Hall access, Ghostling state, and verified clan tools.</h3>
          <p className="editorial-copy">
            Signing in loads your Hall session, points balance, profile settings, and any approval flow that sent you
            here, including RuneLite account linking.
          </p>
        </article>

        <article className={styles.supportRow}>
          <p className="kicker">What Ghosted uses</p>
          <h3>Discord identity only on this screen.</h3>
          <p className="editorial-copy">
            This page is only for Discord authentication. Ghosted never asks for RuneScape credentials here, and the
            RuneLite plugin pairing stays browser-approved and user-initiated.
          </p>
        </article>

        <article className={styles.supportRow}>
          <p className="kicker">Need a hand</p>
          <h3>Use the fallback sign-in page or ask the clan.</h3>
          <p className="editorial-copy">
            If a browser extension or reputation warning blocks the direct handoff, try the <a href={fallbackHref}>fallback sign-in page</a>{' '}
            or reach out in <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">Ghosted Discord</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
