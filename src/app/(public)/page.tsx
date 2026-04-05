/* eslint-disable @next/next/no-img-element -- Homepage hero uses the auth-aware same-origin Ghostling render endpoint. */
import type { Metadata } from 'next';
import { HeroSection } from '@/components/home/HeroSection';
import { SocialProofStrip } from '@/components/home/SocialProofStrip';
import { NewsPreview } from '@/components/home/NewsPreview';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import { getServerJSON } from '@/lib/server-api';
import type { NewsPost, ShellData } from '@/lib/types';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Ghosted Clan | Community Hub',
};

function getHallHref(shellData: ShellData | null) {
  if (shellData?.authenticated) return '/hall/';
  return shellData?.auth?.loginHref ?? '/auth/login?next=%2Fhall%2F';
}

export default async function HomePage() {
  const [newsPayload, shellData] = await Promise.all([
    getServerJSON<{ posts: NewsPost[] }>('/api/news?limit=3'),
    getServerJSON<ShellData>('/api/site-shell?next=%2Fhall%2F'),
  ]);

  const previewPosts = newsPayload?.posts?.slice(0, 3) ?? [];
  const hallHref = getHallHref(shellData);
  const stageName = shellData?.authenticated && shellData.user ? shellData.user.displayName : null;

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden="true" />

        <div className={styles.heroShell}>
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <HeroSection hallHref={hallHref} />

              <div className={styles.metaRow}>
                <span>Discord-first member hub</span>
                <span className={styles.metaDivider} aria-hidden="true" />
                <span>{GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()} Discord members</span>
                <span className={styles.metaDivider} aria-hidden="true" />
                <span>{GHOSTED_CONTENT.wom.memberCount.toLocaleString()} WOM-tracked members</span>
              </div>
            </div>

            <aside className={styles.stagePane} aria-label="Ghostling preview">
              <div className={styles.stageFrame}>
                <span className={styles.stageLabel}>{stageName ? 'Your Ghostling' : 'Ghostling preview'}</span>
                <div className={styles.stageCanvas}>
                  <img
                    src="/api/companion/render-animated"
                    alt={stageName ? `${stageName}'s Ghostling preview` : 'Ghosted Ghostling preview'}
                    className={styles.stageImage}
                  />
                </div>
                <div className={styles.stageMeta}>
                  <strong>{stageName ?? 'Ghosted Ghostling'}</strong>
                  <span>{stageName ? 'Signed-in members see their own Ghostling here.' : 'Visitors see the default ghost until they enter the Hall.'}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <SocialProofStrip />
      <NewsPreview posts={previewPosts} />
    </main>
  );
}
