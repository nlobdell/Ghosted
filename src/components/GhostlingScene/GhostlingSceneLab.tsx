'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEFAULT_GHOSTLING_SCENE_LAB_OVERLAY_VISIBILITY,
  clampGhostlingWorldRect,
  exportGhostlingSceneLabSession,
  exportGhostlingWorldDraft,
  type GhostlingSceneLabOverlayKey,
  type GhostlingSceneLabOverlayVisibility,
  type GhostlingSceneLabPreviewMode,
  type GhostlingSceneLabPreviewState,
  type GhostlingSceneLabSearchQuery,
  type GhostlingSceneLabSelection,
  type GhostlingSceneLabTab,
} from '@/lib/ghostling-scene-lab';
import {
  projectGhostlingWorldPoint,
  projectGhostlingWorldRect,
  unprojectGhostlingScreenPoint,
  type GhostlingSceneCameraMetrics,
} from '@/lib/ghostling-camera';
import type {
  GhostlingSceneDensityBucket,
  GhostlingWorldRect,
  GhostlingWorldSpec,
} from '@/lib/ghostling-world';
import type { GhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import styles from './GhostlingScene.module.css';

export interface GhostlingSceneLabMemberDiagnostic {
  key: string;
  displayName: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  pointKey: string;
  safeZoneKey: string;
  movementPhase: string;
  speed: number;
  velocityX: number;
  velocityY: number;
  crowding: number;
  distanceToTarget: number;
}

type RectSelectionKey = Extract<GhostlingSceneLabSelection, { kind: 'safe-zone' | 'guide' }>;
type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

type DragState =
  | {
      kind: 'anchor';
      key: string;
      fallback: boolean;
      startClientX: number;
      startClientY: number;
      originX: number;
      originY: number;
    }
  | {
      kind: 'guide-line';
      key: 'horizonY' | 'floorY';
      startClientX: number;
      startClientY: number;
      originY: number;
    }
  | {
      kind: 'rect';
      selection: RectSelectionKey;
      handle: DragHandle;
      startClientX: number;
      startClientY: number;
      originRect: GhostlingWorldRect;
    };

type SceneLabObjectItem = {
  id: string;
  label: string;
  group: string;
  selection: GhostlingSceneLabSelection;
  meta?: string;
};

type GhostlingSceneLabProps = {
  worldDraft: GhostlingWorldSpec;
  updateWorldDraft: (
    update: GhostlingWorldSpec | ((current: GhostlingWorldSpec) => GhostlingWorldSpec),
    options?: { history?: 'none' | 'immediate' },
  ) => boolean;
  tuningDraft: GhostlingSceneTuningSpec;
  updateTuningDraft: (
    update: GhostlingSceneTuningSpec | ((current: GhostlingSceneTuningSpec) => GhostlingSceneTuningSpec),
    options?: { history?: 'none' | 'immediate' },
  ) => boolean;
  selection: GhostlingSceneLabSelection | null;
  onSelectionChange: (selection: GhostlingSceneLabSelection | null) => void;
  activeTab: GhostlingSceneLabTab;
  onActiveTabChange: (tab: GhostlingSceneLabTab) => void;
  searchQuery: GhostlingSceneLabSearchQuery;
  onSearchQueryChange: (query: GhostlingSceneLabSearchQuery) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onBeginHistoryCapture: () => void;
  onCommitHistoryCapture: () => void;
  onCancelHistoryCapture: () => void;
  camera: GhostlingSceneCameraMetrics;
  bucket: GhostlingSceneDensityBucket;
  previewMode: GhostlingSceneLabPreviewMode;
  playing: boolean;
  ghostCount: number;
  ghostCountMax: number;
  memberDiagnostics: GhostlingSceneLabMemberDiagnostic[];
  onPreviewModeChange: (mode: GhostlingSceneLabPreviewMode) => void;
  onPlayingChange: (playing: boolean) => void;
  onGhostCountChange: (count: number) => void;
  onStep: () => void;
  onReset: () => void;
  onRefreshLive: () => void;
};

const GUIDE_RECT_KEYS = ['safeArea', 'centerSafe', 'ultrawideBleed', 'labelSafeTop'] as const;
const TUNING_BUCKETS: GhostlingSceneDensityBucket[] = ['desktop', 'tablet', 'mobile'];
const GUIDE_SELECTION_LABELS = {
  safeArea: 'Safe area',
  centerSafe: 'Center safe',
  ultrawideBleed: 'Bleed',
  labelSafeTop: 'Label safe',
  horizonY: 'Horizon',
  floorY: 'Floor line',
} as const;
const OVERLAY_VISIBILITY_LABELS: Record<GhostlingSceneLabOverlayKey, string> = {
  'safe-zones': 'Safe zones',
  'guide-rects': 'Guide rects',
  'guide-lines': 'Guide lines',
  anchors: 'Anchors',
  'fallback-anchor': 'Fallback anchor',
  members: 'Members',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function selectionKey(selection: GhostlingSceneLabSelection | null) {
  if (!selection) return '';
  return selection.kind === 'fallback-anchor'
    ? selection.kind
    : `${selection.kind}:${selection.key}`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function selectedRect(
  worldDraft: GhostlingWorldSpec,
  selection: RectSelectionKey,
): GhostlingWorldRect | null {
  if (selection.kind === 'safe-zone') {
    return worldDraft.safeZones.find((safeZone) => safeZone.key === selection.key)?.bounds ?? null;
  }

  const guideValue = worldDraft.guides[selection.key];
  return typeof guideValue === 'object' && guideValue !== null && 'width' in guideValue ? guideValue : null;
}

function applyRectSelectionUpdate(
  worldDraft: GhostlingWorldSpec,
  selection: RectSelectionKey,
  rect: GhostlingWorldRect,
) {
  if (selection.kind === 'safe-zone') {
    return {
      ...worldDraft,
      safeZones: worldDraft.safeZones.map((safeZone) => (
        safeZone.key === selection.key
          ? { ...safeZone, bounds: rect }
          : safeZone
      )),
    };
  }

  return {
    ...worldDraft,
    guides: {
      ...worldDraft.guides,
      [selection.key]: rect,
    },
    safeArea: selection.key === 'safeArea' ? rect : worldDraft.safeArea,
  };
}

function resizeRect(
  rect: GhostlingWorldRect,
  handle: Exclude<DragHandle, 'move'>,
  dx: number,
  dy: number,
) {
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (handle === 'nw' || handle === 'sw') nextLeft += dx;
  if (handle === 'ne' || handle === 'se') nextRight += dx;
  if (handle === 'nw' || handle === 'ne') nextTop += dy;
  if (handle === 'sw' || handle === 'se') nextBottom += dy;

  if (nextRight <= nextLeft) nextRight = nextLeft + 1;
  if (nextBottom <= nextTop) nextBottom = nextTop + 1;

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  } satisfies GhostlingWorldRect;
}

function SelectionNumberField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  min,
  max,
  step = 1,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
}) {
  return (
    <label className={styles.sceneLabField}>
      <span>{label}</span>
      <input
        data-testid={testId}
        className={styles.sceneLabInput}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </label>
  );
}

