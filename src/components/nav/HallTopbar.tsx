import Link from 'next/link';
import { AuthWidget } from '@/components/AuthWidget';
import { GhostedLogo } from '@/components/GhostedLogo';
import type { ShellData } from '@/lib/types';

export function HallTopbar({
  shellData,
  surface = 'hall',
}: {
  shellData?: ShellData | null;
  surface?: 'hall' | 'admin';
}) {
  const quickLinks = surface === 'admin'
    ? [
      { href: '/hall/', label: 'Hall' },
      { href: '/', label: 'Public site' },
      { href: '/news/', label: 'Dispatches' },
    ]
    : [
      { href: '/', label: 'Public site' },
      { href: '/news/', label: 'Dispatches' },
      { href: '/roster/', label: 'Roster' },
    ];

  return (
    <header className="app-header">
      <div className="container">
        <div className={`nav-shell ${surface === 'admin' ? 'nav-shell--admin' : 'nav-shell--hall'}`}>
          <div className="nav-shell__inner">
            <div className="nav-slot nav-slot--brand">
              <Link href={surface === 'admin' ? '/admin/' : '/hall/'} className="nav-brand">
                <GhostedLogo className="nav-brand-logo" sizes="44px" decorative />
                <span className="nav-brand__copy">
                  <strong>Ghosted</strong>
                  <span>{surface === 'admin' ? 'Operator Control' : 'Member Workspace'}</span>
                </span>
              </Link>
            </div>

            <div className="nav-slot nav-slot--links">
              <nav aria-label={surface === 'admin' ? 'Operator quick links' : 'Member quick links'} className="nav-links">
                <div className="nav-link-group">
                  {quickLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="nav-link nav-link--utility nav-link--small">
                      {link.label}
                    </Link>
                  ))}
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
      </div>
    </header>
  );
}
