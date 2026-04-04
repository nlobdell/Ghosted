/**
 * Shared presentational primitives for app pages.
 * All components are pure React — no data fetching.
 */
import Link from 'next/link';
import type { StatItem, LedgerEntry, LeaderboardEntry } from '@/lib/types';
import { formatDate, formatMaybeNumber, formatMetricLabel, formatCompetitionWindow, escapeHtml } from '@/lib/api';

/* ── Layout ── */

export const CONTAINER: React.CSSProperties = {
  width: 'min(1180px, calc(100vw - 2rem))',
  marginInline: 'auto',
};

export const APP_SHELL: React.CSSProperties = {
  display: 'grid',
  gap: '1.2rem',
  alignContent: 'start',
  padding: '1.35rem 0 calc(4rem + var(--safe-bottom))',
};

/* ── Context header ── */

interface BreadcrumbItem { label: string; href?: string }

export function AppContext({
  breadcrumbs,
  title,
  actions,
  slim = true,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  actions?: React.ReactNode;
  slim?: boolean;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: slim ? '1fr' : 'minmax(0, 1fr) minmax(240px, 0.48fr)',
        gap: slim ? '0.6rem' : '1rem',
        position: 'relative',
        padding: slim ? '1rem 1.25rem' : '1.35rem',
        border: '1px solid rgba(255, 244, 224, 0.06)',
        borderRadius: 'calc(1.9rem + 0.25rem)',
        background: 'radial-gradient(circle at 100% 0%, rgba(155, 107, 255, 0.12), transparent 30%), linear-gradient(180deg, rgba(23, 20, 22, 0.88), rgba(10, 9, 12, 0.98)), rgba(24, 21, 33, 0.9)',
        boxShadow: 'var(--shadow-soft)',
        overflow: 'hidden',
      }}
    >
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', color: '#746d82', fontSize: '0.82rem' }} aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {crumb.href ? (
              <Link href={crumb.href} style={{ color: '#9d96ad', textDecoration: 'none' }}>{crumb.label}</Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.55rem, 3vw, 2.2rem)',
          lineHeight: 0.96,
          maxWidth: '14ch',
        }}>
          {title}
        </h1>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Stat strip ── */

export function StatStrip({ stats }: { stats: StatItem[] }) {
  return (
    <section
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}
      aria-label="Summary statistics"
    >
      {stats.map((stat) => {
        const inner = (
          <>
            <div style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.65rem)', fontWeight: 800, lineHeight: 1, color: '#f3f1f9' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9d96ad', marginTop: '0.35rem' }}>
              {stat.label}
            </div>
          </>
        );
        const baseStyle: React.CSSProperties = {
          display: 'grid',
          gap: '0.35rem',
          minHeight: '6rem',
          padding: '0.95rem 1rem',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.35rem',
          background: 'rgba(18, 15, 19, 0.72)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
          textDecoration: 'none',
          color: 'inherit',
        };
        return stat.href ? (
          <Link key={stat.label} href={stat.href} style={baseStyle}>{inner}</Link>
        ) : (
          <article key={stat.label} style={baseStyle}>{inner}</article>
        );
      })}
    </section>
  );
}

/* ── Panel ── */

export function Panel({
  eyebrow, title, chip, body, href, subtle,
}: {
  eyebrow?: string;
  title: string;
  chip?: string;
  body: React.ReactNode;
  href?: string;
  subtle?: boolean;
}) {
  const style: React.CSSProperties = {
    padding: '1.1rem 1.15rem',
    display: 'grid',
    gap: '0.8rem',
    alignContent: 'start',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '1.35rem',
    background: subtle ? 'rgba(255,255,255,0.03)' : 'rgba(18, 15, 19, 0.72)',
    boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
    textDecoration: 'none',
    color: 'inherit',
    containerType: 'inline-size',
    transition: href ? 'transform var(--ease-standard), border-color var(--ease-standard)' : undefined,
  };
  const header = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {eyebrow && <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{eyebrow}</p>}
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
        {chip && <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '2rem', padding: '0.26rem 0.72rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.045)', color: '#f3f1f9', fontSize: '0.78rem', fontWeight: 700 }}>{chip}</span>}
      </div>
      <div style={{ display: 'grid', gap: '0.8rem' }}>{body}</div>
    </>
  );
  if (href) return <Link href={href} style={style}>{header}</Link>;
  return <article style={style}>{header}</article>;
}

/* ── Two-col grid ── */

export function AppGrid({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
      {children}
    </section>
  );
}

/* ── Highlight callout ── */

