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
            <div className="home-news-feature__meta">
              <span>Featured dispatch</span>
              <span>{formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}</span>
            </div>
            <h3>{featuredPost.title}</h3>
            <p>{featuredPost.excerpt}</p>
            <Link href={`/news/${featuredPost.slug}/`} className="button button--secondary button--small">
              Read featured dispatch
            </Link>
          </article>
        ) : null}
        <div className="home-news-list">
          {archivePosts.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}/`} className="home-news-row">
              <div className="home-news-row__head">
                <span>Recent dispatch</span>
                <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
              </div>
              <strong>{post.title}</strong>
              <span className="home-news-row__excerpt">{post.excerpt}</span>
              <span className="home-news-row__action">Read dispatch</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
