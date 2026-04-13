'use client';

/* eslint-disable @next/next/no-img-element -- World layer assets are runtime-managed and previewed directly. */

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { getJSON } from '@/lib/api';
import type { GhostlingSceneDensityBucket } from '@/lib/ghostling-world';
import type { GhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import type { AdminWorldData } from '@/lib/types';
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

type AdminWorldMutationResponse = {
  ok: boolean;
  message?: string;
  world: AdminWorldData;
};

const WORLD_ID = 'shared-commons';
const ASSET_ACCEPT = '.png,.svg,.gif,.webp,.jpg,.jpeg';
const TUNING_BUCKETS: GhostlingSceneDensityBucket[] = ['mobile', 'tablet', 'desktop'];

function boolLabel(value: boolean) {
  return value ? 'Yes' : 'No';
}

function rectLabel(rect?: { x: number; y: number; width: number; height: number } | null) {
  if (!rect) return 'Not set';
  return `${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`;
}

export default function AdminWorldsPage() {
  const [data, setData] = useState<AdminWorldData | null>(null);
  const [draftTuning, setDraftTuning] = useState<GhostlingSceneTuningSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [discardReviewOpen, setDiscardReviewOpen] = useState(false);

  async function loadWorldData() {
    const nextWorld = await getJSON<AdminWorldData>('/api/admin/worlds');
    setData(nextWorld);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadWorldData())
      .catch((error) => {
        setMessage({
          text: error instanceof Error ? error.message : 'Failed to load world admin.',
          variant: 'error',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return;
    setDraftTuning(data.draftTuning);
  }, [data]);

  function applyWorldMutation(
    result: AdminWorldMutationResponse,
    fallbackMessage: string,
  ) {
    setData(result.world);
    setMessage({
      text: result.message ?? fallbackMessage,
      variant: 'info',
    });
    setPublishReviewOpen(false);
    setDiscardReviewOpen(false);
  }

  function updateDraftMaxVisible(bucket: GhostlingSceneDensityBucket, value: number) {
    setDraftTuning((current) => {
      if (!current) return current;
      return {
        ...current,
        buckets: {
          ...current.buckets,
          [bucket]: {
            ...current.buckets[bucket],
            maxVisible: Math.max(1, Math.round(value)),
          },
        },
      };
    });
  }

  async function handleLayerUpload(layerKey: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPendingKey(`layer:${layerKey}`);
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/draft/assets', {
        method: 'POST',
        body: formData,
      });
      applyWorldMutation(result, `Draft ${layerKey} layer updated.`);
      form.reset();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : `Failed to update ${layerKey}.`,
        variant: 'error',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handlePackageUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPendingKey('package');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/draft/package', {
        method: 'POST',
        body: formData,
      });
      applyWorldMutation(result, 'Draft world package replaced.');
      form.reset();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to replace the draft world package.',
        variant: 'error',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleTuningSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftTuning) return;
    setPendingKey('tuning');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/draft/tuning', {
        method: 'POST',
        body: JSON.stringify({
          worldId: WORLD_ID,
          tuning: draftTuning,
        }),
      });
      applyWorldMutation(result, 'Draft tuning updated.');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to update draft tuning.',
        variant: 'error',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handlePublish() {
    setPendingKey('publish');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/publish', {
        method: 'POST',
        body: JSON.stringify({ worldId: WORLD_ID }),
      });
      applyWorldMutation(result, 'Draft world published.');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to publish the draft world.',
        variant: 'error',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleDiscard() {
    setPendingKey('discard');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/discard-draft', {
        method: 'POST',
        body: JSON.stringify({ worldId: WORLD_ID }),
      });
      applyWorldMutation(result, 'Draft world discarded.');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to discard the draft world.',
        variant: 'error',
      });
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${sharedStyles.page}`}>
        <Banner message="Loading world admin..." variant="info" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`page-shell workspace-page ${sharedStyles.page}`}>
        {message ? <Banner message={message.text} variant={message.variant} /> : null}
        <EmptyState
          message="World admin could not be loaded."
          action={<Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>}
        />
      </main>
    );
  }

  const draftLayerOrder = data.draftWorld.layers.map((layer) => layer.key).join(', ');
  const draftHasChanges = data.world.hasDraft;

  return (
    <main id="main-content" className={`page-shell workspace-page ${sharedStyles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Worlds' },
        ]}
        title="World asset console"
        summary="Stage layer files and world package JSON in draft, then verify the draft against the published runtime world before you publish."
        actions={(
          <>
            <Link href="/" className="button button--secondary button--small">Open live homepage</Link>
            <Link href="/?worldPreview=shared-commons:draft" className="button button--secondary button--small">Open draft preview</Link>
          </>
        )}
      />

      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <AdminStatStrip
        items={[
          { label: 'Layers', value: String(data.draftWorld.layers.length) },
          { label: 'Draft changes', value: draftHasChanges ? 'Pending' : 'Aligned' },
          { label: 'Published variant', value: data.world.hasPublishedVariant ? 'Runtime' : 'Repo fallback' },
          { label: 'Canvas', value: `${data.draftWorld.sourceWidth}x${data.draftWorld.sourceHeight}` },
        ]}
      />

      <AdminWorkspace
        className={styles.workspace}
        rail={(
          <>
            <AdminRailSection eyebrow="Layers" title="Replace draft layers" description="Upload one layer at a time into the draft namespace.">
              <div className={styles.layerUploadList}>
                {data.layers.map((layer) => (
                  <form
                    key={layer.key}
                    onSubmit={(event) => void handleLayerUpload(layer.key, event)}
                    className={styles.layerUploadCard}
                    data-testid={`world-layer-upload-${layer.key}`}
                  >
                    <input type="hidden" name="worldId" value={WORLD_ID} />
                    <input type="hidden" name="layerKey" value={layer.key} />
                    <div className={styles.layerUploadHeader}>
                      <strong>{layer.key}</strong>
                      <span className={sharedStyles.metaToken}>z{layer.zIndex}</span>
                    </div>
                    <FormField label="Asset file">
                      <input
                        name="asset"
                        type="file"
                        accept={ASSET_ACCEPT}
                        className="input-base"
                        required
                      />
                    </FormField>
                    <button className="button button--secondary button--small" type="submit" disabled={pendingKey === `layer:${layer.key}`}>
                      {pendingKey === `layer:${layer.key}` ? 'Uploading...' : 'Stage layer'}
                    </button>
                  </form>
                ))}
              </div>
            </AdminRailSection>

            <AdminRailSection eyebrow="Package" title="Replace draft world JSON" description="Upload a validated world package. Layer file paths will be rebound by layer key.">
              <form onSubmit={handlePackageUpload} className={sharedStyles.formStack}>
                <input type="hidden" name="worldId" value={WORLD_ID} />
                <FormField label="World package">
                  <input
                    name="package"
                    type="file"
                    accept=".json,application/json,text/json"
                    className="input-base"
                    required
                  />
                </FormField>
                <button className="button" type="submit" disabled={pendingKey === 'package'}>
                  {pendingKey === 'package' ? 'Uploading...' : 'Replace draft package'}
                </button>
              </form>
            </AdminRailSection>

            <AdminRailSection eyebrow="Tuning" title="Draft runtime caps" description="Update the runtime max visible Ghostlings per breakpoint without changing the authored world package.">
              <form onSubmit={handleTuningSave} className={sharedStyles.formStack}>
                {TUNING_BUCKETS.map((bucket) => (
                  <FormField key={bucket} label={`${bucket.charAt(0).toUpperCase()}${bucket.slice(1)} max visible`}>
                    <input
                      className="input-base"
                      type="number"
                      min={1}
                      step={1}
                      value={draftTuning?.buckets[bucket].maxVisible ?? 1}
                      onChange={(event) => updateDraftMaxVisible(bucket, Number(event.target.value || 1))}
                    />
                  </FormField>
                ))}
                <button className="button button--secondary button--small" type="submit" disabled={!draftTuning || pendingKey === 'tuning'}>
                  {pendingKey === 'tuning' ? 'Saving...' : 'Save draft tuning'}
                </button>
              </form>
            </AdminRailSection>

            <AdminRailSection eyebrow="Publish" title="Publish controls" description="Publishing updates the live homepage runtime world and reseeds draft from the newly published package.">
              <AdminKeyValueList
                items={[
                  ['Draft diverged', boolLabel(draftHasChanges)],
                  ['Published variant', boolLabel(data.world.hasPublishedVariant)],
                  ['Draft updated', data.world.draftUpdatedAt ?? 'Never'],
                  ['Published at', data.world.publishedAt ?? 'Repo fallback'],
                ]}
              />
              <div className={styles.publishActions}>
                <button
                  type="button"
                  className="button"
                  disabled={!draftHasChanges || pendingKey === 'publish'}
                  onClick={() => setPublishReviewOpen(true)}
                >
                  {pendingKey === 'publish' ? 'Publishing...' : 'Publish draft'}
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  disabled={!draftHasChanges || pendingKey === 'discard'}
                  onClick={() => setDiscardReviewOpen(true)}
                >
                  {pendingKey === 'discard' ? 'Discarding...' : 'Discard draft'}
                </button>
              </div>

              {publishReviewOpen ? (
                <InlineConfirmBar
                  title="Confirm publish"
                  detail="This replaces the live homepage runtime world and resets the shared hero snapshot to the new geometry."
                  meta={[
                    { label: 'World', value: data.world.id },
                    { label: 'Layers', value: String(data.draftWorld.layers.length) },
                  ]}
                  confirmLabel="Publish draft"
                  pendingLabel="Publishing..."
                  busy={pendingKey === 'publish'}
                  onConfirm={() => void handlePublish()}
                  onCancel={() => setPublishReviewOpen(false)}
                />
              ) : null}

              {discardReviewOpen ? (
                <InlineConfirmBar
                  title="Discard draft"
                  detail="This removes draft-only changes and realigns the draft with the current published runtime world."
                  confirmLabel="Discard draft"
                  pendingLabel="Discarding..."
                  tone="danger"
                  busy={pendingKey === 'discard'}
                  onConfirm={() => void handleDiscard()}
                  onCancel={() => setDiscardReviewOpen(false)}
                />
              ) : null}
            </AdminRailSection>
          </>
        )}
      >
        <AdminPaneSection eyebrow="Status" title="Runtime world state">
          <AdminKeyValueList
            items={[
              ['World ID', data.world.id],
              ['Preset', data.world.preset],
              ['Storage root', data.world.storageRoot],
              ['Repo asset root', data.world.repoAssetRoot],
              ['Draft changes pending', boolLabel(draftHasChanges)],
              ['Published variant exists', boolLabel(data.world.hasPublishedVariant)],
              ['Published hero crop', rectLabel(data.publishedWorld.guides.heroCrop)],
            ]}
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Draft" title="Draft package summary">
          <AdminKeyValueList
            items={[
              ['Canvas', `${data.draftWorld.sourceWidth} x ${data.draftWorld.sourceHeight}`],
              ['Hero crop', rectLabel(data.draftWorld.guides.heroCrop)],
              ['Safe zones', String(data.draftWorld.safeZones.length)],
              ['Anchors', String(data.draftWorld.points.length)],
              ['Layer order', draftLayerOrder],
              ['Desktop cap', String(data.draftTuning.buckets.desktop.maxVisible)],
              ['Tablet cap', String(data.draftTuning.buckets.tablet.maxVisible)],
              ['Mobile cap', String(data.draftTuning.buckets.mobile.maxVisible)],
            ]}
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Layers" title="Published vs draft layer previews">
          <div className={styles.layerPreviewGrid}>
            {data.layers.map((layer) => (
              <article key={layer.key} className={styles.layerPreviewCard}>
                <div className={styles.layerPreviewHeader}>
                  <strong>{layer.key}</strong>
                  <div className={styles.layerPreviewTokens}>
                    <span className={sharedStyles.metaToken}>z{layer.zIndex}</span>
                    <span className={sharedStyles.metaToken}>{layer.hasDraftOverride ? 'Draft override' : 'Aligned'}</span>
                  </div>
                </div>
                <div className={styles.layerPreviewRow}>
                  <div className={styles.layerPreviewPanel}>
                    <span className={styles.layerPreviewLabel}>Published</span>
                    <img src={layer.liveSrc} alt={`${layer.key} published layer`} className={styles.layerPreviewImage} />
                  </div>
                  <div className={styles.layerPreviewPanel}>
                    <span className={styles.layerPreviewLabel}>Draft</span>
                    <img src={layer.draftSrc} alt={`${layer.key} draft layer`} className={styles.layerPreviewImage} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </AdminPaneSection>
      </AdminWorkspace>
    </main>
  );
}
