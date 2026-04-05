import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import styles from '../../about/page.module.css';

export const metadata: Metadata = {
  title: 'About',
};

const LEADERS = [
  { name: 'vghosted', role: 'Founder', note: 'Twitch-led direction, clan identity, and event voice.' },
  { name: 'Hall officers', role: 'Operations', note: 'Keep competitions, rewards, and member routing moving.' },
  { name: 'Community leads', role: 'Culture', note: 'Moderation, recruitment, and Discord-first onboarding.' },
];

export default function AboutPage() {
  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.page}`}>
      <section className={`editorial-surface editorial-stack ${styles.story}`}>
        <p className="kicker">About Ghosted</p>
        <h1>A social OSRS clan with a public front and a private Hall behind it.</h1>
        <p className="editorial-copy">
          Ghosted is a Discord-first community built around events, stream presence, rewards, and a member identity
          loop anchored by the Ghostling. The public site explains the clan. The Hall is where members operate.
        </p>
      </section>

      <section className={`editorial-surface ${styles.join}`}>
        <div>
          <p className="kicker">Join funnel</p>
          <h2>Start in Discord, then earn your place in the Hall.</h2>
          <p className="editorial-copy">
            Meet the crew, watch the event rhythm, and then move into the Hall once you are ready for the
            Ghosted member loop.
          </p>
        </div>
        <div className="app-inline-actions">
          <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button">
            Join Discord
          </a>
          <Link href="/hall/" className="button button--secondary">
            Enter the Hall
          </Link>
        </div>
      </section>

      <section className={`editorial-grid-three ${styles.leadership}`}>
        {LEADERS.map((leader) => (
          <article key={leader.name} className={`editorial-surface editorial-card ${styles.card}`}>
            <span className="app-chip">{leader.role}</span>
            <h3>{leader.name}</h3>
            <p className="editorial-copy">{leader.note}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
