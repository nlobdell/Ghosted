/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompanionAdminData } from '@/lib/types';
import GhostlingAdminPage from '@/app/admin/ghostling/page';

vi.mock('@/components/companion/AnimatedCompanionStage', () => ({
  AnimatedCompanionStage: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

function makePayload(): CompanionAdminData {
  return {
    storageRoot: '/ghostling',
    defaultAssetRoot: '/ghostling/defaults',
    base: {
      assetPath: 'base/ghostling.png',
      assetUrl: 'https://example.com/base/ghostling.png',
      bodyAssetPath: 'base/body.png',
      bodyAssetUrl: 'https://example.com/base/body.png',
      headAssetPath: 'base/head.png',
      headAssetUrl: 'https://example.com/base/head.png',
      previewUrl: 'https://example.com/base/preview.png',
      renderManifest: {
        width: 256,
        height: 256,
        motion: {
          shadowOpacity: 0.18,
          rootGroup: 'root',
          channels: {},
          slotGroups: {},
        },
        layers: [],
      },
    },
    items: [
      {
        slug: 'moon-hood',
        name: 'Moon Hood',
        slot: 'hat',
        rarity: 'rare',
        cost: 120,
        description: 'Lunar hood',
        active: true,
        sortOrder: 10,
        frontAssetPath: 'items/moon-hood/front.png',
        frontAssetUrl: 'https://example.com/items/moon-hood/front.png',
        backAssetPath: 'items/moon-hood/back.png',
        backAssetUrl: 'https://example.com/items/moon-hood/back.png',
        renderMetadata: null,
        previewUrl: 'https://example.com/items/moon-hood/preview.png',
      },
    ],
    repoCandidates: [
      {
        slug: 'star-visor',
        name: 'Star Visor',
        suggestedSlot: 'face',
        suggestedRarity: 'epic',
        suggestedCost: 320,
        suggestedDescription: 'Imported from the repo queue.',
        frontAssetPath: 'repo/star-visor/front.png',
        frontAssetUrl: 'https://example.com/repo/star-visor/front.png',
        backAssetPath: 'repo/star-visor/back.png',
        backAssetUrl: 'https://example.com/repo/star-visor/back.png',
        renderMetadataPath: 'repo/star-visor/render.json',
        renderMetadata: null,
        renderMetadataErrors: [],
      },
    ],
  };
}

describe('GhostlingAdminPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the live preview visible and uses inline confirmations for replace and hide actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makePayload()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<GhostlingAdminPage />);

    expect(await screen.findByRole('heading', { name: 'Ghostling asset console' })).not.toBeNull();
    expect(screen.getByLabelText('Primary admin actions')).not.toBeNull();
    expect(screen.getByLabelText('Verification and recent state')).not.toBeNull();
    expect(screen.getByText('Ghostling base preview')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Repo import queue' })).not.toBeNull();
    expect(screen.getByText('Star Visor')).not.toBeNull();
    expect(screen.getAllByText('Moon Hood').length).toBeGreaterThan(0);

    const rail = screen.getByLabelText('Primary admin actions');
    const replaceSection = within(rail).getByRole('heading', { name: 'Replace live files' }).closest('section');
    expect(replaceSection).not.toBeNull();

    const replacementFile = new File(['front'], 'moon-front.png', { type: 'image/png' });
    vi.stubGlobal('FormData', class MockFormData {
      get(name: string) {
        if (name === 'slug') return 'moon-hood';
        if (name === 'frontAsset') return replacementFile;
        return null;
      }
    });
    fireEvent.click(within(replaceSection!).getByRole('button', { name: 'Review replacement' }));

    expect((await screen.findAllByText('Confirm live replacement')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

    expect((await screen.findAllByText('Confirm hide')).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
