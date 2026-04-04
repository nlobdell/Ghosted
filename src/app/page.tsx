import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Ghosted Clan | The Hall',
};

const HERO_ROUTES = [
  { href: '/app/community/', icon: '/symbols/rune.svg', label: 'Community', detail: 'Roster, clan watch, and current competitions.' },
  { href: '/app/rewards/', icon: '/symbols/coin.svg', label: 'Rewards', detail: 'Balances, ledger movement, and member value.' },
  { href: '/app/giveaways/', icon: '/symbols/scatter.svg', label: 'Giveaways', detail: 'Live drops with clear cost and access.' },
  { href: '/app/casino/', icon: '/symbols/ghost.svg', label: 'Casino', detail: 'A coherent points floor that belongs to the same product.' },
];

const OPERATING_PILLARS = [
  {
    label: 'Broadcast',
    title: 'Streams create the energy.',
    copy: 'Twitch is the live front door. The site supports it instead of competing with it.',
  },
  {
    label: 'Coordination',
    title: 'Discord keeps members moving.',
    copy: 'Roles, announcements, and sign-in status stay connected to the tools members actually use.',
  },
  {
    label: 'Retention',
    title: 'The app gives people reasons to return.',
    copy: 'Rewards, giveaways, competitions, and casino play all feed one repeatable community loop.',
  },
];

const WORKFLOW_STEPS = [
  {
    title: 'Land in the hall',
    copy: 'The homepage should tell a new member where Ghosted lives, why the app matters, and where to go first.',
  },
  {
    title: 'Check your position',
    copy: 'The app hub should surface balance, competitions, and active drops before decorative content.',
  },
  {
    title: 'Act with confidence',
    copy: 'Every route should make the next click obvious, whether that is entering a giveaway, linking WOM, or spinning the casino.',
  },
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-hero">
        <div className="container landing-hero__frame">
          <SiteNav />

          <div className="landing-hero__grid">
            <div className="landing-copy">
              <p className="kicker">Ghosted clan hall</p>
              <h1>One front door for the stream, the clan, and the tools members actually use.</h1>
              <p>
                Ghosted is built to be operated, not admired from a distance. The public site tells people where the clan
                lives. The app keeps rewards, competitions, giveaways, and the casino in one readable system.
              </p>
              <div className="button-row">
                <a className="button" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
                  Join Discord
                </a>
                <Link className="button button--secondary" href="/app/">
                  Open App Hub
                </Link>
              </div>
            </div>

            <aside className="landing-rail" aria-label="Ghosted overview">
              <div className="landing-rail__hero">
                <div className="landing-rail__hero-copy">
                  <span className="landing-rail__eyebrow">Live operating picture</span>
                  <strong>The site now reads like one system.</strong>
                  <p>Public entry, member tools, and casino play share the same materials, spacing, and action language.</p>
                </div>
              </div>
              <div className="landing-rail__stack">
                {HERO_ROUTES.map((route, index) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={`landing-rail__card${index === 3 ? ' landing-rail__card--featured' : ''}`}
                  >
                    <img src={route.icon} alt="" className="landing-rail__icon" />
                    <div>
                      <div className="landing-rail__card-title">{route.label}</div>
                      <div className="landing-rail__card-copy">{route.detail}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-band">
          <div className="container landing-section">
            <div className="landing-section__heading">
              <p className="kicker">Operating model</p>
              <h2>Functional first. Easy to edit second. Still strong enough to feel like Ghosted.</h2>
              <p>
                The design system is now carried by shared classes instead of scattered inline styling, which makes future
                edits faster and keeps the public and member-facing surfaces aligned.
              </p>
            </div>

            <div className="landing-panel-grid">
              {OPERATING_PILLARS.map((pillar, index) => (
                <article key={pillar.label} className="landing-panel">
                  <span className="landing-rail__eyebrow">{pillar.label}</span>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.copy}</p>
                  <img
                    src={HERO_ROUTES[index]?.icon ?? '/symbols/ghost.svg'}
                    alt=""
                    className="landing-panel__icon"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-band">
          <div className="container landing-section landing-workflow">
            <div className="landing-workflow__list">
              <div className="landing-section__heading">
                <p className="kicker">Member flow</p>
                <h2>From public discovery to repeat usage.</h2>
              </div>
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.title} className="landing-step">
                  <strong>{step.title}</strong>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>

            <aside className="landing-workflow__sidebar landing-panel">
              <span className="landing-rail__eyebrow">Why this matters</span>
              <h3>Members should never have to guess what Ghosted is for.</h3>
              <p>
                The site now favors obvious destinations, consistent action labels, and fewer one-off visual treatments.
                That makes both content updates and operational changes much easier.
              </p>
              <div className="button-row">
                <Link className="button" href="/app/">
                  Go to the app
                </Link>
                <a className="button button--secondary" href="https://www.twitch.tv/vghosted" target="_blank" rel="noopener noreferrer">
                  Watch Twitch
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-band">
          <div className="container">
            <div className="landing-cta">
              <p className="kicker">Next step</p>
              <h2>Show up in Discord, then use the tools that keep the clan moving.</h2>
              <div className="button-row">
                <a className="button" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
                  Join Discord
                </a>
                <Link className="button button--secondary" href="/app/">
                  Open member tools
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer__inner">
          <p>&copy; {new Date().getFullYear()} Ghosted Clan.</p>
          <p>Built for stream nights, clan tools, and repeatable member flow.</p>
        </div>
      </footer>
    </div>
  );
}
