import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StatItem, LedgerEntry, LeaderboardEntry } from '@/lib/types';
import { formatDate, formatCompetitionWindow } from '@/lib/api';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function AppContext({
  breadcrumbs,
  title,
  actions,
  slim = true,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  actions?: ReactNode;
  slim?: boolean;
}) {
  return (
    <section className={`app-context${slim ? '' : ' app-context--wide'}`}>
      <nav className="app-breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="app-breadcrumbs__item">
            {index > 0 && <span aria-hidden="true">/</span>}
            {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
          </span>
        ))}
      </nav>
      <div className="app-context__row">
        <h1 className="app-context__title">{title}</h1>
        {actions ? <div className="app-context__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StatStrip({ stats }: { stats: StatItem[] }) {
  return (
    <section className="app-summary-grid" aria-label="Summary statistics">
      {stats.map((stat) => {
        const content = (
          <>
            <div className="app-stat__value">{stat.value}</div>
            <div className="app-stat__label">{stat.label}</div>
          </>
        );

        return stat.href ? (
          <Link key={stat.label} href={stat.href} className="app-stat app-stat--link">
            {content}
          </Link>
        ) : (
          <article key={stat.label} className="app-stat">
            {content}
          </article>
        );
      })}
    </section>
  );
}

export function Panel({
  eyebrow,
  title,
  chip,
  body,
  href,
  subtle,
}: {
  eyebrow?: string;
  title: string;
  chip?: string;
  body: ReactNode;
  href?: string;
  subtle?: boolean;
}) {
  const className = ['app-panel', href ? 'app-panel--link' : '', subtle ? 'app-card--subtle' : '']
    .filter(Boolean)
    .join(' ');

  const header = (
    <>
      <div className="app-panel__header">
        <div className="app-panel__header-copy">
          {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {chip ? <span className="app-chip">{chip}</span> : null}
      </div>
      <div className="app-panel__body">{body}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {header}
      </Link>
    );
  }

  return <article className={className}>{header}</article>;
}

export function AppGrid({ children }: { children: ReactNode }) {
  return <section className="app-grid-two">{children}</section>;
}

