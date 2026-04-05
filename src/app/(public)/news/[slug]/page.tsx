import Link from 'next/link';
import { Banner, EmptyState } from '@/components/ui/AppUI';
import { formatDate } from '@/lib/api';
import { getServerJSON } from '@/lib/server-api';
import type { NewsPost } from '@/lib/types';
import styles from '../../../news/page.module.css';

function renderParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => <p key={`${chunk.slice(0, 24)}-${index}`}>{chunk}</p>);
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const payload = await getServerJSON<{ post: NewsPost }>(`/api/news/${encodeURIComponent(slug)}`);
  const post = payload?.post ?? null;

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.newsShell}`}>
        {!payload ? <Banner message="This update is unavailable right now." variant="error" /> : null}

        {post ? (
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
          <EmptyState
            message="This update no longer exists."
            action={<Link href="/news/" className="button button--secondary button--small">Back to news</Link>}
          />
        )}
    </main>
  );
}
