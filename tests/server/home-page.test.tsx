import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_GHOSTLING_ACTOR_METRICS } from '@/lib/ghostling-actor';
import type { CompanionPreviewSummary, NewsPost, ScenePresencePayload, ShellData } from '@/lib/types';

const { getServerJSONMock } = vi.hoisted(() => ({
  getServerJSONMock: vi.fn(),
}));

vi.mock('@/lib/server-api', () => ({
  getServerJSON: getServerJSONMock,
}));

vi.mock('@/components/GhostlingScene', () => ({
  GhostlingScene: ({
    variant,
    fallbackMode,
    world,
    preset,
    debugWorldOverlay,
    sceneEditorEnabled,
    realtimeDisabled,
  }: {
    variant?: string;
    fallbackMode?: string;
    world?: string;
    preset?: string;
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

describe('home page', () => {
  function installPayloads() {
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

  it('renders the full-bleed world hero first and keeps the action rail below it', async () => {
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
    expect(markup).toContain('House mascot live');
    expect(markup).toContain('Join Discord');
    expect(markup).toContain('Enter the Hall');
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
  });

  it('uses the deterministic visual fixture and disables realtime when requested outside production', async () => {
    installPayloads();

    const markup = renderToStaticMarkup(await HomePage({
      searchParams: Promise.resolve({ sceneFixture: 'visual-baseline' }),
    }));

    expect(getServerJSONMock).not.toHaveBeenCalledWith('/api/scene/presence');
    expect(markup).toContain('data-realtime-disabled="true"');
  });
});
