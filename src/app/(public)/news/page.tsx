import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, EmptyState } from '@/components/ui/AppUI';
import { formatDate } from '@/lib/api';
import { getServerJSON } from '@/lib/server-api';
import type { NewsPost } from '@/lib/types';
import styles from '../../news/page.module.css';

export const metadata: Metadata = {
  title: 'Dispatches',
};

export default async function NewsPage() {
  const payload = await getServerJSON<{ posts: NewsPost[] }>('/api/news?limit=20');
  const posts = payload?.posts ?? [];
  const featuredPost = posts[0] ?? null;
  const archivePosts = posts.slice(1);
  const railPosts = archivePosts.slice(0, 4);
  const fullArchivePosts = archivePosts.slice(railPosts.length);

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.newsShell}`}>
        {!payload ? <Banner message="Dispatches are temporarily unavailable." variant="error" /> : null}

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
                  <h1 className={styles.newsFeature__title}>{featuredPost.title}</h1>
                  <p className={styles.newsFeature__excerpt}>{featuredPost.excerpt}</p>
                  <Link className="button" href={`/news/${featuredPost.slug}/`}>
                    Read the dispatch
                  </Link>
                </article>

                <aside className={styles.newsRail}>
                  <p className={styles.newsRail__label}>More dispatches</p>
                  {railPosts.length ? (
                    <div className={styles.newsRail__list}>
                      {railPosts.map((post) => (
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

            {fullArchivePosts.length ? (
              <section className={styles.newsArchive}>
                <div className={styles.newsArchive__heading}>
                  <p className={styles.newsHero__eyebrow}>Archive</p>
                  <h2>Catch up on the dispatches that brought Ghosted here.</h2>
                </div>
                <div className={styles.newsGrid}>
                  {fullArchivePosts.map((post) => (
                    <article key={post.id} className={styles.newsCard}>
                      <div className={styles.newsCard__meta}>
                        <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                        <span>by {post.authorDisplayName}</span>
                      </div>
                      <h2 className={styles.newsCard__title}>{post.title}</h2>
                      <p className={styles.newsCard__excerpt}>{post.excerpt}</p>
                      <Link className="button button--secondary button--small" href={`/news/${post.slug}/`}>
                        Read dispatch
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState message="No dispatches are published yet." />
        )}
    </main>
  );
}
