'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HALL_LINKS = [
  { href: '/hall/ghostling/', label: 'Ghostling', meta: 'Identity studio' },
  { href: '/hall/rewards/', label: 'Rewards', meta: 'Spend or enter' },
  { href: '/hall/competitions/', label: 'Competitions', meta: 'Live standings' },
  { href: '/hall/clan/', label: 'Clan', meta: 'Roster health' },
];

export function HallSidebar({
  includeAdmin = false,
  surface = 'hall',
}: {
  includeAdmin?: boolean;
  surface?: 'hall' | 'admin';
}) {
  const pathname = usePathname();
  const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const adminLink = { href: '/admin/', label: 'Admin', meta: 'Operator actions' };
  const links = includeAdmin
    ? surface === 'admin'
      ? [adminLink, ...HALL_LINKS]
      : [...HALL_LINKS, adminLink]
    : HALL_LINKS;
  const summary = surface === 'admin'
    ? 'Change live Ghosted state, then confirm sync, balances, and records.'
    : 'Ghostling identity, rewards, Wise Old Man status, and the live clan board.';

  return (
    <aside className={`hall-sidebar ${surface === 'admin' ? 'hall-sidebar--admin' : ''}`} aria-label={surface === 'admin' ? 'Admin navigation' : 'Hall navigation'}>
      <div className="hall-sidebar__header">
        <span className="kicker">{surface === 'admin' ? 'Operator control' : 'Member workspace'}</span>
        <h2 className="hall-sidebar__title">{surface === 'admin' ? 'Admin' : 'Hall'}</h2>
        <p className="hall-sidebar__summary">{summary}</p>
      </div>
      <nav className="hall-sidebar__nav">
        {links.map((link) => (
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
