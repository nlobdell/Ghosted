'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HALL_LINKS = [
  { href: '/hall/ghostling/', label: 'Ghostling', meta: 'Build + export' },
  { href: '/hall/rewards/', label: 'Rewards', meta: 'Spend points' },
  { href: '/hall/competitions/', label: 'Competitions', meta: 'Live standings' },
  { href: '/hall/clan/', label: 'Clan', meta: 'Roster pulse' },
];

export function HallSidebar() {
  const pathname = usePathname();
  const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return (
    <aside className="hall-sidebar" aria-label="Hall navigation">
      <div className="hall-sidebar__header">
        <span className="kicker">Persistent map</span>
        <h2 className="hall-sidebar__title">The Hall</h2>
      </div>
      <nav className="hall-sidebar__nav">
        {HALL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hall-sidebar__link"
            aria-current={(() => {
              const normalizedHref = link.href.endsWith('/') ? link.href.slice(0, -1) : link.href;
              return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`)
                ? 'page'
                : undefined;
            })()}
          >
            <strong>{link.label}</strong>
            <span>{link.meta}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