export function Highlight({
  eyebrow,
  title,
  copy,
  actions,
  chips,
  theme = 'dashboard',
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
  chips?: string[];
  theme?: string;
}) {
  const themes: Record<string, { label: string; title: string; art: string[] }> = {
    admin: { label: 'Control room', title: 'Operator lane', art: ['/symbols/crown.svg', '/symbols/rune.svg'] },
    community: { label: 'Clan watch', title: 'Roster and comps', art: ['/symbols/rune.svg', '/symbols/ghost.svg'] },
    giveaways: { label: 'Drop board', title: 'Live entries', art: ['/symbols/scatter.svg', '/symbols/crown.svg'] },
    rewards: { label: 'Ledger rail', title: 'Balance and burn', art: ['/symbols/coin.svg', '/symbols/rune.svg'] },
    casino: { label: 'Casino floor', title: 'Slots and streaks', art: ['/symbols/wild.svg', '/symbols/coin.svg'] },
    dashboard: { label: 'Command deck', title: 'Member flow', art: ['/symbols/ghost.svg', '/symbols/lantern.svg'] },
  };

  const selected = themes[theme] ?? themes.dashboard;

  return (
    <section className="highlight-shell">
      <div className="highlight-copy">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        <h2 className="highlight-copy__title">{title}</h2>
        {copy ? <p>{copy}</p> : null}
        {actions ? <div className="app-inline-actions">{actions}</div> : null}
      </div>
      <aside className="highlight-stage" aria-label={selected.label}>
        <div className="highlight-stage__header">
          <span>{selected.label}</span>
          <strong>{selected.title}</strong>
        </div>
        <div className="highlight-stage__art">
          {selected.art.map((src, index) => (
            <img key={src} src={src} alt="" className={`highlight-stage__icon highlight-stage__icon--${index + 1}`} />
          ))}
        </div>
        {chips?.length ? (
          <div className="highlight-stage__chips">
            {chips.map((chip) => (
              <span key={chip} className="app-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

export function MetricGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="app-metric-grid">
      {items.map(([label, value]) => (
        <div key={label} className="app-metric">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function RouteList({
  routes,
}: {
  routes: { href: string; label: string; meta: string; featured?: boolean }[];
}) {
  return (
    <div className="app-route-list">
      {routes.map((route) => (
        <Link key={route.href} href={route.href} className={`app-route${route.featured ? ' app-route--featured' : ''}`}>
          <div className="app-route__copy">
            <strong>{route.label}</strong>
          </div>
          <span className="app-route__meta">{route.meta}</span>
        </Link>
      ))}
    </div>
  );
}

export function TagBlock({
  label,
  values,
  emptyMessage,
}: {
  label: string;
  values?: string[];
  emptyMessage: string;
}) {
  const tags = values?.length ? values : [emptyMessage];
  return (
    <div className="app-tag-block">
      <p className="app-muted">{label}</p>
      <div className="app-tag-list">
        {tags.map((tag) => (
          <span key={tag} className="app-chip">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <DenseTable
      columns={['When', 'Type', 'Description', 'Amount']}
      rows={entries.map((entry) => [
        formatDate(entry.createdAt),
        entry.entryType,
        entry.description,
        `${entry.amount > 0 ? '+' : ''}${entry.amount.toLocaleString()} pts`,
      ])}
      emptyMessage="No activity yet."
    />
  );
}

export function DenseTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <section className="app-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${columns[cellIndex]}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function LeaderboardTable({
  entries,
  valueFormatter,
  valueLabel,
}: {
  entries: LeaderboardEntry[];
  valueFormatter: (entry: LeaderboardEntry) => string;
  valueLabel: string;
}) {
  if (!entries.length) return <EmptyState message="No data available." />;

  return (
    <section className="app-table">
      <table>
        <thead>
          <tr>
            {['#', 'Player', valueLabel].map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.player?.username ?? 'player'}-${index}`}>
              <td>{entry.rank ?? index + 1}</td>
              <td>
                <div className="app-table__player">
                  <strong>{entry.player?.displayName || entry.player?.username || 'Player'}</strong>
                  {entry.player?.username && entry.player.username !== entry.player.displayName ? (
                    <span>@{entry.player.username}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <div className="app-table__value">
                  <strong>{valueFormatter(entry)}</strong>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Feed({
  items,
}: {
  items: { title: string; meta?: string; eyebrow?: string }[];
}) {
  if (!items.length) return <EmptyState message="Nothing to show." />;

  return (
    <div className="app-feed">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} className="app-feed__item">
          <strong>{item.title}</strong>
          {item.eyebrow ? <span className="app-feed__eyebrow">{item.eyebrow}</span> : null}
          {item.meta ? <div className="app-feed__meta">{item.meta}</div> : null}
        </article>
      ))}
    </div>
  );
}

export function CompetitionList({
  entries,
  compact = false,
}: {
  entries: { title: string; status: string; metric?: string; type?: string; startsAt?: string; endsAt?: string }[];
  compact?: boolean;
}) {
  if (!entries.length) return <EmptyState message="No competitions yet." />;

  return (
    <div className="app-feed">
      {entries.map((entry, index) => (
        <article key={`${entry.title}-${index}`} className={`app-feed__item${compact ? ' is-compact' : ''}`}>
          <div className="app-card__row">
            <strong>{entry.title || 'Competition'}</strong>
            <span className="app-chip">{entry.status}</span>
          </div>
          {!compact ? (
            <div className="app-feed__meta-row">
              {entry.metric ? <span className="app-feed__eyebrow">{entry.metric}</span> : null}
              {entry.type ? <span className="app-feed__eyebrow">{entry.type}</span> : null}
            </div>
          ) : null}
          <div className="app-feed__meta">{formatCompetitionWindow(entry)}</div>
        </article>
      ))}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="app-empty">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Banner({
  message,
  variant = 'info',
}: {
  message: string;
  variant?: 'info' | 'warning' | 'error';
}) {
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`app-banner${variant === 'info' ? '' : ` is-${variant}`}`}>
      {message}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-section-heading">
      <div className="app-section-heading__copy">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        <h3>{title}</h3>
        {copy ? <p className="app-panel__copy">{copy}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FormField({
  label,
  children,
  note,
}: {
  label: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="app-form-field">
      <label>{label}</label>
      {children}
      {note ? <p className="app-muted">{note}</p> : null}
    </div>
  );
}
