'use client';

/* eslint-disable @next/next/no-img-element -- Ghostling asset previews are stored and rendered dynamically. */
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import {
  AppContext,
  AppGrid,
  Banner,
  EmptyState,
  FormField,
  Panel,
  SectionHeading,
  StatStrip,
} from '@/components/ui/AppUI';
import { getJSON } from '@/lib/api';
import type {
  CompanionAdminData,
  CompanionAdminAssetItem,
  CompanionRepoImportCandidate,
  CompanionSlotKey,
} from '@/lib/types';
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
      applyLibrary(result, 'Ghostling base updated. Check the preview before you leave this page.');
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
      applyLibrary(result, 'Ghostling cosmetic created. Confirm it appears in the slot list below.');
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
    setPendingKey('replace');
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/replace-assets', {
        method: 'POST',
        body: formData,
      });
      applyLibrary(result, 'Ghostling art replaced. Check the preview and member studio after this update.');
      form.reset();
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Ghostling asset replacement failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleToggleActive(slug: string, active: boolean) {
    setPendingKey(`active:${slug}`);
    setMessage(null);
    try {
      const result = await getJSON<AdminMutationResponse>('/api/companion/admin/items/visibility', {
        method: 'POST',
        body: JSON.stringify({ slug, active }),
      });
      applyLibrary(
        result,
        active
          ? 'Ghostling cosmetic restored. Verify it is visible in the member catalog again.'
          : 'Ghostling cosmetic hidden. Verify it no longer appears in the member catalog.',
      );
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
      applyLibrary(result, 'Ghostling order updated. Confirm the slot order below.');
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
      applyLibrary(result, 'Repo Ghostling cosmetics imported. Check visibility and slot order below.');
    } catch (nextError) {
      setMessage({ text: nextError instanceof Error ? toGhostlingError(nextError.message) : 'Repo Ghostling import failed.', variant: 'error' });
    } finally {
      setPendingKey(null);
    }
  }

  function updateImportDraft(
    slug: string,
    field: keyof RepoImportDraft,
    value: string | boolean,
  ) {
    setImportDrafts((current) => current.map((draft) => (draft.slug === slug ? { ...draft, [field]: value } : draft)));
  }

  const totalItems = library?.items.length ?? 0;
  const activeItems = library?.items.filter((item) => item.active).length ?? 0;
  const hiddenItems = totalItems - activeItems;
  const repoCandidates = importDrafts.length;

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Ghostling' },
        ]}
        title="Manage live Ghostling assets"
        summary="Update the base, create cosmetics, replace files, and import repo items here. Then use the catalog controls below to hide, restore, or reorder what members can see."
        actions={(
          <>
            <Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>
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
          <Panel
            className={styles.workflowPanel}
            tier="primary"
            eyebrow="Asset changes"
            title="Update files before you change catalog order"
            bodyClassName={styles.workflowBody}
            body={(
              <>
                <div className={styles.workflowCopy}>
                  <p className={styles.workflowLead}>
                    Base uploads, art replacements, repo imports, and visibility changes update the live member studio and the admin preview immediately.
                  </p>
                  <div className={styles.workflowChecklist}>
                    <div className={styles.workflowChecklistItem}>
                      <strong>Base uploads</strong>
                      <span>Update the default body and head used anywhere a slot has no override.</span>
                    </div>
                    <div className={styles.workflowChecklistItem}>
                      <strong>Create or replace</strong>
                      <span>Publish new cosmetics or overwrite live art for an existing slug with an explicit operator step.</span>
                    </div>
                    <div className={styles.workflowChecklistItem}>
                      <strong>Hide, restore, reorder</strong>
                      <span>Use library controls afterward to pull cosmetics from the member catalog or change their live order.</span>
                    </div>
                  </div>
                </div>
                <div className={styles.workflowActions}>
                  <a href="#ghostling-base" className="button button--small">Upload base files</a>
                  <a href="#ghostling-create" className="button button--secondary button--small">Create cosmetic</a>
                  <a href="#ghostling-replace" className="button button--secondary button--small">Replace live files</a>
                  <a href="#ghostling-import" className="button button--secondary button--small">Import repo pieces</a>
                  <a href="#ghostling-library" className="button button--secondary button--small">Library controls</a>
                </div>
              </>
            )}
          />

          <AppGrid className={styles.workflowGrid}>
            <section id="ghostling-base">
            <Panel
              className={styles.adminPanel}
              tier="primary"
              eyebrow="Base workflow"
              title="Upload a new layered Ghostling base"
              body={(
                <div className={styles.basePanelBody}>
                  <div className={styles.basePreview}>
                    <AnimatedCompanionStage
                      manifest={library.base.renderManifest}
                      fallbackSrc={library.base.previewUrl}
                      alt="Ghostling base preview"
                      className={styles.basePreviewStage}
                      targetSize={224}
                    />
                  </div>
                  <form onSubmit={handleBaseUpload} className="app-form">
                    <p className={styles.actionNote}>
                      Changing these files updates the default live body and head used anywhere a Ghostling render does not have a slot override.
                    </p>
                    <div className={styles.assetMetaBlock}>
                      <strong>User uploads</strong>
                      <span>{library.storageRoot}</span>
                    </div>
                    <div className={styles.assetMetaBlock}>
                      <strong>Current body file</strong>
                      <span>{library.base.bodyAssetPath || 'No body uploaded yet'}</span>
                    </div>
                    <div className={styles.assetMetaBlock}>
                      <strong>Current head file</strong>
                      <span>{library.base.headAssetPath || 'Using the default layered head fallback'}</span>
                    </div>
                    <FormField label="Body image">
                      <input name="bodyAsset" type="file" accept={ASSET_ACCEPT} className="input-base" required />
                    </FormField>
                    <FormField label="Head image (optional override)">
                      <input name="headAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                    </FormField>
                    <div className="app-inline-actions">
                      <button className="button" type="submit" disabled={pendingKey === 'base'}>
                        {pendingKey === 'base' ? 'Uploading...' : 'Upload base files'}
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
                  </form>
                </div>
              )}
            />
            </section>

            <section id="ghostling-create">
            <Panel
              className={styles.adminPanel}
              tier="meta"
              eyebrow="Create live cosmetic"
              title="Create and publish a Ghostling cosmetic"
              body={(
                <div className="app-stack">
                  <p className={styles.actionNote}>
                    Saving here adds a new cosmetic to the member catalog. Hide it later only if it should stay off the live list after creation.
                  </p>
                  <form onSubmit={handleCreateItem} className="app-form">
                    <div className="form-grid-two">
                      <FormField label="Name">
                        <input name="name" type="text" placeholder="Moon Hood" className="input-base" required />
                      </FormField>
                      <FormField label="Slug (optional)">
                        <input name="slug" type="text" placeholder="moon-hood" className="input-base" />
                      </FormField>
                    </div>
                    <div className="form-grid-two">
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
                    <div className="form-grid-two">
                      <FormField label="Cost">
                        <input name="cost" type="number" min="0" defaultValue="120" className="input-base" required />
                      </FormField>
                      <FormField label="Front asset (optional)">
                        <input name="frontAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                      </FormField>
                    </div>
                    <FormField label="Back asset (optional)">
                      <input name="backAsset" type="file" accept={ASSET_ACCEPT} className="input-base" />
                    </FormField>
                    <FormField label="Metadata sidecar (optional)">
                      <input name="metadata" type="file" accept=".json,application/json,text/json" className="input-base" />
                    </FormField>
                    <FormField label="Description">
                      <textarea name="description" rows={3} className="input-base" placeholder="Short flavor text for the unlock card." />
                    </FormField>
                    <button className="button" type="submit" disabled={pendingKey === 'create'}>
                      {pendingKey === 'create' ? 'Creating...' : 'Create cosmetic'}
                    </button>
                  </form>
                </div>
              )}
            />
            </section>
          </AppGrid>

          <AppGrid className={styles.workflowGrid}>
            <section id="ghostling-replace">
            <Panel
              className={styles.adminPanel}
              tier="meta"
              eyebrow="Replace live files"
              title="Replace files on a live Ghostling cosmetic"
              body={(
                <div className="app-stack">
                  <p className={styles.actionNote}>
                    Replacing files overwrites the live art for the selected slug and changes current member previews that use it.
                  </p>
                  <form onSubmit={handleReplaceAssets} className="app-form">
                    <FormField label="Cosmetic">
                      <select name="slug" className="input-base" defaultValue={library.items[0]?.slug ?? ''} required>
                        {library.items.map((item) => (
                          <option key={item.slug} value={item.slug}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <div className="form-grid-two">
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
                      {pendingKey === 'replace' ? 'Replacing...' : 'Replace files'}
                    </button>
                  </form>
                </div>
              )}
            />
            </section>

            <section id="ghostling-import">
            <Panel
              className={styles.adminPanel}
              tier="meta"
              eyebrow="Repo import"
              title="Import repo cosmetics into the live library"
              body={repoCandidates ? (
                <div className="app-stack">
                  <p className={styles.actionNote}>
                    Selected repo items import with the visibility setting you choose here and join the current slot order immediately.
                  </p>
                  <div className={styles.importStack}>
                    {importDrafts.map((draft) => (
                      <article key={draft.slug} className={styles.importRow}>
                        <div className={styles.importHeader}>
                          <label className={styles.importToggle}>
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={(event) => updateImportDraft(draft.slug, 'selected', event.target.checked)}
                            />
                            <span>{draft.name}</span>
                          </label>
                          <span className="app-chip">{draft.frontAssetPath ?? draft.backAssetPath ?? 'No asset path'}</span>
                        </div>
                        <div className={styles.importGrid}>
                          <FormField label="Name" className={styles.compactField}>
                            <input
                              type="text"
                              className="input-base"
                              value={draft.name}
                              onChange={(event) => updateImportDraft(draft.slug, 'name', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Slug" className={styles.compactField}>
                            <input
                              type="text"
                              className="input-base"
                              value={draft.slug}
                              onChange={(event) => updateImportDraft(draft.slug, 'slug', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Slot" className={styles.compactField}>
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
                          <FormField label="Rarity" className={styles.compactField}>
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
                          <FormField label="Cost" className={styles.compactField}>
                            <input
                              type="number"
                              min="0"
                              className="input-base"
                              value={draft.cost}
                              onChange={(event) => updateImportDraft(draft.slug, 'cost', event.target.value)}
                            />
                          </FormField>
                          <FormField label="Visible on import" className={styles.compactField}>
                            <label className={styles.activeToggle}>
                              <input
                                type="checkbox"
                                checked={draft.active}
                                onChange={(event) => updateImportDraft(draft.slug, 'active', event.target.checked)}
                              />
                              <span>{draft.active ? 'Visible' : 'Hidden'}</span>
                            </label>
                          </FormField>
                        </div>
                        <FormField label="Description" className={styles.compactField}>
                          <textarea
                            rows={2}
                            className="input-base"
                            value={draft.description}
                            onChange={(event) => updateImportDraft(draft.slug, 'description', event.target.value)}
                          />
                        </FormField>
                        <div className={styles.importAssets}>
                          {draft.frontAssetUrl ? <img src={draft.frontAssetUrl} alt={`${draft.name} front asset`} className={styles.importPreview} /> : null}
                          <div className={styles.assetMetaList}>
                            <span>{draft.frontAssetPath ?? 'No front asset'}</span>
                            {draft.backAssetPath ? <span>{draft.backAssetPath}</span> : null}
                            {draft.renderMetadataPath ? <span>{draft.renderMetadataPath}</span> : null}
                            {draft.renderMetadata ? <span>Anchor metadata ready</span> : null}
                            {(draft.renderMetadataErrors ?? []).map((error) => (
                              <span key={`${draft.slug}:${error}`} className={styles.importErrorText}>{error}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                    <button className="button" type="button" onClick={() => void handleImportRepoItems()} disabled={pendingKey === 'import'}>
                      {pendingKey === 'import' ? 'Importing...' : 'Import selected cosmetics'}
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState message="No repo Ghostling assets are ready to import." />
              )}
            />
            </section>
          </AppGrid>

          <StatStrip
            className={styles.scoreboard}
            leadIndex={0}
            stats={[
              { label: 'Live library', value: String(totalItems) },
              { label: 'Visible', value: String(activeItems) },
              { label: 'Hidden', value: String(hiddenItems) },
              { label: 'Repo imports', value: String(repoCandidates) },
            ]}
          />

          <section id="ghostling-library" className={styles.librarySection}>
            <SectionHeading
              eyebrow="Catalog controls"
              title="Hide, restore, and reorder live cosmetics"
              copy="Use this section after uploads or imports. Hide removes a cosmetic from the member catalog without deleting files, restore brings it back, and reorder changes the order members see in the studio."
            />
            <div className={styles.slotGroups}>
              {SLOT_ORDER.map((slot) => {
                const items = groupedItems.get(slot) ?? [];
                if (!items.length) return null;

                return (
                  <section key={slot} className={styles.slotGroup}>
                    <div className={styles.slotHeading}>
                      <h3>{slot}</h3>
                      <span>{items.length} items</span>
                    </div>
                    <div className={styles.libraryGrid}>
                      {items.map((item, index) => (
                        <article key={item.slug} className={styles.libraryCard}>
                          <div className={styles.libraryPreview}>
                            <img src={item.previewUrl} alt={item.name} className={styles.libraryPreviewImage} />
                          </div>
                          <div className={styles.libraryCopy}>
                            <div className={styles.libraryHeader}>
                              <strong>{item.name}</strong>
                              <div className={styles.itemChips}>
                                <span className="app-chip">{item.rarity}</span>
                                <span className="app-chip">{item.active ? 'Visible' : 'Hidden'}</span>
                                <span className="app-chip">#{item.sortOrder}</span>
                              </div>
                            </div>
                            <p>{item.description}</p>
                            <div className={styles.assetMetaList}>
                              <span>{item.frontAssetPath ?? 'No front asset'}</span>
                              {item.backAssetPath ? <span>{item.backAssetPath}</span> : null}
                              {item.renderMetadata ? <span>Anchor metadata attached</span> : <span>Legacy full-canvas placement</span>}
                            </div>
                            <div className="app-inline-actions">
                              <button
                                type="button"
                                className="button button--secondary button--small"
                                onClick={() => void handleToggleActive(item.slug, !item.active)}
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
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
