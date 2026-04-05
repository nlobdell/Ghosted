import Link from 'next/link';
import { AuthWidget } from '@/components/AuthWidget';
import { GhostedLogo } from '@/components/GhostedLogo';
import type { ShellData } from '@/lib/types';

export function HallTopbar({ shellData }: { shellData?: ShellData | null }) {
  return (
    <header className="app-header">
      <div className="container">
        <div className="nav-shell">
          <div className="nav-slot nav-slot--brand">
            <Link href="/hall/" className="nav-brand">
              <GhostedLogo className="nav-brand-logo" sizes="44px" decorative />
              <span className="nav-brand__copy">
                <strong>Ghosted</strong>
                <span>The Hall</span>
              </span>
            </Link>
          </div>

          <div className="nav-slot nav-slot--links">
            <nav aria-label="Hall quick links" className="nav-links">
              <div className="nav-link-group">
                <Link href="/" className="nav-link nav-link--small">Public home</Link>
                <Link href="/news/" className="nav-link nav-link--small">News</Link>
                <Link href="/roster/" className="nav-link nav-link--small">Roster</Link>
              </div>
            </nav>
          </div>

          <div className="nav-slot nav-slot--auth">
            <div className="nav-auth">
              <AuthWidget variant="app" shellData={shellData} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