export function Highlight({
  eyebrow, title, copy, actions, chips, theme = 'dashboard',
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  actions?: React.ReactNode;
  chips?: string[];
  theme?: string;
}) {
  const themes: Record<string, { label: string; title: string; art: string[] }> = {
    admin: { label: 'Control room', title: 'Operator lane', art: ['/src/casino/assets/symbols/crown.svg', '/src/casino/assets/symbols/rune.svg'] },
    community: { label: 'Clan watch', title: 'Roster and comps', art: ['/src/casino/assets/symbols/rune.svg', '/src/casino/assets/symbols/ghost.svg'] },
    giveaways: { label: 'Drop board', title: 'Live entries', art: ['/src/casino/assets/symbols/scatter.svg', '/src/casino/assets/symbols/crown.svg'] },
    rewards: { label: 'Ledger', title: 'Balance rail', art: ['/src/casino/assets/symbols/coin.svg', '/src/casino/assets/symbols/rune.svg'] },
    dashboard: { label: 'Command center', title: 'Ghosted flow', art: ['/src/casino/assets/symbols/ghost.svg', '/src/casino/assets/symbols/rune.svg'] },
  };
  const t = themes[theme] ?? themes.dashboard;
  return (
    <section style={{ display: 'grid' }}>
      <article
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 0.82fr)',
          alignItems: 'stretch',
          padding: '1.1rem 1.15rem',
          gap: '0.8rem',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.35rem',
          background: 'linear-gradient(135deg, rgba(155, 107, 255, 0.1), rgba(95, 75, 139, 0.04)), rgba(14, 12, 16, 0.86)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {eyebrow && <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{eyebrow}</p>}
          <h3 style={{ margin: 0 }}>{title}</h3>
          {copy && <p style={{ margin: 0, color: '#9d96ad', lineHeight: 1.65 }}>{copy}</p>}
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
        <aside
          aria-label={t.label}
          style={{ display: 'grid', gap: '0.8rem', padding: '1rem', borderRadius: '1.35rem', border: '1px solid rgba(255, 244, 224, 0.07)', background: 'radial-gradient(circle at 20% 20%, rgba(155, 107, 255, 0.12), transparent 28%), linear-gradient(180deg, rgba(18, 16, 19, 0.96), rgba(10, 9, 11, 0.96))' }}
        >
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <span style={{ color: '#9d96ad', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t.label}</span>
            <strong style={{ color: '#f3f1f9' }}>{t.title}</strong>
          </div>
          <div style={{ position: 'relative', minHeight: '8rem', borderRadius: '1.35rem', background: 'radial-gradient(circle at center, rgba(155, 107, 255, 0.1), transparent 50%), rgba(255,255,255,0.025)', overflow: 'hidden' }}>
            {t.art.map((src, i) => (
              <img key={src} src={src} alt="" style={{ position: 'absolute', width: 'clamp(4rem, 12vw, 6rem)', aspectRatio: '1', filter: 'drop-shadow(0 16px 28px rgba(0,0,0,0.28))', ...(i === 0 ? { top: '1rem', left: '1rem', transform: 'rotate(-8deg)' } : { right: '1rem', bottom: '0.75rem', transform: 'rotate(12deg)' }) }} />
            ))}
          </div>
          {chips && chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
              {chips.map((chip) => (
                <span key={chip} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '2rem', padding: '0.26rem 0.72rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.045)', color: '#f3f1f9', fontSize: '0.78rem', fontWeight: 700 }}>{chip}</span>
              ))}
            </div>
          )}
        </aside>
      </article>
    </section>
  );
}

/* ── Metric grid ── */

export function MetricGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: 'grid', gap: '0.28rem', padding: '0.85rem 0.95rem', borderRadius: '0.95rem', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.035)' }}>
          <span style={{ color: '#9d96ad', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
          <strong style={{ color: '#f3f1f9' }}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ── Route list ── */

export function RouteList({ routes }: { routes: { href: string; label: string; meta: string; featured?: boolean }[] }) {
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      {routes.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', color: 'inherit', transition: 'transform var(--ease-standard)' }}
        >
          <div style={{ display: 'grid', gap: '0.22rem' }}>
            <strong style={{ display: 'block', color: '#f3f1f9', marginBottom: '0.22rem' }}>{r.label}</strong>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '2rem', padding: '0.26rem 0.72rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.045)', color: '#f3f1f9', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.meta}</span>
        </Link>
      ))}
    </div>
  );
}

/* ── Tag block ── */

export function TagBlock({ label, values, emptyMessage }: { label: string; values?: string[]; emptyMessage: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 0.5rem', color: '#9d96ad' }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
        {(values?.length ? values : [emptyMessage]).map((v) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '2rem', padding: '0.26rem 0.72rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.045)', color: '#f3f1f9', fontSize: '0.78rem', fontWeight: 700 }}>{v}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Ledger table ── */

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <DenseTable
      columns={['When', 'Type', 'Description', 'Amount']}
      rows={entries.map((e) => [
        formatDate(e.createdAt),
        e.entryType,
        e.description,
        `${e.amount > 0 ? '+' : ''}${e.amount.toLocaleString()} pts`,
      ])}
      emptyMessage="No activity yet."
    />
  );
}

/* ── Dense table ── */

