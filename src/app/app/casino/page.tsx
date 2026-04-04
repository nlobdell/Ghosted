'use client';
import Link from 'next/link';
import { AppContext, Highlight } from '@/components/app/AppUI';
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
        title="Points-only slots, built into the core app."
        copy="Spin machines, track your session, and use the same reward economy that powers the rest of Ghosted."
        chips={['Shared rewards balance', 'Machine switching and live history']}
      />
      <CasinoGame />
    </main>
  );
}
