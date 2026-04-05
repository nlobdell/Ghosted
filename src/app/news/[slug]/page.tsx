'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GhostedNav } from '@/components/GhostedNav';
import { Banner, EmptyState } from '@/components/app/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { NewsPost } from '@/lib/types';
import styles from '../page.module.css';

function renderParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => <p key={`${chunk.slice(0, 24)}-${index}`}>{chunk}</p>);
}

export default function NewsDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getJSON<{ post: NewsPost }>(`/api/news/${encodeURIComponent(slug)}`)
      .then((data) => setPost(data.post ?? null))
      .catch((nextError: Error) => setError(nextError.message || 'Failed to load this update.'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className={styles.newsPage}>
      <GhostedNav sticky />
      <main id="main-content" className={`page-shell ${styles.newsShell}`}>
        {error ? <Banner message={error} variant="error" /> : null}
        {loading ? <Banner message="Loading update..." variant="info" /> : null}

        {!loading && !error ? (
          post ? (
            <section className={styles.newsArticleShell}>
              <aside className={styles.newsArticleMeta}>
                <Link href="/news/" className="button button--secondary button--small">Back to news</Link>
                <p className={styles.newsDetail__meta}>{formatDate(post.publishedAt ?? post.createdAt)}</p>
                <p className={styles.newsDetail__meta}>by {post.authorDisplayName}</p>
              </aside>
              <article className={styles.newsDetail}>
                <p className={styles.newsDetail__eyebrow}>Clan dispatch</p>
                <h1 className={styles.newsDetail__title}>{post.title}</h1>
                <p className={styles.newsDetail__excerpt}>{post.excerpt}</p>
                <div className={styles.newsDetail__body}>{renderParagraphs(post.body)}</div>
              </article>
            </section>
          ) : (
            <EmptyState message="This update no longer exists." action={<Link href="/news/" className="button button--secondary button--small">Back to news</Link>} />
          )
        ) : null}
      </main>
    </div>
  );
}
