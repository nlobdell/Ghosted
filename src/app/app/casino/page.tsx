'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  AppContext, Banner, CONTAINER, APP_SHELL,
} from '@/components/app/AppUI';

const CasinoGame = dynamic(() => import('@/components/app/CasinoGame'), { ssr: false });

export default function DashboardPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <main id="main-content" style={{ ...CONTAINER, ...APP_SHELL }}>
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

      <Banner message="The casino loads below. Sign in with Discord to play." variant="info" />

      {ready && <CasinoGame />}
    </main>
  );
}
