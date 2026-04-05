import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { GhostedLogo } from '@/components/GhostedLogo';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Community Hub',
};

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-gate">
        <div className="landing-gate__media" aria-hidden="true">
          <Image
            className="landing-gate__media-image"
            src="/brand/ghosted-splash-reference.png"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </div>
        <main id="main-content" className="landing-gate__layout">
          <section className="landing-gate__copy">
            <div className="landing-gate__brand">
              <GhostedLogo className="landing-gate__brand-mark" sizes="52px" decorative priority />
              <div className="landing-gate__brand-copy">
                <p className="landing-gate__kicker">Ghosted clan hall</p>
                <span>Discord-first member hub</span>
              </div>
            </div>

            <h1 className="landing-gate__title">Ghosted</h1>
            <p className="landing-gate__line">
              Raids, events, rewards, and a haunted member hall built for the clan that actually shows up together.
            </p>

            <div className="landing-gate__actions">
              <div className="landing-gate__primary-actions">
                <Link className="button landing-gate__cta landing-gate__cta--primary" href="/app/">
                  Enter the Hall
                </Link>
                <Link className="button button--secondary landing-gate__cta" href="/news/">
                  Clan News
                </Link>
              </div>
              <div className="landing-gate__utility-links">
                <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">
                  Discord
                </a>
                <span className="landing-gate__utility-divider" aria-hidden="true" />
                <a href={GHOSTED_CONTENT.links.twitch} target="_blank" rel="noopener noreferrer">
                  Twitch
                </a>
              </div>
            </div>
          </section>

          <aside className="landing-gate__note">
            <span className="landing-gate__note-label">Live signal</span>
            <p>
              Spectral purple, deep wilderness silhouettes, and a member-first command space for the whole Ghosted crew.
            </p>
          </aside>
        </main>
      </header>
    </div>
  );
}
