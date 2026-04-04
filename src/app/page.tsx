import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Welcome to the Hall',
};

const BENTO_ITEMS = [
  { href: '/app/community/', icon: '/symbols/rune.svg', label: 'Community', sub: 'Roster, events, and clan comps', wide: true },
  { href: '/app/rewards/', icon: '/symbols/coin.svg', label: 'Rewards', sub: 'Balance and ledger' },
  { href: '/app/giveaways/', icon: '/symbols/scatter.svg', label: 'Giveaways', sub: 'Live drops' },
  { href: '/app/casino/', icon: '/symbols/ghost.svg', label: 'Casino', sub: 'Points floor', wide: true, accent: true },
];

const PILLARS = [
  {
    icon: '/symbols/lantern.svg',
    label: 'Watch',
    heading: 'Twitch starts it.',
    copy: 'Live stream moments and watch nights on the vghosted channel create the first reason to show up.',
  },
  {
    icon: '/symbols/ghost.svg',
    label: 'Belong',
    heading: 'Discord holds it.',
    copy: 'Roles, events, and daily conversation live where the community already talks and coordinates.',
  },
  {
    icon: '/symbols/rune.svg',
    label: 'Act',
    heading: 'The app drives it.',
    copy: 'Rewards, giveaways, competitions, and casino play give members repeatable reasons to come back.',
  },
];

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* ── Hero ── */}
      <header
        style={{
          position: 'relative',
          paddingTop: 'calc(var(--safe-top) + 1rem)',
          paddingBottom: 'var(--spacing-9)',
          overflow: 'clip',
        }}
      >
        {/* Hero gradient overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle at 75% 18%, rgba(155, 107, 255, 0.22), transparent 24%), radial-gradient(circle at 15% 22%, rgba(185, 180, 199, 0.08), transparent 20%)',
          }}
        />

        <div
          style={{
            width: `min(var(--spacing-container), calc(100vw - 2rem - var(--safe-left) - var(--safe-right)))`,
            marginInline: 'auto',
          }}
        >
          <SiteNav />

          {/* Hero content */}
          <div
            style={{
              position: 'relative', zIndex: 2,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 0.92fr) minmax(320px, 0.98fr)',
              gap: 'clamp(1.5rem, 3vw, 3rem)',
              alignItems: 'center',
              marginTop: 'clamp(2rem, 5vw, 4rem)',
            }}
          >
            {/* Copy */}
            <div style={{ display: 'grid', gap: 'var(--spacing-4)', maxWidth: '62ch' }}>
              <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Welcome to Ghosted
              </p>
              <h1 style={{ maxWidth: '11ch' }}>
                An OSRS clan hall for stream nights, events, and people who keep showing up.
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <a
                  className="button"
                  href="https://discord.gg/ghosted"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join Discord
                </a>
                <Link className="button button--secondary" href="/app/">Open App Hub</Link>
              </div>
            </div>

            {/* Bento grid */}
            <div
              aria-label="Ghosted clan features"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
              }}
            >
              {BENTO_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    alignContent: 'end',
                    gap: '0.35rem',
                    padding: '1.25rem',
                    border: item.accent ? '1px solid rgba(155, 107, 255, 0.14)' : '1px solid rgba(255, 244, 224, 0.08)',
                    borderRadius: 'var(--radius-lg)',
                    background: item.accent
                      ? 'linear-gradient(135deg, rgba(155, 107, 255, 0.12), rgba(95, 75, 139, 0.08)), rgba(14, 12, 16, 0.86)'
                      : 'linear-gradient(180deg, rgba(22, 18, 24, 0.72), rgba(10, 8, 12, 0.88))',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    minHeight: item.wide ? '8rem' : '10rem',
                    gridColumn: item.wide ? 'span 2' : undefined,
                    transition: 'transform var(--ease-standard), border-color var(--ease-standard)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: 'radial-gradient(circle at top right, rgba(155, 107, 255, 0.12), transparent 60%)',
                    }}
                  />
                  <img
                    src={item.icon}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      width: item.wide ? 'clamp(3.5rem, 7vw, 5rem)' : 'clamp(2.8rem, 6vw, 4rem)',
                      height: item.wide ? 'clamp(3.5rem, 7vw, 5rem)' : 'clamp(2.8rem, 6vw, 4rem)',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.32)) drop-shadow(0 0 16px rgba(155, 107, 255, 0.14))',
                      opacity: 0.92,
                    }}
                  />
                  <strong style={{ display: 'block', color: '#f3f1f9', fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 1.6vw, 1.25rem)', fontWeight: 700, letterSpacing: '0.01em' }}>
                    {item.label}
                  </strong>
                  <span style={{ color: '#9d96ad', fontSize: '0.84rem' }}>{item.sub}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main id="main-content">
        {/* ── Ecosystem section ── */}
        <section
          style={{
            padding: 'var(--spacing-8) 0',
            position: 'relative',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent 24%), rgba(255,255,255,0.015)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          />
          <div style={{ width: `min(var(--spacing-container), calc(100vw - 2rem))`, marginInline: 'auto' }}>
            <div style={{ display: 'grid', gap: '0.95rem', maxWidth: 'none', textAlign: 'center', marginBottom: 'var(--spacing-6)', justifyItems: 'center' }}>
              <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                How it works
              </p>
              <h2>Three layers. One clan.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
              {PILLARS.map((p) => (
                <article
                  key={p.label}
                  style={{
                    position: 'relative',
                    padding: '1.35rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'linear-gradient(180deg, rgba(27, 23, 27, 0.86), rgba(16, 13, 17, 0.96))',
                    boxShadow: 'var(--shadow-soft)',
                    display: 'grid',
                    gap: '0.85rem',
                  }}
                >
                  <img
                    src={p.icon}
                    alt=""
                    aria-hidden="true"
                    style={{ width: '2.8rem', height: '2.8rem', objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(155, 107, 255, 0.22))' }}
                  />
                  <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    {p.label}
                  </p>
                  <h3>{p.heading}</h3>
                  <p style={{ margin: 0, color: '#9d96ad', lineHeight: 1.68 }}>{p.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ padding: 'var(--spacing-7) 0' }}>
          <div style={{ width: `min(var(--spacing-container), calc(100vw - 2rem))`, marginInline: 'auto' }}>
            <div
              style={{
                position: 'relative',
                padding: '1.55rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(135deg, rgba(155, 107, 255, 0.18), rgba(95, 75, 139, 0.16)), rgba(14, 12, 18, 0.96)',
                boxShadow: 'var(--shadow-soft)',
                display: 'grid',
                gap: '1rem',
              }}
            >
              <p style={{ margin: 0, color: '#9b6bff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Welcome
              </p>
              <h2>Come hang out and get involved.</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <a className="button" href="https://discord.gg/ghosted" target="_blank" rel="noopener noreferrer">
                  Join Discord
                </a>
                <Link className="button button--secondary" href="/app/">Open App Hub</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: `1.8rem 0 calc(2rem + var(--safe-bottom))`,
          color: '#746d82',
          fontSize: '0.94rem',
        }}
      >
        <div
          style={{
            width: `min(var(--spacing-container), calc(100vw - 2rem))`,
            marginInline: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} Ghosted Clan.</p>
        </div>
      </footer>

      {/* Button styles (global — used on many pages) */}
      <style>{`
        .button {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 0.55rem; min-height: 3rem; padding: 0.82rem 1.15rem;
          border-radius: 999px; border: 1px solid rgba(255, 230, 188, 0.16);
          background: linear-gradient(180deg, rgba(173, 145, 255, 0.98), rgba(95, 75, 139, 0.94));
          color: #120d1c; font-weight: 800; text-decoration: none;
          box-shadow: 0 0 48px rgba(155, 107, 255, 0.16);
          transition: transform var(--ease-standard), filter var(--ease-standard);
          touch-action: manipulation;
        }
        .button:hover { transform: translateY(-1px); filter: brightness(1.04); }
        .button--secondary {
          background: rgba(255,255,255,0.03); color: #f3f1f9;
          border-color: rgba(220, 212, 255, 0.09); box-shadow: none;
        }
        .button--secondary:hover { background: rgba(255,255,255,0.07); border-color: rgba(166, 143, 255, 0.24); }
        .button--small { min-height: 2.55rem; padding: 0.58rem 0.92rem; font-size: 0.92rem; }
        @media (max-width: 980px) {
          .site-menu-toggle { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}
