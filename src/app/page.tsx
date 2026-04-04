import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Community Hub',
};

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-gate">
        <main id="main-content" className="landing-gate__inner">
          <p className="landing-gate__kicker">Ghosted clan</p>
          <h1 className="landing-gate__title">Ghosted</h1>
          <div className="landing-gate__actions">
            <Link className="button landing-gate__cta" href="/app/">
              Enter the Hall
            </Link>
            <div className="landing-gate__subactions">
              <a
                className="button button--secondary landing-gate__cta"
                href={GHOSTED_CONTENT.links.twitch}
                target="_blank"
                rel="noopener noreferrer"
              >
                Twitch
              </a>
              <a
                className="button button--secondary landing-gate__cta"
                href={GHOSTED_CONTENT.links.discord}
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
            </div>
          </div>
        </main>
      </header>
    </div>
  );
}
