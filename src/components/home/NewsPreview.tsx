import Link from 'next/link';
import { formatDate } from '@/lib/api';
import type { NewsPost } from '@/lib/types';

export function NewsPreview({ posts }: { posts: NewsPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="home-section">
      <div className="home-section__copy">
        <p className="kicker">Dispatches</p>
        <h2>Official updates stay on the public layer.</h2>
        <p>Track event windows, announcements, and hall notices before you ever cross the auth boundary.</p>
      </div>
      <div className="home-news-grid">
        {posts.map((post) => (
          <article key={post.id} className="home-news-card">
            <p>{formatDate(post.publishedAt ?? post.createdAt)}</p>
            <h3>{post.title}</h3>
            <span>{post.excerpt}</span>
            <Link href={`/news/${post.slug}/`} className="button button--secondary button--small">
              Read update
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
