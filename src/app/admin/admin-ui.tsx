import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/api';
import type { AdminAuditEntry, AdminSectionStatus, AdminSectionSummary } from '@/lib/types';
import styles from './admin-surface.module.css';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminStatItem = {
  label: string;
  value: ReactNode;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function adminStatusTone(status: AdminSectionStatus) {
  if (status === 'critical') return 'Critical';
  if (status === 'warning') return 'Watch';
  return 'Ready';
}

export function AdminPageHeader({
  breadcrumbs,
  title,
  summary,
  actions,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  summary?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className={styles.breadcrumb}>
            {index > 0 ? <span aria-hidden="true" className={styles.breadcrumbDivider}>/</span> : null}
            {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
          </span>
        ))}
      </nav>
      <div className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <h1 className={styles.headerTitle}>{title}</h1>
          {summary ? <p className={styles.headerSummary}>{summary}</p> : null}
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
    </header>
  );
}

export function AdminWorkspace({
  rail,
  children,
  className,
}: {
  rail: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={joinClassNames(styles.workspace, className)}>
      <aside className={styles.actionRail} aria-label="Primary admin actions">
        {rail}
      </aside>
      <div className={styles.readbackPane} aria-label="Verification and recent state">
        {children}
      </div>
    </section>
  );
}

export function AdminRailSection({
  eyebrow,
  title,
  description,
  children,
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={joinClassNames(styles.railSection, className)}>
      <div className={styles.sectionHeader}>
        {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function AdminPaneSection({
  eyebrow,
  title,
  actions,
  children,
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={joinClassNames(styles.paneSection, className)}>
      <div className={styles.paneSectionHeader}>
        <div className={styles.sectionHeader}>
          {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
          <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
        {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function AdminStatStrip({
  items,
  className,
}: {
  items: AdminStatItem[];
  className?: string;
}) {
  return (
    <section className={joinClassNames(styles.statStrip, className)} aria-label="Admin statistics">
      {items.map((item) => (
        <article key={item.label} className={styles.statItem}>
          <span className={styles.statLabel}>{item.label}</span>
          <strong className={styles.statValue}>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function AdminKeyValueList({
  items,
  className,
}: {
  items: Array<[string, ReactNode]>;
  className?: string;
}) {
  return (
    <dl className={joinClassNames(styles.keyValueList, className)}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.keyValueRow}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminSectionStatusList({
  summaries,
}: {
  summaries: AdminSectionSummary[];
}) {
  return (
    <div className={styles.statusList}>
      {summaries.map((summary) => (
        <Link key={summary.key} href={summary.href} className={styles.statusRow} data-status={summary.status}>
          <div className={styles.statusRowHeader}>
            <span className={styles.statusLabel}>{summary.label}</span>
            <span className={styles.statusTone}>{adminStatusTone(summary.status)}</span>
          </div>
          <strong className={styles.statusPrimary}>{summary.primary}</strong>
          <p className={styles.statusSecondary}>{summary.secondary}</p>
          <div className={styles.statusMeta}>
            {summary.chips.map((chip) => (
              <span key={chip} className={styles.metaToken}>{chip}</span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AdminAuditFeed({
  entries,
  emptyMessage,
}: {
  entries: AdminAuditEntry[];
  emptyMessage: string;
}) {
  if (!entries.length) {
    return <p className={styles.emptyNote}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.auditFeed}>
      {entries.map((entry) => (
        <article key={entry.id} className={styles.auditRow}>
          <div className={styles.auditRowHeader}>
            <strong>{entry.actionLabel}</strong>
            <span className={styles.metaToken}>{entry.section}</span>
          </div>
          <p className={styles.auditSummary}>{entry.summary}</p>
          <div className={styles.auditMeta}>
            <span>{entry.actorDisplayName}</span>
            <span>{formatDate(entry.createdAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AdminDataTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage: string;
}) {
  if (!rows.length) {
    return <p className={styles.emptyNote}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InlineConfirmBar({
  title,
  detail,
  meta,
  children,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onCancel,
  busy,
  confirmDisabled,
  tone = 'default',
}: {
  title: string;
  detail: string;
  meta?: Array<{ label: string; value: ReactNode }>;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className={joinClassNames(styles.inlineConfirmBar, tone === 'danger' && styles.inlineConfirmBarDanger)}>
      <div className={styles.inlineConfirmCopy}>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {meta?.length ? (
        <div className={styles.inlineConfirmMeta}>
          {meta.map((item) => (
            <div key={item.label} className={styles.inlineConfirmMetric}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {children ? <div className={styles.inlineConfirmExtra}>{children}</div> : null}
      <div className={styles.inlineConfirmActions}>
        <button type="button" className="button" disabled={busy || confirmDisabled} onClick={onConfirm}>
          {busy ? (pendingLabel ?? confirmLabel) : confirmLabel}
        </button>
        <button type="button" className="button button--secondary button--small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
