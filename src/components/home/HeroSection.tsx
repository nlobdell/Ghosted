import Link from 'next/link';

export function HeroSection({ hallHref }: { hallHref: string }) {
  return (
    <section className="home-hero">
      <div className="home-hero__copy">
        <p className="kicker">Discord-first gaming clan</p>
        <h1>A Ghostling-first clan with a public stage out front and a private Hall behind it.</h1>
        <p>
          Compete, earn rewards, and haunt the leaderboards. Start with the community pulse, then step into
          the Hall to build your Ghostling and run the full member loop.
        </p>
        <div className="app-inline-actions">
          <a className="button" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
            Join the Clan
          </a>
          <Link className="button button--secondary" href={hallHref}>
            Enter the Hall
          </Link>
        </div>
      </div>
    </section>
  );
}
