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
          { label: 'Hall', href: '/app/' },
          { label: 'Casino' },
        ]}
        title="Points casino"
        actions={
          <Link href="/app/rewards/" className="button button--secondary button--small">Balance</Link>
        }
      />
      <Highlight
        eyebrow="Casino floor"
        title="Points-only slots."
        copy="Same balance as giveaways and rewards. Sign in to play."
        stage={{
          label: 'Casino signal',
          primary: 'Shared rewards balance',
          secondary: 'Points only. No cash value.',
        }}
      />
      <CasinoGame />
    </main>
  );
}
