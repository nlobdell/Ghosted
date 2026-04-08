import Link from 'next/link';
import { formatDate } from '@/lib/api';
import type { NewsPost } from '@/lib/types';

export function NewsPreview({ posts }: { posts: NewsPost[] }) {
  if (!posts.length) return null;

  const featuredPost = posts[0] ?? null;
  const archivePosts = posts.slice(1);

  return (
    <section className="home-section home-section--news">
      <div className="home-section__copy">
        <p className="kicker">Dispatches</p>
        <h2>Start with the latest clan call, then catch up on everything that led here.</h2>
        <p>Dispatches flag event windows, Hall changes, and the next reason to show up.</p>
        <Link href="/news/" className="button button--secondary button--small">
          Open all dispatches
        </Link>
      </div>
      <div className="home-news-layout">
        {featuredPost ? (
          <article className="home-news-feature">
            <p>Featured dispatch</p>
            <h3>{featuredPost.title}</h3>
            <span>{featuredPost.excerpt}</span>
            <span>{formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}</span>
            <Link href={`/news/${featuredPost.slug}/`} className="button button--secondary button--small">
              Read featured dispatch
            </Link>
          </article>
        ) : null}
        <div className="home-news-list">
          {archivePosts.map((post) => (
            <article key={post.id} className="home-news-card">
              <p>Recent dispatch</p>
              <h3>{post.title}</h3>
              <span>{post.excerpt}</span>
              <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
              <Link href={`/news/${post.slug}/`} className="button button--secondary button--small">
                Read dispatch
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
