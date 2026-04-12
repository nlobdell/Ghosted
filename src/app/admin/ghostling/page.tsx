'use client';

/* eslint-disable @next/next/no-img-element -- Ghostling asset previews are stored and rendered dynamically. */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { getJSON } from '@/lib/api';
import type {
  CompanionAdminData,
  CompanionAdminAssetItem,
  CompanionRepoImportCandidate,
  CompanionSlotKey,
} from '@/lib/types';
import {
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

type VisibilityReviewState = {
  slug: string;
  name: string;
  active: boolean;
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

export default function GhostlingAdminPage() {
  const [library, setLibrary] = useState<CompanionAdminData | null>(null);
  const [importDrafts, setImportDrafts] = useState<RepoImportDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [replaceReview, setReplaceReview] = useState<ReplaceReviewState | null>(null);
  const [visibilityReview, setVisibilityReview] = useState<VisibilityReviewState | null>(null);
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

  const groupedItems = useMemo(() => {
    const groups = new Map<CompanionSlotKey, CompanionAdminAssetItem[]>();
    SLOT_ORDER.forEach((slot) => groups.set(slot, []));
    for (const item of library?.items ?? []) {
      groups.get(item.slot)?.push(item);
    }
    return groups;
  }, [library?.items]);

  function applyLibrary(result: AdminMutationResponse, fallbackMessage: string) {
    setLibrary(result.library);
    setImportDrafts(createImportDrafts(result.library.repoCandidates ?? []));
    setMessage({ text: toGhostlingCopy(result.message ?? fallbackMessage), variant: 'info' });
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

  function requestToggleActive(slug: string, name: string, active: boolean) {
    setVisibilityReview({ slug, name, active });
    setMessage(null);
  }

  async function confirmToggleActive(slug: string, active: boolean) {
    setPendingKey(`active:${slug}`);
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/visibility', {
        method: 'POST',
        body: JSON.stringify({ slug, active }),
      });
      applyLibrary(
        result,
        active ? 'Ghostling cosmetic restored. Check the live catalog row.' : 'Ghostling cosmetic hidden. Check the live catalog row.',
      );
      setVisibilityReview(null);
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling visibility update failed.', variant: 'error' });
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

  const totalItems = library?.items.length ?? 0;
  const activeItems = library?.items.filter((item) => item.active).length ?? 0;
  const hiddenItems = totalItems - activeItems;
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
        summary="Run asset operations in the rail, then read preview, import, and live catalog state in the main pane."
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
              { label: 'Live library', value: String(totalItems) },
              { label: 'Visible', value: String(activeItems) },
              { label: 'Hidden', value: String(hiddenItems) },
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
                      ['Visible cosmetics', `${activeItems}/${totalItems}`],
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

            <AdminPaneSection eyebrow="Catalog" title="Live catalog controls">
              <div className={styles.slotGroups}>
                {SLOT_ORDER.map((slot) => {
                  const items = groupedItems.get(slot) ?? [];
                  if (!items.length) return null;

                  return (
                    <section key={slot} className={styles.slotGroup}>
                      <div className={styles.slotHeader}>
                        <h3>{slot}</h3>
                        <span className={sharedStyles.metaToken}>{items.length} items</span>
                      </div>
                      <div className={styles.assetRows}>
                        {items.map((item, index) => (
                          <article key={item.slug} className={styles.assetRow}>
                            <div className={styles.assetThumbWrap}>
                              <img src={item.previewUrl} alt={item.name} className={styles.assetThumb} />
                            </div>
                            <div className={styles.assetBody}>
                              <div className={styles.assetHeader}>
                                <strong className={styles.assetTitle}>{item.name}</strong>
                                <div className={styles.assetTokens}>
                                  <span className={sharedStyles.metaToken}>{item.rarity}</span>
                                  <span className={sharedStyles.metaToken}>{item.active ? 'Visible' : 'Hidden'}</span>
                                  <span className={sharedStyles.metaToken}>#{item.sortOrder}</span>
                                </div>
                              </div>
                              <p className={sharedStyles.note}>{item.description}</p>
                              <div className={styles.fileMeta}>
                                <span>{item.frontAssetPath ?? 'No front asset'}</span>
                                {item.backAssetPath ? <span>{item.backAssetPath}</span> : null}
                                {item.renderMetadata ? <span>Anchor metadata attached</span> : <span>Legacy full-canvas placement</span>}
                              </div>
                              <div className={styles.assetActions}>
                                <button
                                  type="button"
                                  className="button button--secondary button--small"
                                  onClick={() => requestToggleActive(item.slug, item.name, !item.active)}
                                  disabled={pendingKey === `active:${item.slug}`}
                                >
                                  {pendingKey === `active:${item.slug}` ? 'Saving...' : item.active ? 'Hide' : 'Show'}
                                </button>
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
                              </div>
                              {visibilityReview?.slug === item.slug ? (
                                <InlineConfirmBar
                                  title={visibilityReview.active ? 'Confirm restore' : 'Confirm hide'}
                                  detail={
                                    visibilityReview.active
                                      ? 'Restoring this cosmetic makes it visible in the member Ghostling catalog again.'
                                      : 'Hiding this cosmetic removes it from the member Ghostling catalog without deleting files.'
                                  }
                                  confirmLabel={visibilityReview.active ? 'Confirm restore' : 'Confirm hide'}
                                  pendingLabel="Saving..."
                                  tone={visibilityReview.active ? 'default' : 'danger'}
                                  busy={pendingKey === `active:${item.slug}`}
                                  onConfirm={() => void confirmToggleActive(visibilityReview.slug, visibilityReview.active)}
                                  onCancel={() => setVisibilityReview(null)}
                                />
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </AdminPaneSection>
          </AdminWorkspace>
        </>
      )}
    </main>
  );
}
