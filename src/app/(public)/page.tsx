/* eslint-disable @next/next/no-img-element -- Homepage hero uses the auth-aware same-origin Ghostling render endpoint. */
import type { Metadata } from 'next';
import { HeroSection } from '@/components/home/HeroSection';
import { SocialProofStrip } from '@/components/home/SocialProofStrip';
import { NewsPreview } from '@/components/home/NewsPreview';
import { getConfiguredLoginHref } from '@/lib/auth/server-config';
import { getServerJSON } from '@/lib/server-api';
import type { CompanionData, NewsPost, ShellData } from '@/lib/types';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Home',
};

function getHallHref(shellData: ShellData | null) {
  if (shellData?.authenticated) return '/hall/';
  return shellData?.auth?.loginHref ?? getConfiguredLoginHref('/hall/') ?? '/';
}

export default async function HomePage() {
  const [newsPayload, shellData, companionData] = await Promise.all([
    getServerJSON<{ posts: NewsPost[] }>('/api/news?limit=3'),
    getServerJSON<ShellData>('/api/site-shell?next=%2Fhall%2F'),
    getServerJSON<CompanionData>('/api/companion'),
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
            </div>

            <aside className={styles.stagePane} aria-label="Ghostling preview">
              <div className={styles.stageFrame}>
                <span className={styles.stageLabel}>{stageName ? 'Your Ghostling preview' : 'Ghostling preview'}</span>
                <div className={styles.stageCanvas}>
                  <img
                    src={companionData?.animatedRenderUrl ?? '/api/companion/render-animated'}
                    alt={companionData ? `${companionData.user.displayName}'s Ghostling preview` : stageName ? `${stageName}'s Ghostling preview` : 'Ghosted Ghostling preview'}
                    className={styles.stageImage}
                  />
                </div>
                <div className={styles.stageMeta}>
                  <strong>{companionData?.user.displayName ?? stageName ?? 'Ghosted house Ghostling'}</strong>
                  <span>
                    {stageName
                      ? 'Your Ghostling is ready when you step into the Hall.'
                      : 'The house Ghostling keeps the preview warm until you join the clan.'}
                  </span>
                </div>
              </div>
              <SocialProofStrip />
            </aside>
          </div>
        </div>
      </section>

      <NewsPreview posts={previewPosts} />
    </main>
  );
}
