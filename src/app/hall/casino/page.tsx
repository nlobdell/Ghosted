'use client';
import { Panel } from '@/components/ui/AppUI';
import CasinoGame from '@/components/ui/CasinoGame';
import styles from './page.module.css';

export default function CasinoPage() {
  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <CasinoGame />
      <Panel
        className="casino-rules"
        tier="meta"
        title="Points-only machine"
        body={(
          <div className="app-stack">
            <p className="app-panel-note">Casino uses the same points balance as rewards and giveaways.</p>
            <span className="app-chip">No cash value</span>
          </div>
        )}
      />
    </main>
  );
}
