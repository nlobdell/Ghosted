'use client';

/* eslint-disable @next/next/no-img-element -- World layer assets are runtime-managed and previewed directly. */

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { formatDate, formatMaybeNumber, getJSON } from '@/lib/api';
import type { GhostlingSceneDensityBucket } from '@/lib/ghostling-world';
import type {
  GhostlingSceneTuningBucketSettings,
  GhostlingSceneTuningSharedSettings,
  GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';
import type { AdminWorldData } from '@/lib/types';
import {
  AdminAuditFeed,
  AdminDataTable,
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
const TUNING_BUCKET_FIELDS: Array<keyof GhostlingSceneTuningBucketSettings> = [
  'maxVisible',
  'speedMin',
  'speedMax',
  'pauseMinMs',
  'pauseMaxMs',
  'arrivalRadius',
  'settleRadius',
  'minGap',
  'facingFlipVelocity',
  'facingFlipDistance',
];
const TUNING_SHARED_FIELDS: Array<keyof GhostlingSceneTuningSharedSettings> = [
  'jamBreakoutMs',
  'verticalTravelFactor',
  'settleDamping',
  'minTargetTravelRatio',
  'anchorHopChance',
];
const TUNING_FIELD_LABELS: Record<string, string> = {
  maxVisible: 'Max visible',
  speedMin: 'Speed min',
  speedMax: 'Speed max',
  pauseMinMs: 'Pause min (ms)',
  pauseMaxMs: 'Pause max (ms)',
  arrivalRadius: 'Arrival radius',
  settleRadius: 'Settle radius',
  minGap: 'Min gap',
  facingFlipVelocity: 'Facing flip velocity',
  facingFlipDistance: 'Facing flip distance',
  jamBreakoutMs: 'Jam breakout (ms)',
  verticalTravelFactor: 'Vertical travel factor',
  settleDamping: 'Settle damping',
  minTargetTravelRatio: 'Min target travel ratio',
  anchorHopChance: 'Anchor hop chance',
};
const TUNING_FIELD_DESCRIPTIONS: Record<string, string> = {
  maxVisible: 'Maximum concurrent Ghostlings for that viewport.',
  speedMin: 'Slowest travel speed picked for roaming motion.',
  speedMax: 'Fastest travel speed picked for roaming motion.',
  pauseMinMs: 'Shortest idle pause after reaching a target.',
  pauseMaxMs: 'Longest idle pause after reaching a target.',
  arrivalRadius: 'Distance from a target that counts as arrived.',
  settleRadius: 'Tight final radius used during settle motion.',
  minGap: 'Minimum spacing to keep between active Ghostlings.',
  facingFlipVelocity: 'Velocity threshold before the sprite flips facing.',
  facingFlipDistance: 'Distance threshold before facing changes are allowed.',
  jamBreakoutMs: 'Time before jammed actors are forced to break free.',
  verticalTravelFactor: 'How much vertical travel contributes to path cost.',
  settleDamping: 'How strongly settle motion eases toward rest.',
  minTargetTravelRatio: 'Minimum retarget distance as a ratio of scene span.',
  anchorHopChance: 'Chance to jump to a different anchor cluster on retarget.',
};

type LayerReviewState = {
  kind: 'archive' | 'restore';
  layerKey: string;
};

function boolLabel(value: boolean) {
  return value ? 'Yes' : 'No';
}

function rectLabel(rect?: { x: number; y: number; width: number; height: number } | null) {
  if (!rect) return 'Not set';
  return `${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`;
}

function worldLayerStateLabel(layer: AdminWorldData['layers'][number]) {
  if (layer.hasDraftOverride) return 'Draft override';
  if (layer.isArchivedDraftOnly) return 'Archived recovery';
  if (layer.hasArchivedOverride) return 'Archived recovery';
  return 'Aligned';
}

function tuningValueLabel(value: number) {
  return formatMaybeNumber(value);
}

export default function AdminWorldsPage() {
  const [data, setData] = useState<AdminWorldData | null>(null);
  const [draftTuning, setDraftTuning] = useState<GhostlingSceneTuningSpec | null>(null);
  const [packageImportText, setPackageImportText] = useState('');
  const [tuningImportText, setTuningImportText] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [discardReviewOpen, setDiscardReviewOpen] = useState(false);
  const [layerReview, setLayerReview] = useState<LayerReviewState | null>(null);

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
    setDraftTuning(result.world.draftTuning);
    setMessage({
      text: result.message ?? fallbackMessage,
      variant: 'info',
    });
    setPublishReviewOpen(false);
    setDiscardReviewOpen(false);
    setLayerReview(null);
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

  async function handlePackageImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPackageText = packageImportText.trim();
    if (!nextPackageText) {
      setMessage({
        text: 'Paste a world package JSON payload first.',
        variant: 'error',
      });
      return;
    }

    setPendingKey('package-import');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/draft/package', {
        method: 'POST',
        body: JSON.stringify({
          worldId: WORLD_ID,
          packageText: nextPackageText,
        }),
      });
      applyWorldMutation(result, 'Draft world package replaced.');
      setPackageImportText('');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to import the draft world package.',
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

  async function handleTuningImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTuningText = tuningImportText.trim();
    if (!nextTuningText) {
      setMessage({
        text: 'Paste a movement tuning JSON payload first.',
        variant: 'error',
      });
      return;
    }

    setPendingKey('tuning-import');
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>('/api/admin/worlds/draft/tuning', {
        method: 'POST',
        body: JSON.stringify({
          worldId: WORLD_ID,
          tuningText: nextTuningText,
        }),
      });
      applyWorldMutation(result, 'Draft tuning updated.');
      setTuningImportText('');
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to import draft tuning.',
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

  function requestLayerReview(review: LayerReviewState) {
    setLayerReview(review);
    setMessage(null);
  }

  async function confirmLayerReview() {
    const review = layerReview;
    if (!review) return;

    const path = review.kind === 'archive'
      ? '/api/admin/worlds/draft/assets/archive'
      : '/api/admin/worlds/draft/assets/restore';
    setPendingKey(`${review.kind}:${review.layerKey}`);
    setMessage(null);

    try {
      const result = await getJSON<AdminWorldMutationResponse>(path, {
        method: 'POST',
        body: JSON.stringify({
          worldId: WORLD_ID,
          layerKey: review.layerKey,
        }),
      });
      applyWorldMutation(
        result,
        review.kind === 'archive'
          ? `Archived ${review.layerKey} draft override.`
          : `Restored ${review.layerKey} archived override.`,
      );
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : `Failed to ${review.kind} ${review.layerKey}.`,
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
  const draftOverrideCount = data.layers.filter((layer) => layer.hasDraftOverride).length;
  const layerByKey = new Map(data.layers.map((layer) => [layer.key, layer]));
  const currentDraftTuning = draftTuning ?? data.draftTuning;
  const bucketTuningRows = TUNING_BUCKET_FIELDS.map((field) => ([
    TUNING_FIELD_LABELS[field],
    TUNING_FIELD_DESCRIPTIONS[field],
    tuningValueLabel(currentDraftTuning.buckets.mobile[field]),
    tuningValueLabel(currentDraftTuning.buckets.tablet[field]),
    tuningValueLabel(currentDraftTuning.buckets.desktop[field]),
  ]));
  const sharedTuningRows = TUNING_SHARED_FIELDS.map((field) => [
    TUNING_FIELD_LABELS[field],
    TUNING_FIELD_DESCRIPTIONS[field],
    tuningValueLabel(currentDraftTuning.shared[field]),
  ]);

  return (
    <main id="main-content" className={`page-shell workspace-page ${sharedStyles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Worlds' },
        ]}
        title="World asset console"
        summary="Stage layer files, archive or restore per-layer overrides, tune draft runtime limits, and verify current file state plus recent audit before publishing."
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
          { label: 'Draft overrides', value: String(draftOverrideCount) },
          { label: 'Archived recovery', value: String(data.world.archivedLayerCount) },
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

            <AdminRailSection eyebrow="Package" title="Replace draft world JSON" description="Upload or paste a validated world package or Scene editor session. Layer file paths will be rebound by layer key.">
              <div className={sharedStyles.formStack}>
                <form onSubmit={handlePackageUpload} className={sharedStyles.formStack}>
                  <input type="hidden" name="worldId" value={WORLD_ID} />
                  <FormField label="World package or session JSON">
                    <input
                      name="package"
                      type="file"
                      accept=".json,application/json,text/json"
                      className="input-base"
                      required
                    />
                  </FormField>
                  <button className="button" type="submit" disabled={pendingKey === 'package' || pendingKey === 'package-import'}>
                    {pendingKey === 'package' ? 'Uploading...' : 'Replace draft package'}
                  </button>
                </form>
                <p className={sharedStyles.note}>Paste a complete world JSON document or Scene editor session when you want to import draft geometry, guides, layer ordering, and optionally tuning directly from the clipboard.</p>
                <form onSubmit={handlePackageImport} className={sharedStyles.formStack}>
                  <FormField label="Paste world package JSON">
                    <textarea
                      className="input-base"
                      rows={10}
                      value={packageImportText}
                      onChange={(event) => setPackageImportText(event.target.value)}
                      placeholder="{&quot;schemaVersion&quot;:1,&quot;worldId&quot;:&quot;shared-commons&quot;,...}"
                    />
                  </FormField>
                  <button
                    className="button button--secondary button--small"
                    type="submit"
                    disabled={!packageImportText.trim() || pendingKey === 'package' || pendingKey === 'package-import'}
                  >
                    {pendingKey === 'package-import' ? 'Importing...' : 'Import pasted package'}
                  </button>
                </form>
              </div>
            </AdminRailSection>

            <AdminRailSection eyebrow="Tuning" title="Draft runtime caps" description="Paste a full movement tuning spec or update max visible Ghostlings per breakpoint without changing the authored world package.">
              <div className={sharedStyles.formStack}>
                <form onSubmit={handleTuningImport} className={sharedStyles.formStack}>
                  <FormField label="Paste movement tuning JSON">
                    <textarea
                      className="input-base"
                      rows={12}
                      value={tuningImportText}
                      onChange={(event) => setTuningImportText(event.target.value)}
                      placeholder="{&quot;buckets&quot;:{&quot;mobile&quot;:{...}},&quot;shared&quot;:{...}}"
                    />
                  </FormField>
                  <button
                    className="button"
                    type="submit"
                    disabled={!tuningImportText.trim() || pendingKey === 'tuning' || pendingKey === 'tuning-import'}
                  >
                    {pendingKey === 'tuning-import' ? 'Importing...' : 'Import pasted tuning'}
                  </button>
                </form>
                <p className={sharedStyles.note}>Pasted tuning replaces the full draft movement spec after JSON and schema validation.</p>
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
                  <button className="button button--secondary button--small" type="submit" disabled={!draftTuning || pendingKey === 'tuning' || pendingKey === 'tuning-import'}>
                    {pendingKey === 'tuning' ? 'Saving...' : 'Save draft tuning'}
                  </button>
                </form>
              </div>
            </AdminRailSection>

            <AdminRailSection eyebrow="Publish" title="Publish controls" description="Publishing updates the live homepage runtime world and reseeds draft from the newly published package.">
              <AdminKeyValueList
                items={[
                  ['Draft diverged', boolLabel(draftHasChanges)],
                  ['Published variant', boolLabel(data.world.hasPublishedVariant)],
                  ['Archived recovery', String(data.world.archivedLayerCount)],
                  ['Draft updated', data.world.draftUpdatedAt ? formatDate(data.world.draftUpdatedAt) : 'Never'],
                  ['Published at', data.world.publishedAt ? formatDate(data.world.publishedAt) : 'Repo fallback'],
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
              ['Draft overrides', String(draftOverrideCount)],
              ['Archived recovery layers', String(data.world.archivedLayerCount)],
              ['Published variant exists', boolLabel(data.world.hasPublishedVariant)],
              ['Draft updated', data.world.draftUpdatedAt ? formatDate(data.world.draftUpdatedAt) : 'Never'],
              ['Published at', data.world.publishedAt ? formatDate(data.world.publishedAt) : 'Repo fallback'],
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
              ['Desktop cap', String(currentDraftTuning.buckets.desktop.maxVisible)],
              ['Tablet cap', String(currentDraftTuning.buckets.tablet.maxVisible)],
              ['Mobile cap', String(currentDraftTuning.buckets.mobile.maxVisible)],
            ]}
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Tuning" title="Movement tuning readback">
          <p className={sharedStyles.note}>Shared settings apply across every viewport, while bucket settings tune mobile, tablet, and desktop behavior separately.</p>
          <AdminDataTable
            columns={['Shared setting', 'Meaning', 'Value']}
            rows={sharedTuningRows}
            emptyMessage="No shared tuning parameters loaded."
          />
          <AdminDataTable
            columns={['Bucket setting', 'Meaning', 'Mobile', 'Tablet', 'Desktop']}
            rows={bucketTuningRows}
            emptyMessage="No bucket tuning parameters loaded."
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Recovery" title="Archived draft override recovery">
          {data.archivedLayers.length ? (
            <div className={styles.layerRecoveryGrid}>
              {data.archivedLayers.map((layer) => {
                const currentLayer = layerByKey.get(layer.layerKey);
                const restoreDisabled = Boolean(currentLayer?.hasDraftOverride);
                return (
                  <article key={layer.layerKey} className={styles.layerRecoveryCard}>
                    <div className={styles.layerPreviewHeader}>
                      <strong>{layer.layerKey}</strong>
                      <span className={sharedStyles.metaToken}>Recovery ready</span>
                    </div>
                    <AdminKeyValueList
                      items={[
                        ['Archived file', layer.assetPath],
                        ['Archived at', formatDate(layer.archivedAt)],
                        ['Archived by', layer.archivedByDisplayName ?? 'Unknown'],
                      ]}
                      className={styles.layerReadback}
                    />
                    <div className={styles.layerActions}>
                      <a href={layer.assetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                        Open archived file
                      </a>
                      <button
                        type="button"
                        className="button"
                        onClick={() => requestLayerReview({ kind: 'restore', layerKey: layer.layerKey })}
                        disabled={restoreDisabled || pendingKey === `restore:${layer.layerKey}`}
                      >
                        {pendingKey === `restore:${layer.layerKey}` ? 'Restoring...' : 'Restore override'}
                      </button>
                    </div>
                    {restoreDisabled ? (
                      <p className={sharedStyles.note}>Archive or discard the active draft override before restoring this archived layer.</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={sharedStyles.emptyNote}>No archived layer overrides are waiting for recovery.</p>
          )}
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Layers" title="Layer overrides and file readback">
          <div className={styles.layerPreviewGrid}>
            {data.layers.map((layer) => (
              <article key={layer.key} className={styles.layerPreviewCard}>
                <div className={styles.layerPreviewHeader}>
                  <strong>{layer.key}</strong>
                  <div className={styles.layerPreviewTokens}>
                    <span className={sharedStyles.metaToken}>z{layer.zIndex}</span>
                    <span className={sharedStyles.metaToken}>{worldLayerStateLabel(layer)}</span>
                    {layer.hasArchivedOverride ? <span className={sharedStyles.metaToken}>Archived copy</span> : null}
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
                  {layer.archivedAssetUrl ? (
                    <div className={styles.layerPreviewPanel}>
                      <span className={styles.layerPreviewLabel}>Archived</span>
                      <img src={layer.archivedAssetUrl} alt={`${layer.key} archived layer`} className={styles.layerPreviewImage} />
                    </div>
                  ) : null}
                </div>
                <AdminKeyValueList
                  items={[
                    ['Published file', layer.liveAssetPath],
                    ['Draft file', layer.draftAssetPath],
                    ['Archived file', layer.archivedAssetPath ?? 'None'],
                    ['Archived at', layer.archivedAt ? formatDate(layer.archivedAt) : 'Not archived'],
                    ['Archived by', layer.archivedByDisplayName ?? 'N/A'],
                  ]}
                  className={styles.layerReadback}
                />
                <div className={styles.layerActions}>
                  {layer.hasDraftOverride ? (
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      onClick={() => requestLayerReview({ kind: 'archive', layerKey: layer.key })}
                      disabled={pendingKey === `archive:${layer.key}`}
                    >
                      {pendingKey === `archive:${layer.key}` ? 'Archiving...' : 'Archive draft override'}
                    </button>
                  ) : null}
                  {layer.isArchivedDraftOnly ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => requestLayerReview({ kind: 'restore', layerKey: layer.key })}
                      disabled={pendingKey === `restore:${layer.key}`}
                    >
                      {pendingKey === `restore:${layer.key}` ? 'Restoring...' : 'Restore archived override'}
                    </button>
                  ) : null}
                  <a href={layer.liveSrc} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                    Open published file
                  </a>
                  <a href={layer.draftSrc} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                    Open draft file
                  </a>
                  {layer.archivedAssetUrl ? (
                    <a href={layer.archivedAssetUrl} target="_blank" rel="noreferrer" className="button button--secondary button--small">
                      Open archived file
                    </a>
                  ) : null}
                </div>
                {layer.hasDraftOverride ? (
                  <p className={sharedStyles.note}>Archiving reverts the draft layer to the current published or repo-backed source without deleting the override file.</p>
                ) : layer.isArchivedDraftOnly ? (
                  <p className={sharedStyles.note}>This layer is aligned live, but an archived override is ready to restore into draft.</p>
                ) : (
                  <p className={sharedStyles.note}>Draft currently matches the published or repo-backed live layer for this key.</p>
                )}
              </article>
            ))}
          </div>
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Audit" title="Recent world actions">
          <AdminAuditFeed entries={data.recentAudit} emptyMessage="No recent world actions yet." />
        </AdminPaneSection>
      </AdminWorkspace>
      {layerReview ? (
        <InlineConfirmBar
          title={layerReview.kind === 'archive' ? 'Confirm archive' : 'Confirm restore'}
          detail={
            layerReview.kind === 'archive'
              ? 'Archiving removes the active draft override from the live draft package and keeps a restorable copy for later recovery.'
              : 'Restoring reapplies the archived layer override into the draft package without touching the currently published world.'
          }
          meta={[
            { label: 'World', value: data.world.id },
            { label: 'Layer', value: layerReview.layerKey },
            { label: 'Action', value: layerReview.kind === 'archive' ? 'Archive override' : 'Restore override' },
          ]}
          confirmLabel={layerReview.kind === 'archive' ? 'Confirm archive' : 'Confirm restore'}
          pendingLabel={layerReview.kind === 'archive' ? 'Archiving...' : 'Restoring...'}
          tone={layerReview.kind === 'archive' ? 'danger' : 'default'}
          busy={pendingKey === `${layerReview.kind}:${layerReview.layerKey}`}
          onConfirm={() => void confirmLayerReview()}
          onCancel={() => setLayerReview(null)}
        />
      ) : null}
    </main>
  );
}
