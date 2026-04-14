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
      <section className={`editorial-surface editorial-surface--hero ${styles.broadcast}`}>
        <div className={styles.broadcastCopy}>
          <p className="kicker">Live on Twitch</p>
          <h1>Watch Ghosted in motion before you ever join the call.</h1>
          <p className="editorial-copy">
            The stream is the fastest way to catch Ghosted in motion. Start with the clan live on Twitch, then catch
            clips and replays once the night settles.
          </p>
          <div className={styles.broadcastSignals} aria-label="Ghosted live stream signals">
            <span className="app-chip">Live clan nights</span>
            <span className="app-chip">Ghostling showcases</span>
            <span className="app-chip">Discord callouts</span>
          </div>
          <div className="app-inline-actions">
            <a href={GHOSTED_CONTENT.links.twitch} target="_blank" rel="noopener noreferrer" className="button">
              Watch on Twitch
            </a>
            <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button button--secondary">
              Join Discord
            </a>
          </div>
        </div>
        <div className={styles.broadcastFrame}>
          <iframe
            title="Ghosted Twitch stream"
            src={buildTwitchPlayerSrc(hostname)}
            className={styles.frame}
            allowFullScreen
          />
        </div>
      </section>

      <section className={styles.replaySection}>
        <div className={styles.replayHeader}>
          <p className="kicker">Clips and replays</p>
          <h2>Catch the moments worth replaying after the stream.</h2>
          <p className="editorial-copy">
            Replays stay here for anyone who missed the live call or wants the highlights again.
          </p>
        </div>

        <div className={styles.replayList}>
          {CLIPS.map((clip, index) => (
            <article key={clip.title} className={styles.replayRow}>
              <div className={styles.replayRowHeader}>
                <span className="app-chip">Replay {index + 1}</span>
                <h3>{clip.title}</h3>
              </div>
              <p className="editorial-copy">{clip.meta}</p>
              <a href={GHOSTED_CONTENT.links.twitch} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">
                Open replay
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
