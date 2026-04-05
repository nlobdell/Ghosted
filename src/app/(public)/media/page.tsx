import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import styles from '../../media/page.module.css';

export const metadata: Metadata = {
  title: 'Media',
};

const CLIPS = [
  { title: 'Clan night highlights', meta: 'Raids, laughs, and Discord chaos.' },
  { title: 'Competition push', meta: 'Weekly event grind with live callouts.' },
  { title: 'Ghostling showcase', meta: 'Member identity and export moments.' },
  { title: 'Stream recap', meta: 'The latest Ghosted session on Twitch.' },
];

function buildTwitchPlayerSrc(hostname: string) {
  const parentHosts = Array.from(new Set([hostname, 'localhost', 'ghosted.smirkhub.com'].filter(Boolean)));
  const parentQuery = parentHosts.map((host) => `parent=${encodeURIComponent(host)}`).join('&');
  return `https://player.twitch.tv/?channel=vghosted&${parentQuery}`;
}

export default async function MediaPage() {
  const headerStore = await headers();
  const rawHost = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const hostname = rawHost.split(',')[0].trim().split(':')[0];

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.page}`}>
      <section className={`editorial-surface editorial-surface--hero editorial-stack ${styles.hero}`}>
        <p className="kicker">Media layer</p>
        <h1>Live stream energy first. Replayable clan moments second.</h1>
        <p className="editorial-copy">
          The public media page keeps the stream front and center, then fans out into clips and highlights that make
          the community feel alive before a visitor ever signs in.
        </p>
      </section>

      <section className={`editorial-surface editorial-stack ${styles.embed}`}>
        <div className={styles.embedHeader}>
          <div>
            <p className="kicker">Live stream</p>
            <h2>vghosted on Twitch</h2>
          </div>
          <span className="app-chip">Live-ready slot</span>
        </div>
        <iframe
          title="Ghosted Twitch stream"
          src={buildTwitchPlayerSrc(hostname)}
          className={styles.frame}
          allowFullScreen
        />
      </section>

      <section className={`editorial-grid-two ${styles.grid}`}>
        {CLIPS.map((clip) => (
          <article key={clip.title} className={`editorial-surface editorial-card ${styles.card}`}>
            <span className="app-chip">Clip slot</span>
            <h3>{clip.title}</h3>
            <p className="editorial-copy">{clip.meta}</p>
            <a href={GHOSTED_CONTENT.links.twitch} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">
              Watch on Twitch
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
