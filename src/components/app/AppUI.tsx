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
  className,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  actions?: ReactNode;
  slim?: boolean;
  className?: string;
}) {
  const sectionClassName = ['app-context', slim ? '' : 'app-context--wide', className].filter(Boolean).join(' ');

  return (
    <section className={sectionClassName}>
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

function renderStat(stat: StatItem, className: string) {
  const resolvedClassName = `${className}${stat.href ? ' app-stat--link' : ''}`;
  const content = (
    <>
      <div className="app-stat__value">{stat.value}</div>
      <div className="app-stat__label">{stat.label}</div>
    </>
  );

  return stat.href ? (
    <Link key={stat.label} href={stat.href} className={resolvedClassName}>
      {content}
    </Link>
  ) : (
    <article key={stat.label} className={resolvedClassName}>
      {content}
    </article>
  );
}

export function StatStrip({
  stats,
  leadIndex = 0,
  className,
}: {
  stats: StatItem[];
  leadIndex?: number;
  className?: string;
}) {
  const safeLeadIndex = Math.max(0, Math.min(leadIndex, Math.max(0, stats.length - 1)));
  const leadStat = stats[safeLeadIndex] ?? null;
  const secondaryStats = stats.filter((_, index) => index !== safeLeadIndex);

  return (
    <section className={['app-summary-grid', className].filter(Boolean).join(' ')} aria-label="Summary statistics">
      {leadStat ? renderStat(leadStat, 'app-stat app-stat--lead') : null}
      {secondaryStats.length ? (
        <div className="app-summary-grid__secondary">
          {secondaryStats.map((stat) => renderStat(stat, 'app-stat app-stat--secondary'))}
        </div>
      ) : null}
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
  tier = 'primary',
  className,
}: {
  eyebrow?: string;
  title: string;
  chip?: string;
  body: ReactNode;
  href?: string;
  subtle?: boolean;
  tier?: 'primary' | 'meta';
  className?: string;
}) {
  const panelClassName = [
    'app-panel',
    `app-panel--${tier}`,
    href ? 'app-panel--link' : '',
    subtle ? 'app-card--subtle' : '',
    className,
  ]
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
      <Link href={href} className={panelClassName}>
        {header}
      </Link>
    );
  }

  return <article className={panelClassName}>{header}</article>;
}

export function AppGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={['app-grid-two', className].filter(Boolean).join(' ')}>{children}</section>;
}

export interface ArchitectureNode {
  label: string;
  title: string;
  copy: string;
  href?: string;
  external?: boolean;
  cta?: string;
  chips?: string[];
}

export function ArchitectureMap({
  title,
  copy,
  nodes,
}: {
  title: string;
  copy?: string;
  nodes: ArchitectureNode[];
}) {
  return (
    <section className="architecture-map">
      <div className="architecture-map__heading">
        <h3>{title}</h3>
        {copy ? <p>{copy}</p> : null}
      </div>
      <div className="architecture-map__grid">
        {nodes.map((node) => {
          const body = (
            <article key={node.title} className="architecture-node">
              <span className="architecture-node__label">{node.label}</span>
              <h4>{node.title}</h4>
              <p>{node.copy}</p>
              {node.chips?.length ? (
                <div className="architecture-node__chips">
                  {node.chips.map((chip) => (
                    <span key={chip} className="app-chip">{chip}</span>
                  ))}
                </div>
              ) : null}
              {node.href && node.cta ? (
                node.external ? (
                  <a
                    className="button button--secondary button--small"
                    href={node.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {node.cta}
                  </a>
                ) : (
                  <Link className="button button--secondary button--small" href={node.href}>
                    {node.cta}
                  </Link>
                )
              ) : null}
            </article>
          );
          return body;
        })}
      </div>
    </section>
  );
}

export function Highlight({
  eyebrow,
  title,
  copy,
  actions,
  stage,
  className,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
  stage?: {
    label: string;
    primary: string;
    secondary?: string;
    chips?: string[];
  };
  className?: string;
}) {
  return (
    <section className={['highlight-shell', stage ? '' : 'highlight-shell--single', className].filter(Boolean).join(' ')}>
      <div className="highlight-copy">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        <h2 className="highlight-copy__title">{title}</h2>
        {copy ? <p>{copy}</p> : null}
        {actions ? <div className="app-inline-actions">{actions}</div> : null}
      </div>
      {stage ? (
        <aside className="highlight-stage" aria-label={stage.label}>
          <div className="highlight-stage__header">
            <span>{stage.label}</span>
          </div>
          <div className="highlight-stage__metric">
            <strong>{stage.primary}</strong>
            {stage.secondary ? <p>{stage.secondary}</p> : null}
          </div>
          {stage.chips?.length ? (
            <div className="highlight-stage__chips">
              {stage.chips.map((chip) => (
                <span key={chip} className="app-chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
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

export function EmptyState({
  message,
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={['app-empty', className].filter(Boolean).join(' ')}>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Banner({
  message,
  variant = 'info',
  className,
}: {
  message: string;
  variant?: 'info' | 'warning' | 'error';
  className?: string;
}) {
  const variantClassName = variant === 'info' ? '' : `is-${variant}`;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={['app-banner', variantClassName, className].filter(Boolean).join(' ')}
    >
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