export function DenseTable({ columns, rows, emptyMessage }: { columns: string[]; rows: string[][]; emptyMessage: string }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <section style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.35rem', background: 'rgba(13,11,15,0.78)', boxShadow: '0 10px 28px rgba(0,0,0,0.18)', overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth: '40rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={{ padding: '0.85rem 0.95rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', verticalAlign: 'top', color: '#9d96ad', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '0.85rem 0.95rem', verticalAlign: 'top', color: '#d6d1df' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ── Leaderboard table ── */

export function LeaderboardTable({
  entries, valueFormatter, valueLabel,
}: {
  entries: LeaderboardEntry[];
  valueFormatter: (e: LeaderboardEntry) => string;
  valueLabel: string;
}) {
  if (!entries.length) return <EmptyState message="No data available." />;
  return (
    <section style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.35rem', background: 'rgba(13,11,15,0.78)', overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth: '28rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Player', valueLabel].map((c) => (
              <th key={c} style={{ padding: '0.85rem 0.95rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', color: '#9d96ad', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td style={{ padding: '0.85rem 0.95rem', color: '#f3f1f9', fontWeight: 800 }}>{e.rank ?? i + 1}</td>
              <td style={{ padding: '0.85rem 0.95rem' }}>
                <div style={{ display: 'grid', gap: '0.18rem' }}>
                  <strong style={{ color: '#f3f1f9' }}>{e.player?.displayName || e.player?.username || 'Player'}</strong>
                  {e.player?.username && e.player.username !== e.player.displayName && (
                    <span style={{ color: '#9d96ad', fontSize: '0.82rem' }}>@{e.player.username}</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '0.85rem 0.95rem', color: '#d6d1df' }}>{valueFormatter(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ── Feed ── */

export function Feed({ items }: { items: { title: string; meta?: string; eyebrow?: string }[] }) {
  if (!items.length) return <EmptyState message="Nothing to show." />;
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {items.map((item, i) => (
        <article key={i} style={{ padding: '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}>
          <strong style={{ color: '#f3f1f9', display: 'block' }}>{item.title}</strong>
          {item.eyebrow && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.18rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)', color: '#9d96ad', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.eyebrow}</span>}
          {item.meta && <div style={{ color: '#9d96ad', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{item.meta}</div>}
        </article>
      ))}
    </div>
  );
}

/* ── Competition list ── */

export function CompetitionList({ entries, compact = false }: { entries: { title: string; status: string; metric?: string; type?: string; startsAt?: string; endsAt?: string }[]; compact?: boolean }) {
  if (!entries.length) return <EmptyState message="No competitions yet." />;
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {entries.map((e, i) => (
        <article key={i} style={{ padding: compact ? '0.65rem 0' : '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
            <strong style={{ color: '#f3f1f9' }}>{e.title || 'Competition'}</strong>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.26rem 0.72rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.045)', color: '#f3f1f9', fontSize: '0.78rem', fontWeight: 700 }}>{e.status}</span>
          </div>
          {!compact && (
            <div style={{ color: '#9d96ad', fontSize: '0.82rem', marginTop: '0.35rem' }}>
              {formatCompetitionWindow(e)}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/* ── Empty state ── */

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'start', padding: '1.2rem', borderRadius: '0.95rem', border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.025)', gap: '1rem' }}>
      <p style={{ margin: 0, color: '#9d96ad' }}>{message}</p>
      {action}
    </div>
  );
}

/* ── Banner ── */

export function Banner({ message, variant = 'info' }: { message: string; variant?: 'info' | 'warning' | 'error' }) {
  const colors: Record<string, { border: string; bg: string }> = {
    info: { border: 'rgba(155, 107, 255, 0.22)', bg: 'rgba(155, 107, 255, 0.12)' },
    warning: { border: 'rgba(155, 107, 255, 0.22)', bg: 'rgba(155, 107, 255, 0.14)' },
    error: { border: 'rgba(239, 156, 144, 0.26)', bg: 'rgba(239, 156, 144, 0.14)' },
  };
  const c = colors[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      style={{ padding: '0.95rem 1rem', border: `1px solid ${c.border}`, borderRadius: '0.95rem', background: c.bg, color: '#f3f1f9' }}
    >
      {message}
    </div>
  );
}

/* ── Section heading ── */

export function SectionHeading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
      <div>
        {eyebrow && <p style={{ margin: '0 0 0.35rem', color: '#9b6bff', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{eyebrow}</p>}
        <h3 style={{ margin: 0 }}>{title}</h3>
        {copy && <p style={{ margin: '0.5rem 0 0', color: '#9d96ad', lineHeight: 1.65 }}>{copy}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Form field ── */

export function FormField({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <label style={{ color: '#d6d1df', fontWeight: 700 }}>{label}</label>
      {children}
      {note && <p style={{ margin: 0, color: '#9d96ad', fontSize: '0.84rem' }}>{note}</p>}
    </div>
  );
}

/* ── Input shared style ── */

export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.88rem 0.95rem',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '0.85rem',
  background: 'rgba(255,255,255,0.04)',
  color: '#f3f1f9',
  font: 'inherit',
};
