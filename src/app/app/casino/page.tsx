'use client';
import Link from 'next/link';
import { AppContext, Panel } from '@/components/app/AppUI';
import CasinoGame from '@/components/app/CasinoGame';
import styles from './page.module.css';

export default function CasinoPage() {
  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
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
      <CasinoGame />
      <Panel
        tier="meta"
        eyebrow="Rules"
        title="Points-only machine"
        body={(
          <div className="app-stack">
            <p className="app-panel-note">Casino uses the same points balance as rewards and giveaways.</p>
            <div className="app-inline-actions">
              <span className="app-chip">No cash value</span>
              <Link href="/app/rewards/" className="button button--secondary button--small">Open rewards</Link>
            </div>
          </div>
        )}
      />
    </main>
  );
}
