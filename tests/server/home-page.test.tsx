import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_GHOSTLING_ACTOR_METRICS } from '@/lib/ghostling-actor';
import { createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import type { CompanionPreviewSummary, NewsPost, ScenePresencePayload, ShellData } from '@/lib/types';

const { getServerJSONMock } = vi.hoisted(() => ({
  getServerJSONMock: vi.fn(),
}));
const {
  getCurrentUserMock,
  resolveDraftGhostlingWorldMock,
  resolveDraftGhostlingWorldTuningMock,
  resolvePublishedGhostlingWorldMock,
  resolvePublishedGhostlingWorldTuningMock,
  resolveRepoGhostlingWorldMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  resolveDraftGhostlingWorldMock: vi.fn(),
  resolveDraftGhostlingWorldTuningMock: vi.fn(),
  resolvePublishedGhostlingWorldMock: vi.fn(),
  resolvePublishedGhostlingWorldTuningMock: vi.fn(),
  resolveRepoGhostlingWorldMock: vi.fn(),
}));

vi.mock('@/lib/server-api', () => ({
  getServerJSON: getServerJSONMock,
}));

vi.mock('@/lib/server/database', () => ({
  getDatabase: () => ({ mocked: true }),
}));

vi.mock('@/lib/server/ghosted-api', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/lib/server/scene-worlds', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/scene-worlds')>('@/lib/server/scene-worlds');
  return {
    ...actual,
    resolveDraftGhostlingWorld: resolveDraftGhostlingWorldMock,
    resolveDraftGhostlingWorldTuning: resolveDraftGhostlingWorldTuningMock,
    resolvePublishedGhostlingWorld: resolvePublishedGhostlingWorldMock,
    resolvePublishedGhostlingWorldTuning: resolvePublishedGhostlingWorldTuningMock,
    resolveRepoGhostlingWorld: resolveRepoGhostlingWorldMock,
  };
});

vi.mock('@/components/GhostlingScene', () => ({
  GhostlingScene: ({
    variant,
    fallbackMode,
    world,
    preset,
    worldSpec,
    tuningSpec,
    debugWorldOverlay,
    sceneEditorEnabled,
    realtimeDisabled,
  }: {
    variant?: string;
    fallbackMode?: string;
    world?: string;
    preset?: string;
    worldSpec?: { sourceWidth?: number; sourceHeight?: number } | null;
    tuningSpec?: { buckets?: { desktop?: { maxVisible?: number } } } | null;
    debugWorldOverlay?: boolean;
    sceneEditorEnabled?: boolean;
    realtimeDisabled?: boolean;
  }) => (
    <section
      data-testid="ghostling-scene"
      data-variant={variant}
      data-fallback-mode={fallbackMode}
      data-world={world}
      data-preset={preset}
      data-world-width={worldSpec?.sourceWidth}
      data-world-height={worldSpec?.sourceHeight}
      data-desktop-cap={tuningSpec?.buckets?.desktop?.maxVisible}
      data-debug-world-overlay={debugWorldOverlay ? 'true' : 'false'}
      data-scene-editor-enabled={sceneEditorEnabled ? 'true' : 'false'}
      data-realtime-disabled={realtimeDisabled ? 'true' : 'false'}
    />
  ),
}));

vi.mock('@/components/home/NewsPreview', () => ({
  NewsPreview: ({ posts }: { posts: NewsPost[] }) => <section data-testid="news-preview">{posts.length}</section>,
}));

import HomePage from '@/app/(public)/page';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

