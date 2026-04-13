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
      hasDraftOverride: layer.key === 'midground',
    })),
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
    expect(screen.getByText('Hero crop')).not.toBeNull();
    expect(screen.getAllByText(`${SHARED_COMMONS_WORLD.guides.heroCrop?.x}, ${SHARED_COMMONS_WORLD.guides.heroCrop?.y}, ${SHARED_COMMONS_WORLD.guides.heroCrop?.width}x${SHARED_COMMONS_WORLD.guides.heroCrop?.height}`).length).toBeGreaterThan(0);
    expect(screen.getByText('Published hero crop')).not.toBeNull();
    expect(screen.getByTestId('world-layer-upload-midground')).not.toBeNull();
    expect(screen.getByText('Published vs draft layer previews')).not.toBeNull();
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
});