export function GhostlingSceneLab({
  worldDraft,
  updateWorldDraft,
  tuningDraft,
  updateTuningDraft,
  selection,
  onSelectionChange,
  activeTab,
  onActiveTabChange,
  searchQuery,
  onSearchQueryChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBeginHistoryCapture,
  onCommitHistoryCapture,
  onCancelHistoryCapture,
  camera,
  bucket,
  previewMode,
  playing,
  ghostCount,
  ghostCountMax,
  memberDiagnostics,
  onPreviewModeChange,
  onPlayingChange,
  onGhostCountChange,
  onStep,
  onReset,
  onRefreshLive,
}: GhostlingSceneLabProps) {
  const [tuningBucket, setTuningBucket] = useState<GhostlingSceneDensityBucket>(bucket);
  const [exportStatus, setExportStatus] = useState('');
  const [overlayVisibility, setOverlayVisibility] = useState<GhostlingSceneLabOverlayVisibility>(
    DEFAULT_GHOSTLING_SCENE_LAB_OVERLAY_VISIBILITY,
  );
  const dragRef = useRef<DragState | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setTuningBucket(bucket);
  }, [bucket]);

  const previewState: GhostlingSceneLabPreviewState = {
    mode: previewMode,
    playing,
    ghostCount,
    bucket,
  };

  const selectedAnchor = useMemo(
    () => (selection?.kind === 'anchor'
      ? worldDraft.points.find((point) => point.key === selection.key) ?? null
      : null),
    [selection, worldDraft.points],
  );
  const selectedSafeZone = useMemo(
    () => (selection?.kind === 'safe-zone'
      ? worldDraft.safeZones.find((safeZone) => safeZone.key === selection.key) ?? null
      : null),
    [selection, worldDraft.safeZones],
  );
  const selectedGuideRect = useMemo(
    () => (
      selection?.kind === 'guide' && GUIDE_RECT_KEYS.includes(selection.key as typeof GUIDE_RECT_KEYS[number])
        ? selectedRect(worldDraft, selection as RectSelectionKey)
        : null
    ),
    [selection, worldDraft],
  );
  const selectedMember = useMemo(
    () => (selection?.kind === 'member'
      ? memberDiagnostics.find((member) => member.key === selection.key) ?? null
      : null),
    [memberDiagnostics, selection],
  );
  const bucketSettings = tuningDraft.buckets[tuningBucket];
  const authoredItems = useMemo<SceneLabObjectItem[]>(() => ([
    ...worldDraft.points.map((point) => ({
      id: `anchor:${point.key}`,
      label: point.label,
      group: 'Anchors',
      selection: { kind: 'anchor', key: point.key } satisfies GhostlingSceneLabSelection,
      meta: `${point.x}, ${point.y}`,
    })),
    {
      id: 'fallback-anchor',
      label: worldDraft.fallbackAnchor.label,
      group: 'Fallback',
      selection: { kind: 'fallback-anchor' } satisfies GhostlingSceneLabSelection,
      meta: `${worldDraft.fallbackAnchor.x}, ${worldDraft.fallbackAnchor.y}`,
    },
    ...worldDraft.safeZones.map((safeZone) => ({
      id: `safe-zone:${safeZone.key}`,
      label: safeZone.label,
      group: 'Safe Zones',
      selection: { kind: 'safe-zone', key: safeZone.key } satisfies GhostlingSceneLabSelection,
      meta: `${safeZone.bounds.x}, ${safeZone.bounds.y}, ${safeZone.bounds.width}x${safeZone.bounds.height}`,
    })),
    ...([
      ...GUIDE_RECT_KEYS,
      'horizonY',
      'floorY',
    ] as const)
      .filter((guideKey) => guideKey !== 'labelSafeTop' || Boolean(worldDraft.guides.labelSafeTop))
      .map((guideKey) => ({
        id: `guide:${guideKey}`,
        label: GUIDE_SELECTION_LABELS[guideKey],
        group: 'Guides',
        selection: { kind: 'guide', key: guideKey } satisfies GhostlingSceneLabSelection,
        meta: guideKey === 'horizonY' || guideKey === 'floorY'
          ? String(worldDraft.guides[guideKey])
          : (() => {
              const rect = worldDraft.guides[guideKey];
              if (!rect) {
                return '0, 0, 0x0';
              }
              return `${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`;
            })(),
      })),
  ]), [worldDraft]);
  const memberItems = useMemo<SceneLabObjectItem[]>(() => (
    memberDiagnostics.map((member) => ({
      id: `member:${member.key}`,
      label: member.displayName,
      group: 'Members',
      selection: { kind: 'member', key: member.key } satisfies GhostlingSceneLabSelection,
      meta: `${member.pointKey} • ${member.movementPhase}`,
    }))
  ), [memberDiagnostics]);
  const browserItems = activeTab === 'members' ? memberItems : authoredItems;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => browserItems.filter((item) => {
    if (!normalizedSearch) return true;
    return `${item.label} ${item.meta ?? ''}`.toLowerCase().includes(normalizedSearch);
  }), [browserItems, normalizedSearch]);
  const groupedItems = useMemo(() => filteredItems.reduce<Array<{ group: string; items: SceneLabObjectItem[] }>>((groups, item) => {
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.group === item.group) {
      existingGroup.items.push(item);
      return groups;
    }

    groups.push({
      group: item.group,
      items: [item],
    });
    return groups;
  }, []), [filteredItems]);
  const activeSelectionKey = selectionKey(selection);
  const toggleOverlayVisibility = useCallback((key: GhostlingSceneLabOverlayKey) => {
    setOverlayVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const navigateBrowser = (delta: number) => {
    if (filteredItems.length === 0) return;
    const currentIndex = filteredItems.findIndex((item) => item.id === activeSelectionKey);
    const nextIndex = currentIndex === -1
      ? (delta > 0 ? 0 : filteredItems.length - 1)
      : clamp(currentIndex + delta, 0, filteredItems.length - 1);
    onSelectionChange(filteredItems[nextIndex]?.selection ?? null);
  };

  const handleBrowserKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateBrowser(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateBrowser(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedItem = filteredItems.find((item) => item.id === activeSelectionKey) ?? filteredItems[0];
      if (selectedItem) {
        onSelectionChange(selectedItem.selection);
      }
    }
  };

  const resolveWorldDragDelta = useCallback((drag: DragState, clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const startWorld = unprojectGhostlingScreenPoint(
        camera,
        drag.startClientX - rect.left,
        drag.startClientY - rect.top,
      );
      const currentWorld = unprojectGhostlingScreenPoint(
        camera,
        clientX - rect.left,
        clientY - rect.top,
      );

      return {
        dx: Math.round(currentWorld.x - startWorld.x),
        dy: Math.round(currentWorld.y - startWorld.y),
      };
    }

    return {
      dx: Math.round((clientX - drag.startClientX) / Math.max(0.001, camera.scaleX)),
      dy: Math.round((clientY - drag.startClientY) / Math.max(0.001, camera.scaleY)),
    };
  }, [camera]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { dx, dy } = resolveWorldDragDelta(drag, event.clientX, event.clientY);
      if (dx === 0 && dy === 0) return;

      if (drag.kind === 'anchor') {
        updateWorldDraft((current) => {
          if (drag.fallback) {
            return {
              ...current,
              fallbackAnchor: {
                ...current.fallbackAnchor,
                x: clamp(drag.originX + dx, 0, current.sourceWidth),
                y: clamp(drag.originY + dy, 0, current.sourceHeight),
              },
            };
          }

          return {
            ...current,
            points: current.points.map((point) => (
              point.key === drag.key
                ? {
                    ...point,
                    x: clamp(drag.originX + dx, 0, current.sourceWidth),
                    y: clamp(drag.originY + dy, 0, current.sourceHeight),
                  }
                : point
            )),
          };
        }, { history: 'none' });
        return;
      }

      if (drag.kind === 'guide-line') {
        updateWorldDraft((current) => {
          const nextY = clamp(drag.originY + dy, 0, current.sourceHeight);
          return {
            ...current,
            guides: {
              ...current.guides,
              [drag.key]: nextY,
            },
            horizonY: drag.key === 'horizonY' ? nextY : current.horizonY,
            floorY: drag.key === 'floorY' ? nextY : current.floorY,
          };
        }, { history: 'none' });
        return;
      }

      updateWorldDraft((current) => {
        const nextRect = drag.handle === 'move'
          ? {
              ...drag.originRect,
              x: drag.originRect.x + dx,
              y: drag.originRect.y + dy,
            }
          : resizeRect(drag.originRect, drag.handle, dx, dy);
        return applyRectSelectionUpdate(
          current,
          drag.selection,
          clampGhostlingWorldRect(nextRect, current),
        );
      }, { history: 'none' });
    };

    const onPointerUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      onCommitHistoryCapture();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dragRef.current = null;
      onCancelHistoryCapture();
    };
  }, [onCancelHistoryCapture, onCommitHistoryCapture, resolveWorldDragDelta, updateWorldDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selection) return;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      const step = event.shiftKey ? 5 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      if (dx === 0 && dy === 0) return;
      event.preventDefault();

      updateWorldDraft((current) => {
        if (selection.kind === 'anchor') {
          return {
            ...current,
            points: current.points.map((point) => (
              point.key === selection.key
                ? {
                    ...point,
                    x: clamp(point.x + dx, 0, current.sourceWidth),
                    y: clamp(point.y + dy, 0, current.sourceHeight),
                  }
                : point
            )),
          };
        }

        if (selection.kind === 'fallback-anchor') {
          return {
            ...current,
            fallbackAnchor: {
              ...current.fallbackAnchor,
              x: clamp(current.fallbackAnchor.x + dx, 0, current.sourceWidth),
              y: clamp(current.fallbackAnchor.y + dy, 0, current.sourceHeight),
            },
          };
        }

        if (selection.kind === 'safe-zone' || (selection.kind === 'guide' && GUIDE_RECT_KEYS.includes(selection.key as typeof GUIDE_RECT_KEYS[number]))) {
          const rect = selectedRect(current, selection as RectSelectionKey);
          if (!rect) return current;
          return applyRectSelectionUpdate(current, selection as RectSelectionKey, clampGhostlingWorldRect({
            ...rect,
            x: rect.x + dx,
            y: rect.y + dy,
          }, current));
        }

        if (selection.kind === 'guide' && (selection.key === 'horizonY' || selection.key === 'floorY')) {
          const nextY = clamp(current.guides[selection.key] + dy, 0, current.sourceHeight);
          return {
            ...current,
            guides: {
              ...current.guides,
              [selection.key]: nextY,
            },
            horizonY: selection.key === 'horizonY' ? nextY : current.horizonY,
            floorY: selection.key === 'floorY' ? nextY : current.floorY,
          };
        }

        return current;
      }, { history: 'immediate' });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, updateWorldDraft]);

  const beginAnchorDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    key: string,
    originX: number,
    originY: number,
    fallback = false,
  ) => {
    event.preventDefault();
    onSelectionChange(fallback ? { kind: 'fallback-anchor' } : { kind: 'anchor', key });
    onBeginHistoryCapture();
    dragRef.current = {
      kind: 'anchor',
      key,
      fallback,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX,
      originY,
    };
  };

  const beginGuideLineDrag = (
    event: ReactPointerEvent<SVGLineElement>,
    key: 'horizonY' | 'floorY',
    originY: number,
  ) => {
    event.preventDefault();
    onSelectionChange({ kind: 'guide', key });
    onBeginHistoryCapture();
    dragRef.current = {
      kind: 'guide-line',
      key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originY,
    };
  };

  const beginRectDrag = (
    event: ReactPointerEvent<SVGElement>,
    selectionKey: RectSelectionKey,
    handle: DragHandle,
    rect: GhostlingWorldRect,
  ) => {
    event.preventDefault();
    onSelectionChange(selectionKey);
    onBeginHistoryCapture();
    dragRef.current = {
      kind: 'rect',
      selection: selectionKey,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originRect: { ...rect },
    };
  };

  const copyExport = async (value: unknown, label: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setExportStatus(`${label} copied.`);
    } catch {
      setExportStatus(`${label} copy failed.`);
    }
  };

  return (
    <>
      <svg
        ref={overlayRef}
        aria-hidden="true"
        className={styles.sceneLabOverlay}
        viewBox={`0 0 ${camera.width} ${camera.height}`}
        preserveAspectRatio="none"
        style={{
          left: '0',
          top: '0',
          width: `${camera.width}px`,
          height: `${camera.height}px`,
        }}
      >
        {overlayVisibility['safe-zones'] ? worldDraft.safeZones.map((safeZone) => {
          const selected = selection?.kind === 'safe-zone' && selection.key === safeZone.key;
          const projectedBounds = projectGhostlingWorldRect(camera, safeZone.bounds);
          return (
            <g key={safeZone.key}>
              <rect
                data-scene-lab-role="safe-zone"
                x={projectedBounds.x}
                y={projectedBounds.y}
                width={projectedBounds.width}
                height={projectedBounds.height}
                className={styles.sceneLabRect}
                data-selected={selected ? 'true' : 'false'}
                onPointerDown={(event) => beginRectDrag(event, { kind: 'safe-zone', key: safeZone.key }, 'move', safeZone.bounds)}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const x = handle.includes('w') ? projectedBounds.x : projectedBounds.x + projectedBounds.width;
                const y = handle.includes('n') ? projectedBounds.y : projectedBounds.y + projectedBounds.height;
                return (
                  <rect
                    key={`${safeZone.key}:${handle}`}
                    data-scene-lab-role="safe-zone-handle"
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    className={styles.sceneLabHandle}
                    data-selected={selected ? 'true' : 'false'}
                    onPointerDown={(event) => beginRectDrag(event, { kind: 'safe-zone', key: safeZone.key }, handle, safeZone.bounds)}
                  />
                );
              })}
            </g>
          );
        }) : null}
        {overlayVisibility['guide-rects'] ? GUIDE_RECT_KEYS.map((guideKey) => {
          const rect = worldDraft.guides[guideKey];
          if (!rect) return null;
          const selected = selection?.kind === 'guide' && selection.key === guideKey;
          const projectedRect = projectGhostlingWorldRect(camera, rect);
          return (
            <g key={guideKey}>
              <rect
                data-scene-lab-role="guide-rect"
                x={projectedRect.x}
                y={projectedRect.y}
                width={projectedRect.width}
                height={projectedRect.height}
                className={styles.sceneLabGuideRect}
                data-selected={selected ? 'true' : 'false'}
                onPointerDown={(event) => beginRectDrag(event, { kind: 'guide', key: guideKey }, 'move', rect)}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const x = handle.includes('w') ? projectedRect.x : projectedRect.x + projectedRect.width;
                const y = handle.includes('n') ? projectedRect.y : projectedRect.y + projectedRect.height;
                return (
                  <rect
                    key={`${guideKey}:${handle}`}
                    data-scene-lab-role="guide-rect-handle"
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    className={styles.sceneLabHandle}
                    data-selected={selected ? 'true' : 'false'}
                    onPointerDown={(event) => beginRectDrag(event, { kind: 'guide', key: guideKey }, handle, rect)}
                  />
                );
              })}
            </g>
          );
        }) : null}
        {overlayVisibility['guide-lines'] ? <line
          data-scene-lab-role="guide-line"
          x1={projectGhostlingWorldPoint(camera, 0, worldDraft.guides.horizonY).x}
          x2={projectGhostlingWorldPoint(camera, worldDraft.sourceWidth, worldDraft.guides.horizonY).x}
          y1={projectGhostlingWorldPoint(camera, 0, worldDraft.guides.horizonY).y}
          y2={projectGhostlingWorldPoint(camera, worldDraft.sourceWidth, worldDraft.guides.horizonY).y}
          className={styles.sceneLabGuideLine}
          data-selected={selection?.kind === 'guide' && selection.key === 'horizonY' ? 'true' : 'false'}
          onPointerDown={(event) => beginGuideLineDrag(event, 'horizonY', worldDraft.guides.horizonY)}
        /> : null}
        {overlayVisibility['guide-lines'] ? <line
          data-scene-lab-role="guide-line"
          x1={projectGhostlingWorldPoint(camera, 0, worldDraft.guides.floorY).x}
          x2={projectGhostlingWorldPoint(camera, worldDraft.sourceWidth, worldDraft.guides.floorY).x}
          y1={projectGhostlingWorldPoint(camera, 0, worldDraft.guides.floorY).y}
          y2={projectGhostlingWorldPoint(camera, worldDraft.sourceWidth, worldDraft.guides.floorY).y}
          className={styles.sceneLabGuideLine}
          data-selected={selection?.kind === 'guide' && selection.key === 'floorY' ? 'true' : 'false'}
          onPointerDown={(event) => beginGuideLineDrag(event, 'floorY', worldDraft.guides.floorY)}
        /> : null}
        {overlayVisibility.anchors ? worldDraft.points.map((point) => {
          const projectedPoint = projectGhostlingWorldPoint(camera, point.x, point.y);
          return (
            <circle
              key={point.key}
              data-scene-lab-role="anchor"
              cx={projectedPoint.x}
              cy={projectedPoint.y}
              r="7"
              className={styles.sceneLabAnchor}
              data-selected={selection?.kind === 'anchor' && selection.key === point.key ? 'true' : 'false'}
              onPointerDown={(event) => beginAnchorDrag(event, point.key, point.x, point.y)}
            />
          );
        }) : null}
        {overlayVisibility['fallback-anchor'] ? (() => {
          const projectedFallback = projectGhostlingWorldPoint(camera, worldDraft.fallbackAnchor.x, worldDraft.fallbackAnchor.y);
          return (
        <circle
          data-scene-lab-role="fallback-anchor"
          cx={projectedFallback.x}
          cy={projectedFallback.y}
          r="8"
          className={styles.sceneLabFallbackAnchor}
          data-selected={selection?.kind === 'fallback-anchor' ? 'true' : 'false'}
          onPointerDown={(event) => beginAnchorDrag(event, worldDraft.fallbackAnchor.key, worldDraft.fallbackAnchor.x, worldDraft.fallbackAnchor.y, true)}
        />
          );
        })() : null}
        {overlayVisibility.members ? memberDiagnostics.map((member) => {
          const projectedMember = projectGhostlingWorldPoint(camera, member.x, member.y);
          const projectedTarget = projectGhostlingWorldPoint(camera, member.targetX, member.targetY);
          return (
          <g
            key={member.key}
            data-scene-lab-role="member"
            className={styles.sceneLabMemberMarker}
            onPointerDown={() => onSelectionChange({ kind: 'member', key: member.key })}
          >
            <line x1={projectedMember.x} y1={projectedMember.y} x2={projectedTarget.x} y2={projectedTarget.y} />
            <circle cx={projectedMember.x} cy={projectedMember.y} r="5" data-selected={selection?.kind === 'member' && selection.key === member.key ? 'true' : 'false'} />
          </g>
          );
        }) : null}
      </svg>

      <section className={styles.sceneLabPanel} data-testid="scene-lab-panel">
        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabHeaderRow}>
            <div className={styles.sceneLabSectionTitle}>Objects</div>
            <div className={styles.sceneLabButtonRow}>
              <button type="button" data-testid="scene-lab-undo" className={styles.sceneLabButton} disabled={!canUndo} onClick={onUndo}>Undo</button>
              <button type="button" data-testid="scene-lab-redo" className={styles.sceneLabButton} disabled={!canRedo} onClick={onRedo}>Redo</button>
            </div>
          </div>
          <div className={styles.sceneLabTabs}>
            <button type="button" data-testid="scene-lab-tab-authored" className={styles.sceneLabChip} data-selected={activeTab === 'authored' ? 'true' : 'false'} onClick={() => onActiveTabChange('authored')}>Authored</button>
            <button type="button" data-testid="scene-lab-tab-members" className={styles.sceneLabChip} data-selected={activeTab === 'members' ? 'true' : 'false'} onClick={() => onActiveTabChange('members')}>Members</button>
          </div>
          <div className={styles.sceneLabSearchRow}>
            <input
              data-testid="scene-lab-search"
              className={styles.sceneLabInput}
              type="search"
              value={searchQuery}
              placeholder={`Search ${activeTab === 'members' ? 'members' : 'objects'}`}
              onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
              onKeyDown={handleBrowserKeyDown}
            />
          </div>
          <div className={styles.sceneLabVisibilityBox}>
            <div className={styles.sceneLabSectionTitle}>Overlay</div>
            <div className={styles.sceneLabVisibilityList}>
              {(Object.keys(OVERLAY_VISIBILITY_LABELS) as GhostlingSceneLabOverlayKey[]).map((key) => (
                <label key={key} className={styles.sceneLabToggle}>
                  <input
                    data-testid={`scene-lab-visibility-${key}`}
                    type="checkbox"
                    checked={overlayVisibility[key]}
                    onChange={() => toggleOverlayVisibility(key)}
                  />
                  <span>{OVERLAY_VISIBILITY_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.sceneLabObjectBrowser} data-testid="scene-lab-object-browser" tabIndex={0} onKeyDown={handleBrowserKeyDown}>
            {groupedItems.length > 0 ? groupedItems.map((group) => (
              <div key={group.group} className={styles.sceneLabObjectGroup}>
                <div className={styles.sceneLabObjectGroupTitle}>{group.group}</div>
                <div className={styles.sceneLabObjectList}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.sceneLabObjectItem}
                      data-selected={activeSelectionKey === item.id ? 'true' : 'false'}
                      onClick={() => onSelectionChange(item.selection)}
                    >
                      <span>{item.label}</span>
                      {item.meta ? <span className={styles.sceneLabObjectItemMeta}>{item.meta}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )) : (
              <div className={styles.sceneLabMeta}>No matching objects.</div>
            )}
          </div>
          <div className={styles.sceneLabSectionTitle}>Inspector</div>
          <div className={styles.sceneLabFields}>
            {selectedAnchor ? (
              <>
                <SelectionNumberField label="Anchor X" value={selectedAnchor.x} testId="scene-lab-anchor-x" onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => ({
                  ...current,
                  points: current.points.map((point) => (point.key === selectedAnchor.key ? { ...point, x: clamp(Math.round(value), 0, current.sourceWidth) } : point)),
                }), { history: 'none' })} />
                <SelectionNumberField label="Anchor Y" value={selectedAnchor.y} testId="scene-lab-anchor-y" onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => ({
                  ...current,
                  points: current.points.map((point) => (point.key === selectedAnchor.key ? { ...point, y: clamp(Math.round(value), 0, current.sourceHeight) } : point)),
                }), { history: 'none' })} />
              </>
            ) : null}
            {selection?.kind === 'fallback-anchor' ? (
              <>
                <SelectionNumberField label="Fallback X" value={worldDraft.fallbackAnchor.x} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => ({ ...current, fallbackAnchor: { ...current.fallbackAnchor, x: clamp(Math.round(value), 0, current.sourceWidth) } }), { history: 'none' })} />
                <SelectionNumberField label="Fallback Y" value={worldDraft.fallbackAnchor.y} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => ({ ...current, fallbackAnchor: { ...current.fallbackAnchor, y: clamp(Math.round(value), 0, current.sourceHeight) } }), { history: 'none' })} />
              </>
            ) : null}
            {selectedSafeZone ? (
              <>
                <SelectionNumberField label="Zone X" value={selectedSafeZone.bounds.x} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, x: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Zone Y" value={selectedSafeZone.bounds.y} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, y: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Zone Width" value={selectedSafeZone.bounds.width} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, width: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Zone Height" value={selectedSafeZone.bounds.height} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, height: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Roam Radius" value={selectedSafeZone.roamRadius} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => ({ ...current, safeZones: current.safeZones.map((safeZone) => (safeZone.key === selectedSafeZone.key ? { ...safeZone, roamRadius: Math.max(1, Math.round(value)) } : safeZone)) }), { history: 'none' })} />
              </>
            ) : null}
            {selectedGuideRect && selection?.kind === 'guide' ? (
              <>
                <SelectionNumberField label="Guide X" value={selectedGuideRect.x} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, x: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Guide Y" value={selectedGuideRect.y} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, y: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Guide Width" value={selectedGuideRect.width} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, width: value }, current)), { history: 'none' })} />
                <SelectionNumberField label="Guide Height" value={selectedGuideRect.height} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, height: value }, current)), { history: 'none' })} />
              </>
            ) : null}
            {selection?.kind === 'guide' && (selection.key === 'horizonY' || selection.key === 'floorY') ? (
              <SelectionNumberField label={`${selection.key} Y`} value={worldDraft.guides[selection.key]} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateWorldDraft((current) => {
                const nextY = clamp(Math.round(value), 0, current.sourceHeight);
                return {
                  ...current,
                  guides: { ...current.guides, [selection.key]: nextY },
                  horizonY: selection.key === 'horizonY' ? nextY : current.horizonY,
                  floorY: selection.key === 'floorY' ? nextY : current.floorY,
                };
              }, { history: 'none' })} />
            ) : null}
          </div>
          {selectedMember ? (
            <div className={styles.sceneLabDiagnostics} data-testid="scene-lab-member-diagnostics">
              <div>{selectedMember.displayName}</div>
              <div>{`point=${selectedMember.pointKey}`}</div>
              <div>{`zone=${selectedMember.safeZoneKey}`}</div>
              <div>{`phase=${selectedMember.movementPhase}`}</div>
              <div>{`speed=${Math.hypot(selectedMember.velocityX, selectedMember.velocityY).toFixed(2)}`}</div>
              <div>{`distance=${selectedMember.distanceToTarget.toFixed(1)}`}</div>
              <div>{`crowding=${selectedMember.crowding.toFixed(2)}`}</div>
            </div>
          ) : !selectedAnchor && !selectedSafeZone && !selectedGuideRect && selection?.kind !== 'fallback-anchor' ? (
            <div className={styles.sceneLabMeta}>Select an authored object or member to inspect it.</div>
          ) : null}
        </div>

        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabSectionTitle}>Movement</div>
          <div className={styles.sceneLabChipRow}>
            {TUNING_BUCKETS.map((nextBucket) => (
              <button key={nextBucket} type="button" className={styles.sceneLabChip} data-selected={tuningBucket === nextBucket ? 'true' : 'false'} onClick={() => setTuningBucket(nextBucket)}>{nextBucket}</button>
            ))}
          </div>
          <div className={styles.sceneLabFields}>
            <SelectionNumberField label="Max visible" value={bucketSettings.maxVisible} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], maxVisible: Math.max(1, Math.round(value)) } } }), { history: 'none' })} />
            <SelectionNumberField label="Speed min" value={bucketSettings.speedMin} testId="scene-lab-speed-min" onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], speedMin: Math.max(1, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Speed max" value={bucketSettings.speedMax} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], speedMax: Math.max(current.buckets[tuningBucket].speedMin, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Pause min" value={bucketSettings.pauseMinMs} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], pauseMinMs: Math.max(0, Math.round(value)) } } }), { history: 'none' })} />
            <SelectionNumberField label="Pause max" value={bucketSettings.pauseMaxMs} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], pauseMaxMs: Math.max(current.buckets[tuningBucket].pauseMinMs, Math.round(value)) } } }), { history: 'none' })} />
            <SelectionNumberField label="Arrival radius" value={bucketSettings.arrivalRadius} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], arrivalRadius: Math.max(1, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Settle radius" value={bucketSettings.settleRadius} step={0.1} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], settleRadius: Math.max(0.1, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Min gap" value={bucketSettings.minGap} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], minGap: Math.max(1, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Flip velocity" value={bucketSettings.facingFlipVelocity} step={0.01} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], facingFlipVelocity: Math.max(0.01, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Flip distance" value={bucketSettings.facingFlipDistance} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], facingFlipDistance: Math.max(1, value) } } }), { history: 'none' })} />
            <SelectionNumberField label="Breakout ms" value={tuningDraft.shared.jamBreakoutMs} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, shared: { ...current.shared, jamBreakoutMs: Math.max(100, Math.round(value)) } }), { history: 'none' })} />
            <SelectionNumberField label="Vertical factor" value={tuningDraft.shared.verticalTravelFactor} step={0.01} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, shared: { ...current.shared, verticalTravelFactor: clamp(value, 0.1, 2) } }), { history: 'none' })} />
            <SelectionNumberField label="Settle damping" value={tuningDraft.shared.settleDamping} step={0.1} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, shared: { ...current.shared, settleDamping: Math.max(0.1, value) } }), { history: 'none' })} />
            <SelectionNumberField label="Min travel ratio" value={tuningDraft.shared.minTargetTravelRatio} step={0.01} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, shared: { ...current.shared, minTargetTravelRatio: clamp(value, 0.1, 1.2) } }), { history: 'none' })} />
            <SelectionNumberField label="Anchor hop chance" value={tuningDraft.shared.anchorHopChance} testId="scene-lab-anchor-hop-chance" min={0} max={1} step={0.01} onFocus={onBeginHistoryCapture} onBlur={onCommitHistoryCapture} onChange={(value) => updateTuningDraft((current) => ({ ...current, shared: { ...current.shared, anchorHopChance: clamp(value, 0, 1) } }), { history: 'none' })} />
          </div>
        </div>

        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabSectionTitle}>Preview</div>
          <div className={styles.sceneLabChipRow}>
            <button type="button" className={styles.sceneLabChip} data-selected={previewMode === 'sandbox' ? 'true' : 'false'} onClick={() => onPreviewModeChange('sandbox')}>Sandbox</button>
            <button type="button" className={styles.sceneLabChip} data-selected={previewMode === 'live' ? 'true' : 'false'} onClick={() => onPreviewModeChange('live')}>Live</button>
          </div>
          <div className={styles.sceneLabFields}>
            <SelectionNumberField label="Ghost count" value={ghostCount} testId="scene-lab-ghost-count" min={1} max={ghostCountMax} onChange={(value) => onGhostCountChange(clamp(Math.round(value), 1, ghostCountMax))} />
          </div>
          <div className={styles.sceneLabButtonRow}>
            <button type="button" className={styles.sceneLabButton} onClick={() => onPlayingChange(!playing)}>{playing ? 'Pause' : 'Play'}</button>
            <button type="button" className={styles.sceneLabButton} onClick={onStep}>Step</button>
            <button type="button" className={styles.sceneLabButton} onClick={onReset}>Reset</button>
            {previewMode === 'live' ? <button type="button" className={styles.sceneLabButton} onClick={onRefreshLive}>Refresh live</button> : null}
          </div>
          <div className={styles.sceneLabMeta}>{`mode=${previewState.mode} bucket=${previewState.bucket} playing=${previewState.playing ? 'yes' : 'no'}`}</div>
        </div>

        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabSectionTitle}>Export</div>
          <div className={styles.sceneLabButtonRow}>
            <button type="button" className={styles.sceneLabButton} onClick={() => void copyExport(exportGhostlingWorldDraft(worldDraft), 'World draft')}>Copy world</button>
            <button type="button" className={styles.sceneLabButton} onClick={() => void copyExport(tuningDraft, 'Tuning draft')}>Copy tuning</button>
            <button type="button" className={styles.sceneLabButton} onClick={() => void copyExport(exportGhostlingSceneLabSession(worldDraft, tuningDraft, previewState), 'Session draft')}>Copy session</button>
          </div>
          <div className={styles.sceneLabButtonRow}>
            <button type="button" className={styles.sceneLabButton} onClick={() => downloadJson('shared-commons.world.draft.json', exportGhostlingWorldDraft(worldDraft))}>Download world</button>
            <button type="button" className={styles.sceneLabButton} onClick={() => downloadJson('ghostling-scene-tuning.draft.json', tuningDraft)}>Download tuning</button>
            <button type="button" className={styles.sceneLabButton} onClick={() => downloadJson('scene-lab-session.json', exportGhostlingSceneLabSession(worldDraft, tuningDraft, previewState))}>Download session</button>
          </div>
          <div className={styles.sceneLabMeta} data-testid="scene-lab-export-status">{exportStatus}</div>
        </div>
      </section>
    </>
  );
}
