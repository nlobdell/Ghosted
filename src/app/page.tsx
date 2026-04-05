/* eslint-disable @next/next/no-img-element -- The splash hero uses auth-aware same-origin companion render endpoints. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthWidget } from '@/components/AuthWidget';
import { GhostedLogo } from '@/components/GhostedLogo';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Community Hub',
};

const HALL_ROUTES = [
  {
    href: '/app/companion/',
    label: 'Ghostling',
    meta: 'Build your Ghostling, equip cosmetics, and export it anywhere.',
  },
  {
    href: '/app/rewards/',
    label: 'Rewards',
    meta: 'Spend the same points balance that powers the Ghostling loop.',
  },
  {
    href: '/app/competitions/',
    label: 'Competitions',
    meta: 'Move from your ghost into live clan events and standings.',
  },
  {
    href: '/app/clan/',
    label: 'Clan',
    meta: 'Roster health, leaders, and the wider Ghosted pulse.',
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden="true" />

        <div className={styles.heroShell}>
          <header className={styles.topRail}>
            <Link href="/" className={styles.brand}>
              <GhostedLogo className={styles.brandMark} sizes="56px" decorative priority />
              <span className={styles.brandCopy}>
                <strong>Ghosted</strong>
                <span>Ghostling-first clan hall</span>
              </span>
            </Link>

            <div className={styles.topRailActions}>
              <Link href="/news/" className={styles.utilityLink}>
                News
              </Link>
              <a
                href={GHOSTED_CONTENT.links.twitch}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.utilityLink}
              >
                Twitch
              </a>
              <a
                href={GHOSTED_CONTENT.links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.utilityLink}
              >
                Discord
              </a>
              <div className={styles.authSlot}>
                <AuthWidget variant="public" />
              </div>
            </div>
          </header>

          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Public foyer</p>
              <h1 className={styles.title}>Ghosted</h1>
              <p className={styles.summary}>
                Your Ghostling now leads the hall. Step through one simple entry point to tune your ghost,
                spend points, and move into the live Ghosted crew.
              </p>

              <div className={styles.actionRow}>
                <Link className="button" href="/app/">
                  Enter the Hall
                </Link>
                <Link className="button button--secondary" href="/app/companion/">
                  Open Ghostling
                </Link>
              </div>

              <div className={styles.metaRow}>
                <span>Discord-first member hub</span>
                <span className={styles.metaDivider} aria-hidden="true" />
                <span>{GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()} Discord members</span>
                <span className={styles.metaDivider} aria-hidden="true" />
                <span>{GHOSTED_CONTENT.wom.memberCount.toLocaleString()} WOM-tracked members</span>
              </div>
            </div>

            <aside className={styles.stagePane} aria-label="Ghostling preview">
              <div className={styles.stageFrame}>
                <span className={styles.stageLabel}>Live Ghostling preview</span>
                <div className={styles.stageCanvas}>
                  <img
                    src="/api/companion/render-animated"
                    alt="Ghosted Ghostling preview"
                    className={styles.stageImage}
                  />
                </div>
                <p className={styles.stageNote}>
                  Signed-in members see their own Ghostling here. Everyone else gets the default Ghostling on first visit.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.supportBand} aria-labelledby="inside-the-hall">
        <div className={styles.supportHeading}>
          <p className={styles.kicker}>Inside the hall</p>
          <h2 id="inside-the-hall">Start with your Ghostling, then branch into the rest.</h2>
        </div>

        <div className={styles.routeStrip}>
          {HALL_ROUTES.map((route) => (
            <Link key={route.href} href={route.href} className={styles.routeCard}>
              <strong>{route.label}</strong>
              <span>{route.meta}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
