import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export function HeroSection({ hallHref }: { hallHref: string }) {
  return (
    <section className="home-hero">
      <div className="home-hero__copy">
        <p className="kicker">Join Ghosted</p>
        <h1>Join Ghosted, where the Discord is loud, the stream stays live, and every member carries a Ghostling into the Hall.</h1>
        <p>
          See the clan alive in public, then carry that momentum into Wise Old Man competition, rewards, and a
          Ghostling that stays yours inside the Hall.
        </p>
        <div className="home-hero__signals" aria-label="Ghosted clan signals">
          <span>Discord-first nights</span>
          <span>Wise Old Man tracked</span>
          <span>Ghostling identity</span>
        </div>
        <div className="app-inline-actions">
          <a className="button" href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">
            Join Discord
          </a>
          <Link className="button button--secondary" href={hallHref}>
            Enter the Hall
          </Link>
        </div>
      </div>
    </section>
  );
}
