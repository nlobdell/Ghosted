import type { Metadata } from 'next';
import Link from 'next/link';
import { GhostlingScene } from '@/components/GhostlingScene';
import { NewsPreview } from '@/components/home/NewsPreview';
import { getConfiguredLoginHref } from '@/lib/auth/server-config';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import {
  buildHomePageSceneFixture,
  type HomePageSceneFixtureId,
} from '@/lib/homepage-scene-fixtures';
import { getServerJSON } from '@/lib/server-api';
import type { CompanionPreviewSummary, NewsPost, ScenePresencePayload, ShellData } from '@/lib/types';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Home',
};

function getHallHref(shellData: ShellData | null) {
  if (shellData?.authenticated) return '/hall/';
  return shellData?.auth?.loginHref ?? getConfiguredLoginHref('/hall/') ?? '/';
}

function heroSignal(payload: ScenePresencePayload | null) {
  const liveCount = payload?.members.length ?? 0;
  if (liveCount <= 0) {
    return {
      chip: 'House mascot live',
      text: 'The commons are idling with the house Ghostling while the next crowd gathers.',
    };
  }

  if (payload?.source === 'voice') {
    return {
      chip: `${liveCount} live now`,
      text: 'The shared stage is syncing live voice presence with recent clan activity.',
    };
  }

  return {
    chip: `${liveCount} active now`,
    text: 'The shared stage is reflecting recent clan activity from the wider Ghosted roster.',
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sceneDebug?: string; sceneEditor?: string; sceneFixture?: string }>;
}) {
  const params = await searchParams;
  const fixtureId = process.env.NODE_ENV !== 'production'
    && params.sceneFixture === 'visual-baseline'
    ? 'visual-baseline'
    : null;
  const [newsPayload, shellData, livePresencePayload, fallbackCompanion] = await Promise.all([
    getServerJSON<{ posts: NewsPost[] }>('/api/news?limit=3'),
    getServerJSON<ShellData>('/api/site-shell?next=%2Fhall%2F'),
    fixtureId ? Promise.resolve<ScenePresencePayload | null>(null) : getServerJSON<ScenePresencePayload>('/api/scene/presence'),
    getServerJSON<CompanionPreviewSummary>('/api/companion/preview'),
  ]);
  const presencePayload = fixtureId
    ? buildHomePageSceneFixture(fixtureId as HomePageSceneFixtureId, fallbackCompanion)
    : livePresencePayload;

  const previewPosts = newsPayload?.posts?.slice(0, 3) ?? [];
  const hallHref = getHallHref(shellData);
  const signal = heroSignal(presencePayload);
  const debugWorldOverlay = process.env.NODE_ENV !== 'production' && params.sceneDebug === '1';
  const sceneEditorEnabled = process.env.NODE_ENV !== 'production' && params.sceneEditor === '1';
  const sandboxPayload = sceneEditorEnabled
    ? buildHomePageSceneFixture('visual-baseline', fallbackCompanion)
    : null;

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.heroBleed} aria-label="Ghosted live canvas hero">
        <GhostlingScene
          variant="hero"
          fallbackMode="single"
          initialPayload={presencePayload}
          fallbackCompanion={fallbackCompanion}
          world="shared-commons"
          preset="public-hero"
          debugWorldOverlay={debugWorldOverlay}
          sceneEditorEnabled={sceneEditorEnabled}
          sceneEditorSandboxPayload={sandboxPayload}
          realtimeDisabled={Boolean(fixtureId)}
        />

        <div className={styles.heroRail}>
          <div className={styles.heroRailInner}>
            <div className={styles.heroSignal}>
              <span className={styles.heroSignalChip}>{signal.chip}</span>
              <span className={styles.heroSignalText}>{signal.text}</span>
            </div>

            <div className={styles.heroActions}>
              <a className="button" href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
              <Link className="button button--secondary" href={hallHref}>
                Enter the Hall
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.contentShell}>
        <NewsPreview posts={previewPosts} />
      </div>
    </main>
  );
}
