/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminWorldsPage from '@/app/admin/worlds/page';
import { createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';
import type { AdminWorldData } from '@/lib/types';

function makeWorldPayload(overrides: Partial<AdminWorldData['world']> = {}): AdminWorldData {
  const publishedWorld = {
    ...SHARED_COMMONS_WORLD,
    layers: SHARED_COMMONS_WORLD.layers.map((layer) => ({
      ...layer,
      src: `/api/world-assets/repo/worlds/shared-commons/v1/${layer.key}.png`,
    })),
  };
  const draftWorld = {
    ...publishedWorld,
    layers: publishedWorld.layers.map((layer, index) => ({
      ...layer,
      src: index === 1
        ? `/api/world-assets/worlds/shared-commons/draft/${layer.key}.png`
        : layer.src,
    })),
  };
  const publishedTuning = createDefaultGhostlingSceneTuningSpec();
  const draftTuning = createDefaultGhostlingSceneTuningSpec();
  draftTuning.buckets.desktop.maxVisible = 12;

  return {
    actor: { displayName: 'Admin User' },
    world: {
      id: 'shared-commons',
      preset: 'public-hero',
      storageRoot: 'C:/tmp/world-assets',
      repoAssetRoot: 'C:/repo/public',
      hasDraft: true,
      hasPublishedVariant: false,
      archivedLayerCount: 1,
      draftUpdatedAt: '2026-04-12T21:30:00.000Z',
      publishedAt: null,
      ...overrides,
    },
    publishedWorld,
    draftWorld,
    publishedTuning,
    draftTuning,
    layers: draftWorld.layers.map((layer) => ({
      key: layer.key,
      zIndex: layer.zIndex,
      liveSrc: publishedWorld.layers.find((entry) => entry.key === layer.key)?.src ?? layer.src,
      draftSrc: layer.src,
      liveAssetPath: `repo/worlds/shared-commons/v1/${layer.key}.png`,
      draftAssetPath: layer.key === 'midground'
        ? `worlds/shared-commons/draft/${layer.key}.png`
        : `repo/worlds/shared-commons/v1/${layer.key}.png`,
      hasDraftOverride: layer.key === 'midground',
      hasArchivedOverride: layer.key === 'foreground',
      isArchivedDraftOnly: layer.key === 'foreground',
      archivedAssetPath: layer.key === 'foreground' ? 'worlds/shared-commons/archived/foreground-a1b2c3.png' : null,
      archivedAssetUrl: layer.key === 'foreground' ? '/api/world-assets/worlds/shared-commons/archived/foreground-a1b2c3.png' : null,
      archivedAt: layer.key === 'foreground' ? '2026-04-12T20:45:00.000Z' : null,
      archivedByDisplayName: layer.key === 'foreground' ? 'Admin User' : null,
    })),
    archivedLayers: [
      {
        worldId: 'shared-commons',
        layerKey: 'foreground',
        assetPath: 'worlds/shared-commons/archived/foreground-a1b2c3.png',
        assetUrl: '/api/world-assets/worlds/shared-commons/archived/foreground-a1b2c3.png',
        archivedAt: '2026-04-12T20:45:00.000Z',
        archivedByDisplayName: 'Admin User',
      },
    ],
    recentAudit: [
      {
        id: 1,
        action: 'archive_world_layer_asset',
        actionLabel: 'Archive layer',
        section: 'worlds',
        targetType: 'scene_world_layer',
        targetId: 'shared-commons:foreground',
        actorDisplayName: 'Admin User',
        createdAt: '2026-04-12T20:45:00.000Z',
        summary: 'Archived the foreground layer override and restored the live draft to the published source.',
      },
    ],
  };
}

describe('AdminWorldsPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the worlds operator surface and draft/layer controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makeWorldPayload()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    expect(await screen.findByRole('heading', { name: 'World asset console' })).not.toBeNull();
    expect(screen.getByText('Open draft preview')).not.toBeNull();
    expect(screen.getByText('Replace draft layers')).not.toBeNull();
    expect(screen.getByText('Replace draft world JSON')).not.toBeNull();
    expect(screen.getByText('Draft runtime caps')).not.toBeNull();
    expect(screen.getByLabelText('Paste world package JSON')).not.toBeNull();
    expect(screen.getByLabelText('Paste movement tuning JSON')).not.toBeNull();
    expect(screen.getByText('Hero crop')).not.toBeNull();
    expect(screen.getByText('Hero crop (tablet)')).not.toBeNull();
    expect(screen.getByText('Hero crop (mobile)')).not.toBeNull();
    expect(screen.getAllByText(`${SHARED_COMMONS_WORLD.guides.heroCrop?.x}, ${SHARED_COMMONS_WORLD.guides.heroCrop?.y}, ${SHARED_COMMONS_WORLD.guides.heroCrop?.width}x${SHARED_COMMONS_WORLD.guides.heroCrop?.height}`).length).toBeGreaterThan(0);
    expect(screen.getByText('Published hero crop')).not.toBeNull();
    expect(screen.getByText('Published hero crop (tablet)')).not.toBeNull();
    expect(screen.getByText('Published hero crop (mobile)')).not.toBeNull();
    expect(screen.getByTestId('world-layer-upload-midground')).not.toBeNull();
    expect(screen.getByText('Movement tuning readback')).not.toBeNull();
    expect(screen.getByText('Jam breakout (ms)')).not.toBeNull();
    expect(screen.getByText('Facing flip velocity')).not.toBeNull();
    expect(screen.getByText('Time before jammed actors are forced to break free.')).not.toBeNull();
    expect(screen.getByText('Minimum spacing to keep between active Ghostlings.')).not.toBeNull();
    expect(screen.getByText('Archived draft override recovery')).not.toBeNull();
    expect(screen.getByText('Layer overrides and file readback')).not.toBeNull();
    expect(screen.getByText('Archived the foreground layer override and restored the live draft to the published source.')).not.toBeNull();
  });

  it('publishes the staged world after an inline review step', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Draft world published.',
        world: makeWorldPayload({ hasDraft: false, hasPublishedVariant: true, publishedAt: '2026-04-12T22:00:00.000Z' }),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    fireEvent.click(screen.getByRole('button', { name: 'Publish draft' }));

    expect(await screen.findByText('Confirm publish')).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish draft' }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const publishCall = fetchMock.mock.calls[1];
    expect(publishCall?.[0]).toBe('/api/admin/worlds/publish');
    expect(publishCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(publishCall?.[1]?.body))).toEqual({ worldId: 'shared-commons' });
  });

  it('stages a layer upload into the draft asset route', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Draft foreground layer updated.',
        world: makeWorldPayload(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    const form = screen.getByTestId('world-layer-upload-foreground');
    const fileInput = within(form).getByLabelText('Asset file') as HTMLInputElement;
    const file = new File(['png'], 'foreground.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall?.[0]).toBe('/api/admin/worlds/draft/assets');
    expect(uploadCall?.[1]).toMatchObject({ method: 'POST' });
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('archives a draft override after an inline review step', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Archived midground draft override.',
        world: makeWorldPayload({ archivedLayerCount: 2 }),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    fireEvent.click(screen.getByRole('button', { name: 'Archive draft override' }));

    expect((await screen.findAllByText('Confirm archive')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirm archive' }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const archiveCall = fetchMock.mock.calls[1];
    expect(archiveCall?.[0]).toBe('/api/admin/worlds/draft/assets/archive');
    expect(archiveCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(archiveCall?.[1]?.body))).toEqual({ worldId: 'shared-commons', layerKey: 'midground' });
  });

  it('saves draft maxVisible tuning through the tuning route', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Draft tuning updated.',
        world: makeWorldPayload(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    const desktopInput = screen.getByLabelText('Desktop max visible') as HTMLInputElement;
    fireEvent.change(desktopInput, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft tuning' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const tuningCall = fetchMock.mock.calls[1];
    expect(tuningCall?.[0]).toBe('/api/admin/worlds/draft/tuning');
    expect(tuningCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(tuningCall?.[1]?.body)).tuning.buckets.desktop.maxVisible).toBe(14);
  });

  it('imports pasted world package JSON through the package route and clears the textarea on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Draft world package replaced.',
        world: makeWorldPayload(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    const textarea = screen.getByLabelText('Paste world package JSON') as HTMLTextAreaElement;
    const pastedPackage = JSON.stringify({
      schemaVersion: 1,
      worldId: 'shared-commons',
      preset: 'public-hero',
      sourceWidth: SHARED_COMMONS_WORLD.sourceWidth,
      sourceHeight: SHARED_COMMONS_WORLD.sourceHeight,
      layers: SHARED_COMMONS_WORLD.layers.map((layer) => ({ ...layer, src: `/bogus/${layer.key}.png` })),
      guides: SHARED_COMMONS_WORLD.guides,
      fallbackAnchor: SHARED_COMMONS_WORLD.fallbackAnchor,
      safeZones: SHARED_COMMONS_WORLD.safeZones,
      points: SHARED_COMMONS_WORLD.points,
      viewports: SHARED_COMMONS_WORLD.viewports,
    });

    fireEvent.change(textarea, { target: { value: pastedPackage } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted package' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const packageCall = fetchMock.mock.calls[1];
    expect(packageCall?.[0]).toBe('/api/admin/worlds/draft/package');
    expect(packageCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(packageCall?.[1]?.body))).toEqual({
      worldId: 'shared-commons',
      packageText: pastedPackage,
    });

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('imports pasted movement tuning JSON through the tuning route and resyncs the numeric caps', async () => {
    const importedWorld = makeWorldPayload();
    importedWorld.draftTuning = createDefaultGhostlingSceneTuningSpec();
    importedWorld.draftTuning.buckets.mobile.maxVisible = 7;
    importedWorld.draftTuning.buckets.tablet.maxVisible = 10;
    importedWorld.draftTuning.buckets.desktop.maxVisible = 18;

    const pastedTuning = JSON.stringify({
      buckets: {
        mobile: { maxVisible: 7, speedMin: 14, speedMax: 18, pauseMinMs: 320, pauseMaxMs: 720, arrivalRadius: 18, settleRadius: 2.4, minGap: 36, facingFlipVelocity: 0.75, facingFlipDistance: 14 },
        tablet: { maxVisible: 10, speedMin: 17, speedMax: 24, pauseMinMs: 360, pauseMaxMs: 760, arrivalRadius: 20, settleRadius: 2.8, minGap: 40, facingFlipVelocity: 0.82, facingFlipDistance: 15 },
        desktop: { maxVisible: 18, speedMin: 18, speedMax: 26, pauseMinMs: 420, pauseMaxMs: 880, arrivalRadius: 22, settleRadius: 3.1, minGap: 44, facingFlipVelocity: 0.9, facingFlipDistance: 16 },
      },
      shared: {
        jamBreakoutMs: 1900,
        verticalTravelFactor: 0.74,
        settleDamping: 5.6,
        minTargetTravelRatio: 0.57,
        anchorHopChance: 0.32,
      },
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Draft tuning updated.',
        world: importedWorld,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    const textarea = screen.getByLabelText('Paste movement tuning JSON') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: pastedTuning } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted tuning' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const tuningCall = fetchMock.mock.calls[1];
    expect(tuningCall?.[0]).toBe('/api/admin/worlds/draft/tuning');
    expect(tuningCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(tuningCall?.[1]?.body))).toEqual({
      worldId: 'shared-commons',
      tuningText: pastedTuning,
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Desktop max visible') as HTMLInputElement).value).toBe('18');
    });
    expect(textarea.value).toBe('');
  });

  it('keeps pasted package text in place when package import fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeWorldPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'World package must be valid JSON.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminWorldsPage />);

    await screen.findByRole('heading', { name: 'World asset console' });

    const textarea = screen.getByLabelText('Paste world package JSON') as HTMLTextAreaElement;
    const pastedPackage = '{"schemaVersion":1,';
    fireEvent.change(textarea, { target: { value: pastedPackage } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted package' }));

    expect(await screen.findByText('World package must be valid JSON.')).not.toBeNull();
    expect(textarea.value).toBe(pastedPackage);
  });
});
