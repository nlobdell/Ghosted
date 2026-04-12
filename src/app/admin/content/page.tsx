'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { AdminContentData, NewsPost } from '@/lib/types';
import {
  AdminAuditFeed,
  AdminPageHeader,
  AdminPaneSection,
  AdminRailSection,
  AdminStatStrip,
  AdminWorkspace,
  InlineConfirmBar,
} from '../admin-ui';
import styles from '../admin-surface.module.css';

type PendingDispatchReview = {
  title: string;
  excerpt: string;
  body: string;
  status: 'draft' | 'published';
  publishedAt?: string;
};

function normalizeAdminCopy(text: string) {
  return text
    .replace(/\bWOM\b/g, 'Wise Old Man')
    .replaceAll('Companion', 'Ghostling')
    .replaceAll('companion', 'Ghostling');
}

export default function AdminContentPage() {
  const [data, setData] = useState<AdminContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [dispatchReview, setDispatchReview] = useState<PendingDispatchReview | null>(null);
  const [deleteReview, setDeleteReview] = useState<NewsPost | null>(null);
  const [busyAction, setBusyAction] = useState<'save' | 'delete' | null>(null);

  async function loadContent() {
    const nextData = await getJSON<AdminContentData>('/api/admin/content');
    setData(nextData);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadContent())
      .catch((nextError) => {
        setError(nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Failed to load content admin.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshAfterMutation(successText: string) {
    await loadContent();
    setMessage({ text: successText, variant: 'info' });
  }

  async function submitDispatch(payload: PendingDispatchReview, form?: HTMLFormElement) {
    setBusyAction('save');
    setMessage(null);
    try {
      await getJSON('/api/admin/news', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          excerpt: payload.excerpt,
          body: payload.body,
          status: payload.status,
          publishedAt: payload.publishedAt || undefined,
        }),
      });
      form?.reset();
      setDispatchReview(null);
      await refreshAfterMutation(
        payload.status === 'published'
          ? 'Dispatch published. Check the public record before sharing it.'
          : 'Draft saved.',
      );
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Dispatch save failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDispatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: PendingDispatchReview = {
      title: String(formData.get('title') ?? '').trim(),
      excerpt: String(formData.get('excerpt') ?? '').trim(),
      body: String(formData.get('body') ?? '').trim(),
      status: String(formData.get('status') ?? 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft',
      publishedAt: String(formData.get('publishedAt') ?? '').trim() || undefined,
    };

    if (payload.status === 'published') {
      setDispatchReview(payload);
      return;
    }

    await submitDispatch(payload, form);
  }

  async function confirmDelete(post: NewsPost) {
    setBusyAction('delete');
    setMessage(null);
    try {
      await getJSON(`/api/admin/news/${post.id}`, { method: 'DELETE' });
      setDeleteReview(null);
      await refreshAfterMutation('Dispatch deleted. Review the remaining register.');
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Delete failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="Loading content admin..." variant="info" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        {error ? <Banner message={error} variant="error" /> : null}
        <EmptyState message="Content admin could not be loaded." action={<Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>} />
      </main>
    );
  }

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Content' },
        ]}
        title="Dispatch operations"
        summary="Compose in the rail, then confirm publish, review records, and watch audit in the main pane."
        actions={<Link href="/admin/" className="button button--secondary button--small">Back to hub</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}
      {data.alerts.map((alert) => (
        <Banner key={alert.id} message={`${alert.title}. ${alert.detail}`} variant={alert.variant} />
      ))}

      <AdminStatStrip
        items={[
          { label: 'Published', value: String(data.stats.publishedCount) },
          { label: 'Drafts', value: String(data.stats.draftCount) },
          { label: 'Published in 24h', value: String(data.stats.recentlyPublishedCount) },
        ]}
      />

      <AdminWorkspace
        rail={(
          <AdminRailSection
            eyebrow="Compose"
            title="Publish dispatch"
            description="Draft or publish one update."
          >
            <form onSubmit={handleDispatchSubmit} className={styles.formStack}>
              <FormField label="Title">
                <input name="title" type="text" className="input-base" placeholder="Headline" required />
              </FormField>
              <FormField label="Excerpt">
                <input name="excerpt" type="text" className="input-base" placeholder="Summary" required />
              </FormField>
              <FormField label="Body">
                <textarea name="body" rows={7} className="input-base" placeholder="Write the dispatch..." required />
              </FormField>
              <div className={styles.fieldPair}>
                <FormField label="Status">
                  <select name="status" className="input-base" defaultValue="draft">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </FormField>
                <FormField label="Publish at">
                  <input name="publishedAt" type="datetime-local" className="input-base" />
                </FormField>
              </div>
              <button className="button" type="submit" disabled={busyAction === 'save'}>
                {busyAction === 'save' ? 'Saving...' : 'Save dispatch'}
              </button>
            </form>

            {dispatchReview ? (
              <InlineConfirmBar
                title="Confirm public dispatch"
                detail="This dispatch will become public as soon as you confirm."
                meta={[
                  { label: 'Title', value: dispatchReview.title },
                  { label: 'Publish at', value: dispatchReview.publishedAt ? formatDate(dispatchReview.publishedAt) : 'Immediately' },
                ]}
                confirmLabel="Confirm publish"
                pendingLabel="Publishing..."
                busy={busyAction === 'save'}
                onConfirm={() => void submitDispatch(dispatchReview)}
                onCancel={() => setDispatchReview(null)}
              />
            ) : null}
          </AdminRailSection>
        )}
      >
        <AdminPaneSection eyebrow="Register" title="Dispatch register">
          {data.posts.length ? (
            <div className={styles.registerList}>
              {data.posts.map((post) => (
                <article key={post.id} className={styles.registerRow}>
                  <div className={styles.registerHeader}>
                    <strong className={styles.registerTitle}>{post.title}</strong>
                    <span className={styles.metaToken}>{post.status}</span>
                  </div>
                  <p className={styles.registerSummary}>{post.excerpt}</p>
                  <div className={styles.registerMeta}>
                    <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                    <span>{post.authorDisplayName}</span>
                  </div>
                  <div className={styles.registerActions}>
                    {post.status === 'published' ? (
                      <Link href={`/news/${post.slug}/`} className="button button--secondary button--small">
                        Open public
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      onClick={() => setDeleteReview(post)}
                    >
                      Delete
                    </button>
                  </div>
                  {deleteReview?.id === post.id ? (
                    <InlineConfirmBar
                      title="Confirm delete"
                      detail="Deleting this dispatch removes it from admin records and the public archive."
                      confirmLabel="Confirm delete"
                      pendingLabel="Deleting..."
                      tone="danger"
                      busy={busyAction === 'delete'}
                      onConfirm={() => void confirmDelete(post)}
                      onCancel={() => setDeleteReview(null)}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>No dispatches created yet.</p>
          )}
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Audit" title="Recent content actions">
          <AdminAuditFeed entries={data.recentAudit} emptyMessage="No content audit entries yet." />
        </AdminPaneSection>
      </AdminWorkspace>
    </main>
  );
}
