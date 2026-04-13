'use client';

/* eslint-disable @next/next/no-img-element -- Ghostling asset previews are stored and rendered dynamically. */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type {
  CompanionAdminData,
  CompanionAdminAssetItem,
  CompanionRepoImportCandidate,
  CompanionSlotKey,
} from '@/lib/types';
import {
  AdminAuditFeed,
  AdminKeyValueList,
  AdminPageHeader,
  AdminPaneSection,
  AdminRailSection,
  AdminStatStrip,
  AdminWorkspace,
  InlineConfirmBar,
} from '../admin-ui';
import sharedStyles from '../admin-surface.module.css';
import styles from './page.module.css';

type AdminMutationResponse = {
  ok: boolean;
  message?: string;
  library: CompanionAdminData;
};

type RepoImportDraft = CompanionRepoImportCandidate & {
  selected: boolean;
  slot: CompanionSlotKey;
  rarity: string;
  cost: string;
  description: string;
  active: boolean;
};

type ReplaceReviewState = {
  slug: string;
  name: string;
  files: string[];
};

type EditDraft = {
  name: string;
  nextSlug: string;
  rarity: string;
  cost: string;
  description: string;
  metadataJson: string;
};

type LifecycleReviewState =
  | {
    kind: 'visibility';
    slug: string;
    name: string;
    active: boolean;
  }
  | {
    kind: 'archive' | 'restore' | 'delete';
    slug: string;
    name: string;
  };

const SLOT_ORDER: CompanionSlotKey[] = ['hat', 'face', 'neck', 'body'];
const ASSET_ACCEPT = '.png,.svg,.gif,.webp,.jpg,.jpeg';

function toGhostlingCopy(text: string) {
  return text.replaceAll('Companion', 'Ghostling').replaceAll('companion', 'Ghostling');
}

function toGhostlingError(text: string) {
  if (text.startsWith('Request failed:')) return text;
  return toGhostlingCopy(text);
}

function createImportDrafts(candidates: CompanionRepoImportCandidate[]): RepoImportDraft[] {
  return candidates.map((candidate) => ({
    ...candidate,
    selected: !(candidate.renderMetadataErrors?.length),
    slot: candidate.suggestedSlot ?? 'hat',
    rarity: candidate.suggestedRarity ?? 'common',
    cost: String(candidate.suggestedCost ?? 0),
    description: candidate.suggestedDescription ?? '',
    active: true,
  }));
}

function createEditDraft(item: CompanionAdminAssetItem): EditDraft {
  return {
    name: item.name,
    nextSlug: item.slug,
    rarity: item.rarity,
    cost: String(item.cost),
    description: item.description,
    metadataJson: item.renderMetadata ? JSON.stringify(item.renderMetadata, null, 2) : '',
  };
}

function groupItemsBySlot(items: CompanionAdminAssetItem[]) {
  const groups = new Map<CompanionSlotKey, CompanionAdminAssetItem[]>();
  SLOT_ORDER.forEach((slot) => groups.set(slot, []));
  for (const item of items) {
    groups.get(item.slot)?.push(item);
  }
  return groups;
}

function lifecycleReviewTitle(review: LifecycleReviewState) {
  switch (review.kind) {
    case 'archive':
      return 'Confirm archive';
    case 'restore':
      return 'Confirm restore';
    case 'delete':
      return 'Confirm permanent delete';
    case 'visibility':
      return review.active ? 'Confirm show' : 'Confirm hide';
  }
}

function lifecycleReviewDetail(review: LifecycleReviewState) {
  switch (review.kind) {
    case 'archive':
      return 'Archiving removes this cosmetic from the default live operator list without deleting files or owned player state.';
    case 'restore':
      return 'Restoring brings this cosmetic back into the operator catalog and keeps its previous visible or hidden state.';
    case 'delete':
      return 'Deleting permanently removes this archived cosmetic, purges member ownership and equipped references, and only removes uploaded files that are safe to unlink.';
    case 'visibility':
      return review.active
        ? 'Showing this cosmetic makes it available in the member Ghostling catalog again.'
        : 'Hiding this cosmetic removes it from the member Ghostling catalog without deleting files.';
  }
}

