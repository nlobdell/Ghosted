import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';
import { AppGrid, AppContext, Highlight, Panel, RouteList } from '@/components/app/AppUI';

export const metadata: Metadata = {
  title: 'Ghosted Clan | The Hall',
};

const CORE_ROUTES = [
  { href: '/app/community/', label: 'Community', meta: 'Clan overview and competition activity' },
  { href: '/app/rewards/', label: 'Rewards', meta: 'Balance, ledger, and point economy' },
  { href: '/app/giveaways/', label: 'Giveaways', meta: 'Active drops and entry requirements' },
  { href: '/app/casino/', label: 'Casino', meta: 'Live slot floor and spin history' },
  { href: '/app/profile/', label: 'Profile', meta: 'Identity, linking, and member status' },
];

const OPERATING_COLUMNS = [
  {
    title: 'Live community',
    copy: 'Ghosted starts on stream and in Discord, then carries that momentum into member tools.',
    chip: 'Broadcast + Discord',
    href: 'https://www.twitch.tv/vghosted',
    cta: 'Watch Twitch',
    external: true,
  },
  {
    title: 'Member workflow',
    copy: 'The app keeps rewards, competitions, giveaways, and casino play in one consistent interface.',
    chip: 'In-app loop',
    href: '/app/',
    cta: 'Open App Hub',
    external: false,
  },
  {
    title: 'First-time orientation',
    copy: 'New members should understand where to click first without context switching across different visual systems.',
    chip: 'First class surface',
    href: 'https://discord.gg/ghosted',
    cta: 'Join Discord',
    external: true,
  },
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-hero landing-hero--appblend">
        <div className="container landing-hero__frame">
          <SiteNav />
        </div>
      </header>

      <main id="main-content" className="page-shell page-shell--home">
        <AppContext
          breadcrumbs={[
            { label: 'Ghosted', href: '/' },
            { label: 'Clan hall' },
          ]}
          title="One hall. One workflow."
          actions={
            <>
              <a className="button" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
              <Link className="button button--secondary" href="/app/">
                Open App Hub
              </Link>
            </>
          }
        />

        <Highlight
          eyebrow="Unified experience"
          title="Public entry and member tools now belong to the same product surface."
          copy="The homepage is app-forward: navigate to the real workflows immediately, with the same structural language used inside the member area."
          chips={['Community + rewards + giveaways + casino', 'Consistent navigation and spacing']}
          actions={
            <>
              <Link className="button button--secondary button--small" href="/app/community/">
                Community
              </Link>
              <Link className="button button--secondary button--small" href="/app/casino/">
                Casino
              </Link>
            </>
          }
          theme="dashboard"
        />

        <AppGrid>
          <Panel
            eyebrow="Primary routes"
            title="Go directly to member tools"
            body={<RouteList routes={CORE_ROUTES} />}
          />
          <Panel
            eyebrow="Why Ghosted"
            title="Built to operate, not just to market"
            body={
              <div className="app-stack">
                <p className="app-panel-note">
                  Ghosted keeps the stream, Discord community, and member app in one coherent system so players can move from discovery to action without friction.
                </p>
                <div className="app-inline-actions">
                  <a className="button button--secondary button--small" href="https://www.twitch.tv/vghosted" target="_blank" rel="noopener noreferrer">
                    Twitch
                  </a>
                  <a className="button button--secondary button--small" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
                    Discord
                  </a>
                </div>
              </div>
            }
          />
        </AppGrid>

        <section className="landing-band landing-band--home">
          <div className="landing-panel-grid">
            {OPERATING_COLUMNS.map((column) => (
              <article key={column.title} className="landing-panel">
                <span className="landing-rail__eyebrow">{column.chip}</span>
                <h3>{column.title}</h3>
                <p>{column.copy}</p>
                {column.external ? (
                  <a className="button button--secondary button--small" href={column.href} target="_blank" rel="noopener noreferrer">
                    {column.cta}
                  </a>
                ) : (
                  <Link className="button button--secondary button--small" href={column.href}>
                    {column.cta}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer__inner">
          <p>&copy; {new Date().getFullYear()} Ghosted Clan.</p>
          <p>Unified public and member surface.</p>
        </div>
      </footer>
    </div>
  );
}
