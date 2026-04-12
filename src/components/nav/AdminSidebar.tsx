'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_LINKS = [
  { href: '/admin/', label: 'Overview', marker: 'HUB' },
  { href: '/admin/rewards/', label: 'Rewards', marker: 'PTS' },
  { href: '/admin/content/', label: 'Content', marker: 'PUB' },
  { href: '/admin/systems/', label: 'Systems', marker: 'SYS' },
  { href: '/admin/ghostling/', label: 'Ghostling', marker: 'AST' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-sidebar__header">
        <span className="admin-sidebar__kicker">Operator nav</span>
        <h2 className="admin-sidebar__title">Ops</h2>
      </div>

      <nav className="admin-sidebar__nav">
        {ADMIN_LINKS.map((link) => {
          const normalizedHref = link.href.endsWith('/') ? link.href.slice(0, -1) : link.href;
          const current = normalizedHref === '/admin'
            ? normalizedPath === normalizedHref
            : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="admin-sidebar__link"
              aria-current={current ? 'page' : undefined}
            >
              <em className="admin-sidebar__marker" aria-hidden="true">{link.marker}</em>
              <strong>{link.label}</strong>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
