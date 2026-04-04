import type { Metadata } from 'next';
import Link from 'next/link';
import { GhostedNav } from '@/components/GhostedNav';
import {
  AppGrid,
  AppContext,
  ArchitectureMap,
  Highlight,
  Panel,
  RouteList,
} from '@/components/app/AppUI';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Community Hub',
};

const CORE_ROUTES = [
  { href: '/app/', label: 'App Hub', meta: 'Daily member workspace' },
  { href: '/app/community/', label: 'Community', meta: 'Clan pulse, hiscores, and events' },
  { href: '/app/rewards/', label: 'Rewards', meta: 'Your points, caps, and ledger activity' },
  { href: '/app/giveaways/', label: 'Giveaways', meta: 'Live drops and entry requirements' },
  { href: '/app/casino/', label: 'Casino', meta: 'Points slots tied to rewards balance' },
  { href: '/app/profile/', label: 'Profile', meta: 'Discord roles and WOM linking' },
];

const CLAN_OVERVIEW = [
  {
    label: 'Join',
    title: 'Start in Discord',
    copy: `${GHOSTED_CONTENT.discord.description} Members land in #${GHOSTED_CONTENT.discord.welcomeChannel} after joining the invite.`,
    href: GHOSTED_CONTENT.links.discord,
    cta: 'Join Discord',
    external: true,
    chips: [
      `~${GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()} members`,
      `~${GHOSTED_CONTENT.discord.onlineCountApprox.toLocaleString()} online`,
      `Boost Tier ${GHOSTED_CONTENT.discord.boostTier}`,
    ],
  },
  {
    label: 'Play',
    title: 'Run events and progression',
    copy: GHOSTED_CONTENT.wom.summary,
    href: '/app/',
    cta: 'Open App Hub',
    chips: ['Raids', 'Bossing', 'Skill of the week', 'Giveaways'],
  },
  {
    label: 'Track',
    title: 'Verified clan records',
    copy: `Ghosted is tracked in WOM Group ${GHOSTED_CONTENT.wom.groupId} with verified data for roster, gains, and competitions.`,
    href: '/app/community/',
    cta: 'View Clan Data',
    chips: [
      `${GHOSTED_CONTENT.wom.memberCount} members`,
      `World ${GHOSTED_CONTENT.wom.homeworld}`,
      `Clan chat: ${GHOSTED_CONTENT.wom.clanChat}`,
    ],
  },
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-hero landing-hero--appblend">
        <div className="container landing-hero__frame">
          <GhostedNav />
        </div>
      </header>

      <main id="main-content" className="page-shell page-shell--home">
        <AppContext
          breadcrumbs={[
            { label: 'Ghosted', href: '/' },
          ]}
          title="Ghosted — OSRS clan hall"
          actions={
            <>
              <a className="button" href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
              <Link className="button button--secondary" href="/app/">
                Enter the Hall
              </Link>
            </>
          }
        />

        <Highlight
          eyebrow="Welcome to Ghosted"
          title="A social OSRS clan. Events, progression, and community."
          copy={`Led by vghosted on Twitch. ${GHOSTED_CONTENT.wom.memberCount} members verified in WOM. Competitions, giveaways, rewards, and a clan casino all tied to one shared points balance.`}
          chips={[
            `~${GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()} Discord members`,
            `${GHOSTED_CONTENT.wom.memberCount} WOM members`,
            `World ${GHOSTED_CONTENT.wom.homeworld}`,
          ]}
          actions={
            <>
              <a className="button button--secondary button--small" href={GHOSTED_CONTENT.links.twitch} target="_blank" rel="noopener noreferrer">
                Watch on Twitch
              </a>
              <a className="button button--secondary button--small" href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
            </>
          }
          theme="dashboard"
        />

        <ArchitectureMap
          title="How it works"
          copy="Join the Discord, link your account, and start participating in events."
          nodes={CLAN_OVERVIEW}
        />

        <AppGrid>
          <Panel
            eyebrow="Member sections"
            title="Everything in the hall"
            body={<RouteList routes={CORE_ROUTES} />}
          />
          <Panel
            eyebrow="The clan"
            title="Ghosted at a glance"
            body={(
              <div className="app-stack">
                <p className="app-panel-note">
                  Streamer-led OSRS clan running weekly skill events, bossing, and raids. Coordinated through Discord and tracked in Wise Old Man.
                </p>
                <div className="app-inline-actions">
                  <span className="app-chip">{`${GHOSTED_CONTENT.wom.memberCount} members`}</span>
                  <span className="app-chip">{`World ${GHOSTED_CONTENT.wom.homeworld}`}</span>
                  <span className="app-chip">{`CC: ${GHOSTED_CONTENT.wom.clanChat}`}</span>
                </div>
                <div className="app-inline-actions">
                  <a className="button button--secondary button--small" href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">Join Discord</a>
                  <Link className="button button--secondary button--small" href="/app/">Enter the Hall</Link>
                </div>
              </div>
            )}
          />
        </AppGrid>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer__inner">
          <p>&copy; {new Date().getFullYear()} Ghosted Clan.</p>
          <p>Led by vghosted on Twitch. Organized in Discord.</p>
        </div>
      </footer>
    </div>
  );
}
