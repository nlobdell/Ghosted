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
        <div className={styles.storyGrid}>
          <div className={styles.storyCopy}>
            <p className="kicker">About Ghosted</p>
            <h1 className={styles.storyTitle}>Ghosted is a Discord-first OSRS clan built for loud nights, visible proof, and a Hall that remembers you.</h1>
            <p className="editorial-copy">
              The public site keeps the clan visible, the stream keeps the nights loud, and the Hall turns that energy
              into your own Ghostling, rewards loop, and competition presence.
            </p>
            <div className="app-inline-actions">
              <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button">
                Join Discord
              </a>
              <Link href="/hall/" className="button button--secondary">
                Enter the Hall
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.leadership}>
        <div className={styles.leadershipIntro}>
          <p className="kicker">Who keeps it moving</p>
          <h2 className={styles.leadershipTitle}>Ghosted runs on stream voice, member routing, and community leads who keep the nights alive.</h2>
        </div>
        <div className="editorial-grid-three">
          {LEADERS.map((leader) => (
            <article key={leader.name} className={`editorial-surface editorial-card ${styles.card}`}>
              <span className="app-chip">{leader.role}</span>
              <h3>{leader.name}</h3>
              <p className="editorial-copy">{leader.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