function lifecycleReviewAction(review: LifecycleReviewState) {
  switch (review.kind) {
    case 'archive':
      return 'archive';
    case 'restore':
      return 'restore';
    case 'delete':
      return 'Delete permanently';
    case 'visibility':
      return review.active ? 'Show' : 'Hide';
  }
}

export default function GhostlingAdminPage() {
  const [library, setLibrary] = useState<CompanionAdminData | null>(null);
  const [importDrafts, setImportDrafts] = useState<RepoImportDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'warning' | 'error' } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [replaceReview, setReplaceReview] = useState<ReplaceReviewState | null>(null);
  const [lifecycleReview, setLifecycleReview] = useState<LifecycleReviewState | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const replaceSubmissionRef = useRef<{ form: HTMLFormElement; formData: FormData } | null>(null);

  useEffect(() => {
    getJSON<CompanionAdminData>('/api/companion/admin/library')
      .then((payload) => {
        setLibrary(payload);
        setImportDrafts(createImportDrafts(payload.repoCandidates ?? []));
      })
      .catch((nextError) => {
        setMessage({
          text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Failed to load the Ghostling library.',
          variant: 'error',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleItems = useMemo(
    () => (library?.items ?? []).filter((item) => item.state === 'visible'),
    [library?.items],
  );
  const hiddenItems = useMemo(
    () => (library?.items ?? []).filter((item) => item.state === 'hidden'),
    [library?.items],
  );
  const archivedItems = library?.archivedItems ?? [];
  const visibleGroups = useMemo(() => groupItemsBySlot(visibleItems), [visibleItems]);
  const hiddenGroups = useMemo(() => groupItemsBySlot(hiddenItems), [hiddenItems]);
  const archivedGroups = useMemo(() => groupItemsBySlot(archivedItems), [archivedItems]);

  function applyLibrary(result: AdminMutationResponse, fallbackMessage: string, variant: 'info' | 'warning' = 'info') {
    setLibrary(result.library);
    setImportDrafts(createImportDrafts(result.library.repoCandidates ?? []));
    setMessage({ text: toGhostlingCopy(result.message ?? fallbackMessage), variant });
    setLifecycleReview(null);
    setDeleteConfirmation('');
    setEditingSlug(null);
    setEditDrafts({});
  }

  function itemBySlug(slug: string) {
    return [...(library?.items ?? []), ...(library?.archivedItems ?? [])].find((item) => item.slug === slug) ?? null;
  }

  function openEdit(item: CompanionAdminAssetItem) {
    setEditingSlug(item.slug);
    setEditDrafts((current) => ({
      ...current,
      [item.slug]: current[item.slug] ?? createEditDraft(item),
    }));
  }

  function updateEditDraft(slug: string, field: keyof EditDraft, value: string) {
    const item = itemBySlug(slug);
    if (!item) return;
    setEditDrafts((current) => ({
      ...current,
      [slug]: {
        ...(current[slug] ?? createEditDraft(item)),
        [field]: value,
      },
    }));
  }

  async function handleBaseUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPendingKey('base');
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/base', {
        method: 'POST',
        body: formData,
      });
      applyLibrary(result, 'Ghostling base updated. Check the preview and live paths.');
      form.reset();
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling base upload failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPendingKey('create');
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items', {
        method: 'POST',
        body: formData,
      });
      applyLibrary(result, 'Ghostling cosmetic created. Check the catalog row below.');
      form.reset();
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Custom Ghostling cosmetic upload failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleReplaceAssets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setMessage(null);
    const slug = String(formData.get('slug') ?? '').trim();
    const item = library?.items.find((entry) => entry.slug === slug);
    const files = ['frontAsset', 'backAsset', 'metadata']
      .map((field) => formData.get(field))
      .flatMap((entry) => (entry instanceof File && entry.name ? [entry.name] : []));

    if (!slug || !files.length) {
      setMessage({ text: 'Choose a live cosmetic and at least one file before review.', variant: 'error' });
      return;
    }

    replaceSubmissionRef.current = { form, formData };
    setReplaceReview({
      slug,
      name: item?.name ?? slug,
      files,
    });
  }

  async function confirmReplaceAssets() {
    const submission = replaceSubmissionRef.current;
    if (!submission) return;
    setPendingKey('replace');
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/replace-assets', {
        method: 'POST',
        body: submission.formData,
      });
      applyLibrary(result, 'Ghostling art replaced. Check preview and live files.');
      submission.form.reset();
      replaceSubmissionRef.current = null;
      setReplaceReview(null);
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling asset replacement failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  function requestLifecycleReview(review: LifecycleReviewState) {
    setLifecycleReview(review);
    setDeleteConfirmation('');
    setMessage(null);
  }

  async function confirmLifecycleReview() {
    const review = lifecycleReview;
    if (!review) return;
    let path = '/api/companion/admin/items/restore';
    let body: Record<string, boolean | string> = { slug: review.slug };
    let fallbackMessage = 'Ghostling cosmetic restored. Check the live catalog below.';
    let variant: 'info' | 'warning' = 'info';

    if (review.kind === 'visibility') {
      path = '/api/companion/admin/items/visibility';
      body = { slug: review.slug, active: review.active };
      fallbackMessage = review.active
        ? 'Ghostling cosmetic restored. Check the live catalog row.'
        : 'Ghostling cosmetic hidden. Check the live catalog row.';
    } else if (review.kind === 'archive') {
      path = '/api/companion/admin/items/archive';
      fallbackMessage = 'Ghostling cosmetic archived. Check the archived catalog below.';
    } else if (review.kind === 'delete') {
      path = '/api/companion/admin/items/delete';
      fallbackMessage = 'Ghostling cosmetic permanently deleted.';
    }

    setPendingKey(`${review.kind}:${review.slug}`);
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (review.kind === 'delete' && String(result.message ?? '').includes('Warning:')) {
        variant = 'warning';
      }
      applyLibrary(result, fallbackMessage, variant);
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling lifecycle update failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleMove(slug: string, direction: 'up' | 'down') {
    setPendingKey(`move:${slug}:${direction}`);
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/reorder', {
        method: 'POST',
        body: JSON.stringify({ slug, direction }),
      });
      applyLibrary(result, 'Ghostling order updated. Check the slot rows.');
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling reorder failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSaveEdit(slug: string) {
    const draft = editDrafts[slug];
    if (!draft) return;

    setPendingKey(`edit:${slug}`);
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/update', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          name: draft.name,
          nextSlug: draft.nextSlug,
          rarity: draft.rarity,
          cost: Number(draft.cost || 0),
          description: draft.description,
          metadataJson: draft.metadataJson.trim() || null,
        }),
      });
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      applyLibrary(result, 'Ghostling cosmetic metadata updated.');
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling metadata update failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleImportRepoItems() {
    const selectedItems = importDrafts
      .filter((draft) => draft.selected)
      .map((draft) => ({
        slug: draft.slug,
        name: draft.name,
        slot: draft.slot,
        rarity: draft.rarity,
        cost: Number(draft.cost || 0),
        description: draft.description,
        active: draft.active,
        frontAssetPath: draft.frontAssetPath,
        backAssetPath: draft.backAssetPath,
        renderMetadataPath: draft.renderMetadataPath,
      }));

    if (!selectedItems.length) {
      setMessage({ text: 'Select at least one repo Ghostling cosmetic to import.', variant: 'error' });
      return;
    }

    setPendingKey('import');
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/import-repo', {
        method: 'POST',
        body: JSON.stringify({ items: selectedItems }),
      });
      applyLibrary(result, 'Repo Ghostling cosmetics imported. Check visibility and slot rows.');
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Repo Ghostling import failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  function updateImportDraft(slug: string, field: keyof RepoImportDraft, value: string | boolean) {
    setImportDrafts((current) => current.map((draft) => (draft.slug === slug ? { ...draft, [field]: value } : draft)));
  }

  const liveLibraryCount = library?.items.length ?? 0;
  const totalItems = liveLibraryCount + archivedItems.length;
  const activeItems = visibleItems.length;
  const hiddenItemCount = hiddenItems.length;
  const archivedItemCount = archivedItems.length;
  const repoCandidates = importDrafts.length;

  return (
    <main id="main-content" className={`page-shell workspace-page ${sharedStyles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Ghostling' },
        ]}
        title="Ghostling asset console"
        summary="Run base, import, replace, metadata, and lifecycle operations in the rail, then verify live, hidden, archived, and audit state in the main pane."
        actions={(
          <>
            <Link href="/admin/" className="button button--secondary button--small">Back to hub</Link>
            <Link href="/hall/ghostling/" className="button button--secondary button--small">Open member studio</Link>
          </>
        )}
      />

      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      {loading ? (
        <Banner message="Loading Ghostling asset controls..." variant="info" />
      ) : !library ? (
        <EmptyState
          message="Could not load Ghostling assets. Refresh this page or return to admin."
          action={<Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>}
        />
      ) : (
        <>
          <AdminStatStrip
            items={[
              { label: 'Library total', value: String(totalItems) },
              { label: 'Visible', value: String(activeItems) },
              { label: 'Hidden', value: String(hiddenItemCount) },
              { label: 'Archived', value: String(archivedItemCount) },
              { label: 'Repo imports', value: String(repoCandidates) },
            ]}
          />

          <AdminWorkspace
            className={styles.workspace}
            rail={(
              <>
                <AdminRailSection eyebrow="Base" title="Upload base files" description="Replace the layered Ghostling base.">
                  <form onSubmit={handleBaseUpload} className={sharedStyles.formStack}>
                    <FormField label="Body image">
                      <input name="bodyAsset" type="file" accept={ASSET_ACCEPT} className="input-base" required />
                    </FormField>
                    <FormField label="Head image">
                      <input name="headAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                    </FormField>
                    <button className="button" type="submit" disabled={pendingKey === 'base'}>
                      {pendingKey === 'base' ? 'Uploading...' : 'Upload base files'}
                    </button>
                  </form>
                </AdminRailSection>

                <AdminRailSection eyebrow="Create" title="Create cosmetic" description="Add one cosmetic to the live library.">
                  <form onSubmit={handleCreateItem} className={sharedStyles.formStack}>
                    <div className={sharedStyles.fieldPair}>
                      <FormField label="Name">
                        <input name="name" type="text" placeholder="Moon Hood" className="input-base" required />
                      </FormField>
                      <FormField label="Slug">
                        <input name="slug" type="text" placeholder="moon-hood" className="input-base" />
                      </FormField>
                    </div>
                    <div className={sharedStyles.fieldPair}>
                      <FormField label="Slot">
                        <select name="slot" className="input-base" defaultValue="hat">
                          <option value="hat">Hat</option>
                          <option value="face">Face</option>
                          <option value="neck">Neck</option>
                          <option value="body">Body</option>
                        </select>
                      </FormField>
                      <FormField label="Rarity">
                        <select name="rarity" className="input-base" defaultValue="common">
                          <option value="common">Common</option>
                          <option value="rare">Rare</option>
                          <option value="epic">Epic</option>
                          <option value="legendary">Legendary</option>
                        </select>
                      </FormField>
                    </div>
                    <div className={sharedStyles.fieldPair}>
                      <FormField label="Cost">
                        <input name="cost" type="number" min="0" defaultValue="120" className="input-base" required />
                      </FormField>
                      <FormField label="Front asset">
                        <input name="frontAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                      </FormField>
                    </div>
                    <FormField label="Back asset">
                      <input name="backAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                    </FormField>
                    <FormField label="Metadata sidecar">
                      <input name="metadata" type="file" accept=".json,application/json,text/json" className="input-base" />
                    </FormField>
                    <FormField label="Description">
                      <textarea name="description" rows={3} className="input-base" placeholder="Flavor text" />
                    </FormField>
                    <button className="button" type="submit" disabled={pendingKey === 'create'}>
                      {pendingKey === 'create' ? 'Creating...' : 'Create cosmetic'}
                    </button>
                  </form>
                </AdminRailSection>

                <AdminRailSection eyebrow="Replace" title="Replace live files" description="Overwrite live art on one cosmetic.">
                  {library.items.length ? (
                    <form onSubmit={handleReplaceAssets} className={sharedStyles.formStack}>
                      <FormField label="Cosmetic">
                        <select name="slug" className="input-base" defaultValue={library.items[0]?.slug ?? ''} required>
                          {library.items.map((item) => (
                            <option key={item.slug} value={item.slug}>{item.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <div className={sharedStyles.fieldPair}>
                        <FormField label="Front asset">
                          <input name="frontAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                        </FormField>
                        <FormField label="Back asset">
                          <input name="backAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                        </FormField>
                      </div>
                      <FormField label="Metadata sidecar">
                        <input name="metadata" type="file" accept=".json,application/json,text/json" className="input-base" />
                      </FormField>
                      <button className="button" type="submit" disabled={pendingKey === 'replace'}>
                        {pendingKey === 'replace' ? 'Replacing...' : 'Review replacement'}
                      </button>
                    </form>
                  ) : (
                    <p className={sharedStyles.emptyNote}>Restore or create a live cosmetic before replacing files.</p>
                  )}

                  {replaceReview ? (
                    <InlineConfirmBar
                      title="Confirm live replacement"
                      detail="The selected files will replace the current live art immediately."
                      meta={[
                        { label: 'Cosmetic', value: replaceReview.name },
                        { label: 'Files', value: replaceReview.files.join(', ') },
                      ]}
                      confirmLabel="Confirm replacement"
                      pendingLabel="Replacing..."
                      busy={pendingKey === 'replace'}
                      onConfirm={() => void confirmReplaceAssets()}
                      onCancel={() => {
                        replaceSubmissionRef.current = null;
                        setReplaceReview(null);
                      }}
                    />
                  ) : null}
                </AdminRailSection>
              </>
            )}
          >
            <AdminPaneSection eyebrow="Preview" title="Live preview and state" className={styles.previewPanel}>
              <div className={styles.previewLayout}>
                <div className={styles.previewStage}>
                  <AnimatedCompanionStage
                    manifest={library.base.renderManifest}
                    fallbackSrc={library.base.previewUrl}
                    alt="Ghostling base preview"
                    className={styles.previewStageFrame}
                    targetSize={224}
                    presentation="admin"
                    seedKey="admin:ghostling-preview"
                    showDebugOverlay={showDebugOverlay}
                  />
                </div>
                <div className={styles.previewState}>
                  <AdminKeyValueList
                    items={[
                      ['Storage root', library.storageRoot],
                      ['Current body file', library.base.bodyAssetPath || 'No body uploaded yet'],
                      ['Current head file', library.base.headAssetPath || 'Using default head fallback'],
                      ['Base updated', library.base.updatedAt ? formatDate(library.base.updatedAt) : 'Unknown'],
                      ['Visible cosmetics', `${activeItems}/${liveLibraryCount}`],
                    ]}
                  />
                  <div className={styles.previewActions}>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() => setShowDebugOverlay((current) => !current)}
                    >
                      {showDebugOverlay ? 'Hide debug overlay' : 'Show debug overlay'}
                    </button>
                    {library.base.bodyAssetUrl ? (
                      <a href={library.base.bodyAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                        Open body file
                      </a>
                    ) : null}
                    {library.base.headAssetUrl ? (
                      <a href={library.base.headAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                        Open head file
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </AdminPaneSection>

            <AdminPaneSection eyebrow="Import" title="Repo import queue">
              {repoCandidates ? (
                <div className={styles.importList}>
                  {importDrafts.map((draft) => (
                    <article key={draft.slug} className={styles.importRow}>
                      <div className={styles.importThumbWrap}>
                        {draft.frontAssetUrl ? <img src={draft.frontAssetUrl} alt={`${draft.name} front asset`} className={styles.importThumb} /> : null}
                      </div>
                      <div className={styles.importBody}>
                        <div className={styles.importHeader}>
                          <label className={styles.inlineToggle}>
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={(event) => updateImportDraft(draft.slug, 'selected', event.target.checked)}
                            />
                            <span className={styles.importTitle}>{draft.name}</span>
                          </label>
                          <span className={sharedStyles.metaToken}>{draft.frontAssetPath ?? draft.backAssetPath ?? 'No asset path'}</span>
                        </div>
                        <div className={styles.importGrid}>
                          <FormField label="Name">
                            <input
                              type="text"
                              className="input-base"
                              value={draft.name}
                              onChange={(event) => updateImportDraft(draft.slug, 'name', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Slug">
                            <input
                              type="text"
                              className="input-base"
                              value={draft.slug}
                              onChange={(event) => updateImportDraft(draft.slug, 'slug', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Slot">
                            <select
                              className="input-base"
                              value={draft.slot}
                              onChange={(event) => updateImportDraft(draft.slug, 'slot', event.target.value)}
                            >
                              <option value="hat">Hat</option>
                              <option value="face">Face</option>
                              <option value="neck">Neck</option>
                              <option value="body">Body</option>
                            </select>
                          </FormField>
                          <FormField label="Rarity">
                            <select
                              className="input-base"
                              value={draft.rarity}
                              onChange={(event) => updateImportDraft(draft.slug, 'rarity', event.target.value)}
                            >
                              <option value="common">Common</option>
                              <option value="rare">Rare</option>
                              <option value="epic">Epic</option>
                              <option value="legendary">Legendary</option>
                            </select>
                          </FormField>
                          <FormField label="Cost">
                            <input
                              type="number"
                              min="0"
                              className="input-base"
                              value={draft.cost}
                              onChange={(event) => updateImportDraft(draft.slug, 'cost', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Visible on import">
                            <label className={styles.inlineToggle}>
                              <input
                                type="checkbox"
                                checked={draft.active}
                                onChange={(event) => updateImportDraft(draft.slug, 'active', event.target.checked)}
                              />
                              <span>{draft.active ? 'Visible' : 'Hidden'}</span>
                            </label>
                          </FormField>
                        </div>
                        <FormField label="Description">
                          <textarea
                            rows={2}
                            className="input-base"
                            value={draft.description}
                            onChange={(event) => updateImportDraft(draft.slug, 'description', event.target.value)}
                          />
                        </FormField>
                        <div className={styles.fileMeta}>
                          <span>{draft.frontAssetPath ?? 'No front asset'}</span>
                          {draft.backAssetPath ? <span>{draft.backAssetPath}</span> : null}
                          {draft.renderMetadataPath ? <span>{draft.renderMetadataPath}</span> : null}
                          {draft.renderMetadata ? <span>Anchor metadata ready</span> : null}
                          {(draft.renderMetadataErrors ?? []).map((entry) => (
                            <span key={`${draft.slug}:${entry}`} className={sharedStyles.dangerText}>{entry}</span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                  <button className="button" type="button" onClick={() => void handleImportRepoItems()} disabled={pendingKey === 'import'}>
                    {pendingKey === 'import' ? 'Importing...' : 'Import selected'}
                  </button>
                </div>
              ) : (
                <p className={sharedStyles.emptyNote}>No repo Ghostling assets are ready to import.</p>
              )}
            </AdminPaneSection>

            {[
              {
                eyebrow: 'Visible',
                title: 'Visible catalog controls',
                groups: visibleGroups,
                emptyMessage: 'No visible cosmetics are live right now.',
              },
              {
                eyebrow: 'Hidden',
                title: 'Hidden catalog controls',
                groups: hiddenGroups,
                emptyMessage: 'No hidden cosmetics are waiting in the live library.',
              },
              {
                eyebrow: 'Archived',
                title: 'Archived cosmetics',
                groups: archivedGroups,
                emptyMessage: 'No Ghostling cosmetics are archived right now.',
              },
            ].map((section) => (
              <AdminPaneSection key={section.title} eyebrow={section.eyebrow} title={section.title}>
                <div className={styles.stateSections}>
                  {SLOT_ORDER.map((slot) => {
                    const items = section.groups.get(slot) ?? [];
                    if (!items.length) return null;

                    return (
                      <section key={`${section.title}:${slot}`} className={styles.slotGroup}>
                        <div className={styles.slotHeader}>
                          <h3>{slot}</h3>
                          <span className={sharedStyles.metaToken}>{items.length} items</span>
                        </div>
                        <div className={styles.assetRows}>
                          {items.map((item, index) => {
                            const draft = editDrafts[item.slug] ?? createEditDraft(item);
                            const isEditing = editingSlug === item.slug;
                            const isArchived = item.state === 'archived';

                            return (
                              <article key={item.slug} className={styles.assetRow}>
                                <div className={styles.assetThumbWrap}>
                                  <img src={item.previewUrl} alt={item.name} className={styles.assetThumb} />
                                </div>
                                <div className={styles.assetBody}>
                                  <div className={styles.assetHeader}>
                                    <strong className={styles.assetTitle}>{item.name}</strong>
                                    <div className={styles.assetTokens}>
                                      <span className={sharedStyles.metaToken}>{item.slot}</span>
                                      <span className={sharedStyles.metaToken}>{item.rarity}</span>
                                      <span className={sharedStyles.metaToken}>{item.state}</span>
                                      <span className={sharedStyles.metaToken}>#{item.sortOrder}</span>
                                    </div>
                                  </div>
                                  <p className={sharedStyles.note}>{item.description}</p>
                                  <div className={styles.fileMeta}>
                                    <span>{item.frontAssetPath ?? 'No front asset'}</span>
                                    {item.backAssetPath ? <span>{item.backAssetPath}</span> : null}
                                    {item.renderMetadata ? <span>Anchor metadata attached</span> : <span>Legacy full-canvas placement</span>}
                                    <span>Updated {item.updatedAt ? formatDate(item.updatedAt) : 'Unknown'}</span>
                                    {item.archivedAt ? <span>Archived {formatDate(item.archivedAt)}</span> : null}
                                    {item.archivedByDisplayName ? <span>Archived by {item.archivedByDisplayName}</span> : null}
                                  </div>
                                  <div className={styles.assetActions}>
                                    <button
                                      type="button"
                                      className="button button--secondary button--small"
                                      onClick={() => openEdit(item)}
                                      disabled={pendingKey === `edit:${item.slug}`}
                                    >
                                      {isEditing ? 'Editing' : 'Edit metadata'}
                                    </button>
                                    {!isArchived ? (
                                      <button
                                        type="button"
                                        className="button button--secondary button--small"
                                        onClick={() => requestLifecycleReview({ kind: 'visibility', slug: item.slug, name: item.name, active: !item.active })}
                                        disabled={pendingKey === `visibility:${item.slug}`}
                                      >
                                        {item.active ? 'Hide' : 'Show'}
                                      </button>
                                    ) : null}
                                    {!isArchived ? (
                                      <>
                                        <button
                                          type="button"
                                          className="button button--secondary button--small"
                                          onClick={() => void handleMove(item.slug, 'up')}
                                          disabled={index === 0 || pendingKey === `move:${item.slug}:up`}
                                        >
                                          Up
                                        </button>
                                        <button
                                          type="button"
                                          className="button button--secondary button--small"
                                          onClick={() => void handleMove(item.slug, 'down')}
                                          disabled={index === items.length - 1 || pendingKey === `move:${item.slug}:down`}
                                        >
                                          Down
                                        </button>
                                      </>
                                    ) : null}
                                    {item.frontAssetUrl ? (
                                      <a href={item.frontAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                                        Front file
                                      </a>
                                    ) : null}
                                    {item.backAssetUrl ? (
                                      <a href={item.backAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                                        Back file
                                      </a>
                                    ) : null}
                                    {isArchived ? (
                                      <>
                                        <button
                                          type="button"
                                          className="button"
                                          onClick={() => requestLifecycleReview({ kind: 'restore', slug: item.slug, name: item.name })}
                                          disabled={pendingKey === `restore:${item.slug}`}
                                        >
                                          Restore
                                        </button>
                                        <button
                                          type="button"
                                          className="button button--secondary button--small"
                                          onClick={() => requestLifecycleReview({ kind: 'delete', slug: item.slug, name: item.name })}
                                          disabled={pendingKey === `delete:${item.slug}`}
                                        >
                                          Delete permanently
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="button button--secondary button--small"
                                        onClick={() => requestLifecycleReview({ kind: 'archive', slug: item.slug, name: item.name })}
                                        disabled={pendingKey === `archive:${item.slug}`}
                                      >
                                        Archive
                                      </button>
                                    )}
                                  </div>
                                  {isEditing ? (
                                    <div className={styles.editCard}>
                                      <div className={styles.editGrid}>
                                        <FormField label="Name">
                                          <input
                                            type="text"
                                            className="input-base"
                                            value={draft.name}
                                            onChange={(event) => updateEditDraft(item.slug, 'name', event.target.value)}
                                          />
                                        </FormField>
                                        <FormField label="Slug">
                                          <input
                                            type="text"
                                            className="input-base"
                                            value={draft.nextSlug}
                                            onChange={(event) => updateEditDraft(item.slug, 'nextSlug', event.target.value)}
                                          />
                                        </FormField>
                                        <FormField label="Rarity">
                                          <select
                                            className="input-base"
                                            value={draft.rarity}
                                            onChange={(event) => updateEditDraft(item.slug, 'rarity', event.target.value)}
                                          >
                                            <option value="common">Common</option>
                                            <option value="rare">Rare</option>
                                            <option value="epic">Epic</option>
                                            <option value="legendary">Legendary</option>
                                          </select>
                                        </FormField>
                                        <FormField label="Cost">
                                          <input
                                            type="number"
                                            min="0"
                                            className="input-base"
                                            value={draft.cost}
                                            onChange={(event) => updateEditDraft(item.slug, 'cost', event.target.value)}
                                          />
                                        </FormField>
                                      </div>
                                      <FormField label="Description">
                                        <textarea
                                          rows={3}
                                          className="input-base"
                                          value={draft.description}
                                          onChange={(event) => updateEditDraft(item.slug, 'description', event.target.value)}
                                        />
                                      </FormField>
                                      <FormField label="Metadata JSON">
                                        <textarea
                                          rows={8}
                                          className="input-base"
                                          value={draft.metadataJson}
                                          onChange={(event) => updateEditDraft(item.slug, 'metadataJson', event.target.value)}
                                        />
                                      </FormField>
                                      <div className={styles.editActions}>
                                        <button
                                          type="button"
                                          className="button"
                                          onClick={() => void handleSaveEdit(item.slug)}
                                          disabled={pendingKey === `edit:${item.slug}`}
                                        >
                                          {pendingKey === `edit:${item.slug}` ? 'Saving...' : 'Save metadata'}
                                        </button>
                                        <button
                                          type="button"
                                          className="button button--secondary button--small"
                                          onClick={() => setEditingSlug(null)}
                                        >
                                          Close editor
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                  {!SLOT_ORDER.some((slot) => (section.groups.get(slot)?.length ?? 0) > 0) ? (
                    <p className={sharedStyles.emptyNote}>{section.emptyMessage}</p>
                  ) : null}
                </div>
              </AdminPaneSection>
            ))}

            <AdminPaneSection eyebrow="Audit" title="Recent Ghostling actions">
              <AdminAuditFeed entries={library.recentAudit} emptyMessage="No recent Ghostling actions yet." />
            </AdminPaneSection>
          </AdminWorkspace>
        </>
      )}
      {lifecycleReview ? (
        <InlineConfirmBar
          title={lifecycleReviewTitle(lifecycleReview)}
          detail={lifecycleReviewDetail(lifecycleReview)}
          meta={[
            { label: 'Cosmetic', value: lifecycleReview.name },
            { label: 'Action', value: lifecycleReviewAction(lifecycleReview) },
          ]}
          confirmLabel={lifecycleReviewTitle(lifecycleReview)}
          pendingLabel={
            lifecycleReview.kind === 'archive'
              ? 'Archiving...'
              : lifecycleReview.kind === 'restore'
                ? 'Restoring...'
                : lifecycleReview.kind === 'delete'
                  ? 'Deleting...'
                  : 'Saving...'
          }
          tone={lifecycleReview.kind === 'archive' || lifecycleReview.kind === 'delete' ? 'danger' : 'default'}
          busy={pendingKey === `${lifecycleReview.kind}:${lifecycleReview.slug}`}
          confirmDisabled={lifecycleReview.kind === 'delete' && deleteConfirmation.trim() !== lifecycleReview.slug}
          onConfirm={() => void confirmLifecycleReview()}
          onCancel={() => {
            setLifecycleReview(null);
            setDeleteConfirmation('');
          }}
        >
          {lifecycleReview.kind === 'delete' ? (
            <div className={sharedStyles.formStack}>
              <FormField label="Type slug to confirm">
                <input
                  type="text"
                  className="input-base"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder={lifecycleReview.slug}
                />
              </FormField>
              <p className={sharedStyles.note}>Type <code>{lifecycleReview.slug}</code> exactly to enable permanent delete.</p>
            </div>
          ) : null}
        </InlineConfirmBar>
      ) : null}
    </main>
  );
}
