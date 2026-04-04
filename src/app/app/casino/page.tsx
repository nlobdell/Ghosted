'use client';
import Link from 'next/link';
import { AppContext, ArchitectureMap, Highlight } from '@/components/app/AppUI';
import CasinoGame from '@/components/app/CasinoGame';

export default function CasinoPage() {
  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Casino' },
        ]}
        title="Points casino floor"
        actions={
          <>
            <Link href="/app/rewards/" className="button button--secondary button--small">Balance</Link>
            <Link href="/app/profile/" className="button button--secondary button--small">Profile</Link>
          </>
        }
      />
      <Highlight
        theme="casino"
        eyebrow="Casino floor"
        title="Ghosted points casino."
        copy="Spin points-only machines, track session outcomes, and stay synced to the same rewards balance used across Ghosted giveaways and events."
        chips={['Shared rewards balance', 'Machine switching and live history']}
      />
      <ArchitectureMap
        title="Casino rules and flow"
        copy="The Ghosted casino uses your shared rewards profile and follows the same account rules as the rest of the hub."
        nodes={[
          {
            label: 'Play',
            title: 'Pick a machine',
            copy: 'Switch between available machines and track your current session with live spin outcomes.',
            chips: ['Pixi renderer', 'Machine selection', 'Spin history'],
          },
          {
            label: 'Balance',
            title: 'Shared points economy',
            copy: 'Every wager and payout updates the same rewards balance used for giveaways and the rest of Ghosted.',
            href: '/app/rewards/',
            cta: 'Open rewards',
            chips: ['Shared points ledger', 'Daily cap state'],
          },
          {
            label: 'Access',
            title: 'Member account required',
            copy: 'You must be signed in with your Discord-linked profile to play and persist session data.',
            href: '/app/profile/',
            cta: 'Open profile',
            chips: ['Discord auth', 'Profile-linked access'],
          },
        ]}
      />
      <CasinoGame />
    </main>
  );
}
