import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, EmptyState } from '@/components/app/AppUI';
import { formatDate } from '@/lib/api';
import { getServerJSON } from '@/lib/server-api';
import type { NewsPost } from '@/lib/types';
import styles from '../../news/page.module.css';

export const metadata: Metadata = {
  title: 'News',
};

export default async function NewsPage() {
  const payload = await getServerJSON<{ posts: NewsPost[] }>('/api/news?limit=20');
  const posts = payload?.posts ?? [];
  const featuredPost = posts[0] ?? null;
  const archivePosts = posts.slice(1);

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.newsShell}`}>
        <section className={styles.newsHero}>
          <p className={styles.newsHero__eyebrow}>Ghosted dispatches</p>
          <h1 className={styles.newsHero__title}>Clan News</h1>
          <p className={styles.newsHero__summary}>
            Official updates, event windows, and hall notices collected in one editorial feed.
          </p>
        </section>

        {!payload ? <Banner message="News is temporarily unavailable." variant="error" /> : null}

        {posts.length ? (
          <>
            {featuredPost ? (
              <section className={styles.newsLead}>
                <article className={styles.newsFeature}>
                  <p className={styles.newsFeature__label}>Latest dispatch</p>
                  <div className={styles.newsFeature__meta}>
                    <span>{formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}</span>
                    <span>by {featuredPost.authorDisplayName}</span>
                  </div>
                  <h2 className={styles.newsFeature__title}>{featuredPost.title}</h2>
                  <p className={styles.newsFeature__excerpt}>{featuredPost.excerpt}</p>
                  <Link className="button" href={`/news/${featuredPost.slug}/`}>
                    Read the dispatch
                  </Link>
                </article>

                <aside className={styles.newsRail}>
                  <p className={styles.newsRail__label}>Archive</p>
                  {archivePosts.length ? (
                    <div className={styles.newsRail__list}>
                      {archivePosts.slice(0, 4).map((post) => (
                        <Link key={post.id} href={`/news/${post.slug}/`} className={styles.newsRailItem}>
                          <strong>{post.title}</strong>
                          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.newsRail__empty}>The archive will expand as new dispatches are published.</p>
                  )}
                </aside>
              </section>
            ) : null}

            {archivePosts.length ? (
              <section className={styles.newsGrid}>
                {archivePosts.map((post) => (
                  <article key={post.id} className={styles.newsCard}>
                    <div className={styles.newsCard__meta}>
                      <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                      <span>by {post.authorDisplayName}</span>
                    </div>
                    <h2 className={styles.newsCard__title}>{post.title}</h2>
                    <p className={styles.newsCard__excerpt}>{post.excerpt}</p>
                    <Link className="button button--secondary button--small" href={`/news/${post.slug}/`}>
                      Read update
                    </Link>
                  </article>
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState message="No news posts are published yet." />
        )}
    </main>
  );
}