describe('home page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function installPayloads() {
    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockResolvedValue(null);
    const defaultTuning = createDefaultGhostlingSceneTuningSpec();
    resolvePublishedGhostlingWorldMock.mockReset();
    resolvePublishedGhostlingWorldMock.mockReturnValue(SHARED_COMMONS_WORLD);
    resolvePublishedGhostlingWorldTuningMock.mockReset();
    resolvePublishedGhostlingWorldTuningMock.mockReturnValue(defaultTuning);
    resolveRepoGhostlingWorldMock.mockReset();
    resolveRepoGhostlingWorldMock.mockReturnValue(SHARED_COMMONS_WORLD);
    resolveDraftGhostlingWorldMock.mockReset();
    resolveDraftGhostlingWorldMock.mockReturnValue(SHARED_COMMONS_WORLD);
    resolveDraftGhostlingWorldTuningMock.mockReset();
    resolveDraftGhostlingWorldTuningMock.mockReturnValue(defaultTuning);
    const shellData: ShellData = {
      authenticated: false,
      brand: { label: 'Ghosted', href: '/' },
      navigation: [],
      links: {},
      utilityGroups: {},
      activeRouteKey: 'home',
      auth: { canSignIn: true, loginHref: '/login' },
      wom: {
        configured: true,
        linked: false,
        inGroup: false,
      },
    };
    const scenePayload: ScenePresencePayload = {
      source: 'empty',
      members: [],
    };
    const previewSummary: CompanionPreviewSummary = {
      user: null,
      renderUrl: '/api/companion/render',
      animatedRenderUrl: '/api/companion/render-animated',
      actorMetrics: DEFAULT_GHOSTLING_ACTOR_METRICS,
      renderManifest: {
        width: 32,
        height: 32,
        motion: {
          shadowOpacity: 0.2,
          rootGroup: 'root',
          channels: {
            root: {},
          },
          slotGroups: {},
          accents: [],
        },
        layers: [],
      },
    };

    getServerJSONMock.mockImplementation(async (path: string) => {
      if (path === '/api/news?limit=3') return { posts: [] };
      if (path === '/api/site-shell?next=%2Fhall%2F') return shellData;
      if (path === '/api/scene/presence') return scenePayload;
      if (path === '/api/companion/preview') return previewSummary;
      return null;
    });
  }

  it('renders the full-bleed world hero with the default rail and content shell', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({}),
    }));

    expect(getServerJSONMock).toHaveBeenCalledWith('/api/scene/presence');
    expect(markup).toContain('data-testid="ghostling-scene"');
    expect(markup).toContain('data-variant="hero"');
    expect(markup).toContain('data-fallback-mode="single"');
    expect(markup).toContain('data-world="shared-commons"');
    expect(markup).toContain('data-preset="public-hero"');
    expect(markup).toContain(`data-world-width="${SHARED_COMMONS_WORLD.sourceWidth}"`);
    expect(markup).toContain(`data-desktop-cap="${createDefaultGhostlingSceneTuningSpec().buckets.desktop.maxVisible}"`);
    expect(markup).toContain('House mascot live');
    expect(markup).toContain('Join Discord');
    expect(markup).toContain('Enter the Hall');
    expect(markup).toContain('data-testid="news-preview"');
    expect(markup).not.toContain('data-backdrop-mode');
    expect(markup).not.toContain('Your Ghostling preview');
  });

  it('passes the dev-only debug flag through when sceneDebug=1 in non-production environments', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneDebug: '1' }),
    }));

    expect(markup).toContain('data-debug-world-overlay="true"');
  });

  it('passes the dev-only scene editor flag through when sceneEditor=1 in non-production environments', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneEditor: '1' }),
    }));

    expect(markup).toContain('data-scene-editor-enabled="true"');
    expect(markup).not.toContain('House mascot live');
    expect(markup).not.toContain('Join Discord');
    expect(markup).not.toContain('Enter the Hall');
    expect(markup).not.toContain('data-testid="news-preview"');
  });

  it('allows the scene editor on production for admin users only', async () => {
    installPayloads();
    vi.stubEnv('NODE_ENV', 'production');
    getCurrentUserMock.mockResolvedValue({
      id: 1,
      is_admin: 1,
      username: 'admin',
      global_name: 'Admin',
    });

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneEditor: '1' }),
    }));

    expect(markup).toContain('data-scene-editor-enabled="true"');
    expect(markup).not.toContain('Join Discord');
    expect(markup).not.toContain('data-testid="news-preview"');
  });

  it('ignores the scene editor query on production for non-admin users', async () => {
    installPayloads();
    vi.stubEnv('NODE_ENV', 'production');
    getCurrentUserMock.mockResolvedValue({
      id: 2,
      is_admin: 0,
      username: 'member',
      global_name: 'Member',
    });

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneEditor: '1' }),
    }));

    expect(markup).toContain('data-scene-editor-enabled="false"');
    expect(markup).toContain('Join Discord');
    expect(markup).toContain('data-testid="news-preview"');
  });

  it('uses the deterministic visual fixture and disables realtime when requested outside production', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneFixture: 'visual-baseline' }),
    }));

    expect(getServerJSONMock).not.toHaveBeenCalledWith('/api/scene/presence');
    expect(markup).toContain('data-realtime-disabled="true"');
  });

  it('loads the admin-only draft world preview with local hero motion when requested by an admin', async () => {
    installPayloads();
    getCurrentUserMock.mockResolvedValue({
      id: 1,
      is_admin: 1,
      username: 'admin',
      global_name: 'Admin',
    });

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ worldPreview: 'shared-commons:draft' }),
    }));

    expect(resolveDraftGhostlingWorldMock).toHaveBeenCalled();
    expect(resolveDraftGhostlingWorldTuningMock).toHaveBeenCalled();
    expect(markup).toContain('data-realtime-disabled="true"');
    expect(markup).toContain('Join Discord');
    expect(markup).toContain('data-world-width="3150"');
  });

  it('loads the repo world preview in development without requiring admin access', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ worldPreview: 'shared-commons:repo' }),
    }));

    expect(resolveRepoGhostlingWorldMock).toHaveBeenCalled();
    expect(resolveDraftGhostlingWorldMock).not.toHaveBeenCalled();
    expect(resolvePublishedGhostlingWorldMock).not.toHaveBeenCalled();
    expect(markup).toContain('data-realtime-disabled="true"');
    expect(markup).toContain('data-world-width="3150"');
  });

  it('ignores the draft world preview query for non-admin users', async () => {
    installPayloads();
    getCurrentUserMock.mockResolvedValue({
      id: 2,
      is_admin: 0,
      username: 'member',
      global_name: 'Member',
    });

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ worldPreview: 'shared-commons:draft' }),
    }));

    expect(resolveDraftGhostlingWorldMock).not.toHaveBeenCalled();
    expect(resolveDraftGhostlingWorldTuningMock).not.toHaveBeenCalled();
    expect(resolvePublishedGhostlingWorldMock).toHaveBeenCalled();
    expect(resolvePublishedGhostlingWorldTuningMock).toHaveBeenCalled();
    expect(markup).toContain('data-realtime-disabled="false"');
  });
});
