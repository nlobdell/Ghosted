'use client';
import Link from 'next/link';
import { AppContext } from '@/components/app/AppUI';
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
      <CasinoGame />
    </main>
  );
}
