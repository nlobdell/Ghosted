'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import {
  clampGhostlingWorldRect,
  exportGhostlingSceneLabSession,
  exportGhostlingWorldDraft,
  type GhostlingSceneLabPreviewMode,
  type GhostlingSceneLabPreviewState,
  type GhostlingSceneLabSelection,
} from '@/lib/ghostling-scene-lab';
import type { GhostlingSceneCameraMetrics } from '@/lib/ghostling-camera';
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
      originX: number;
      originY: number;
    }
  | {
      kind: 'guide-line';
      key: 'horizonY' | 'floorY';
      originY: number;
    }
  | {
      kind: 'rect';
      selection: RectSelectionKey;
      handle: DragHandle;
      originRect: GhostlingWorldRect;
    };

type GhostlingSceneLabProps = {
  worldDraft: GhostlingWorldSpec;
  setWorldDraft: Dispatch<SetStateAction<GhostlingWorldSpec>>;
  tuningDraft: GhostlingSceneTuningSpec;
  setTuningDraft: Dispatch<SetStateAction<GhostlingSceneTuningSpec>>;
  camera: GhostlingSceneCameraMetrics;
  bucket: GhostlingSceneDensityBucket;
  previewMode: GhostlingSceneLabPreviewMode;
  playing: boolean;
  ghostCount: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  min,
  max,
  step = 1,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
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
  setWorldDraft,
  tuningDraft,
  setTuningDraft,
  camera,
  bucket,
  previewMode,
  playing,
  ghostCount,
  memberDiagnostics,
  onPreviewModeChange,
  onPlayingChange,
  onGhostCountChange,
  onStep,
  onReset,
  onRefreshLive,
}: GhostlingSceneLabProps) {
  const [selection, setSelection] = useState<GhostlingSceneLabSelection | null>(null);
  const [tuningBucket, setTuningBucket] = useState<GhostlingSceneDensityBucket>(bucket);
  const [exportStatus, setExportStatus] = useState('');
  const dragRef = useRef<DragState | null>(null);

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

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = Math.round(event.movementX / Math.max(0.001, camera.scaleX));
      const dy = Math.round(event.movementY / Math.max(0.001, camera.scaleY));
      if (dx === 0 && dy === 0) return;

      if (drag.kind === 'anchor') {
        setWorldDraft((current) => {
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
        });
        return;
      }

      if (drag.kind === 'guide-line') {
        setWorldDraft((current) => {
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
        });
        return;
      }

      setWorldDraft((current) => {
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
      });
    };

    const onPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera.scaleX, camera.scaleY, setWorldDraft]);

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

      setWorldDraft((current) => {
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
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, setWorldDraft]);

  const beginAnchorDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    key: string,
    originX: number,
    originY: number,
    fallback = false,
  ) => {
    event.preventDefault();
    setSelection(fallback ? { kind: 'fallback-anchor' } : { kind: 'anchor', key });
    dragRef.current = {
      kind: 'anchor',
      key,
      fallback,
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
    setSelection({ kind: 'guide', key });
    dragRef.current = {
      kind: 'guide-line',
      key,
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
    setSelection(selectionKey);
    dragRef.current = {
      kind: 'rect',
      selection: selectionKey,
      handle,
      originRect: rect,
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
        aria-hidden="true"
        className={styles.sceneLabOverlay}
        viewBox={`0 0 ${worldDraft.sourceWidth} ${worldDraft.sourceHeight}`}
        preserveAspectRatio="xMidYMax meet"
        style={{
          left: '50%',
          top: `${camera.offsetY}px`,
          width: `${camera.renderWidth}px`,
          height: `${camera.renderHeight}px`,
          transform: 'translateX(-50%)',
        }}
      >
        {worldDraft.safeZones.map((safeZone) => {
          const selected = selection?.kind === 'safe-zone' && selection.key === safeZone.key;
          return (
            <g key={safeZone.key}>
              <rect
                x={safeZone.bounds.x}
                y={safeZone.bounds.y}
                width={safeZone.bounds.width}
                height={safeZone.bounds.height}
                className={styles.sceneLabRect}
                data-selected={selected ? 'true' : 'false'}
                onPointerDown={(event) => beginRectDrag(event, { kind: 'safe-zone', key: safeZone.key }, 'move', safeZone.bounds)}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const x = handle.includes('w') ? safeZone.bounds.x : safeZone.bounds.x + safeZone.bounds.width;
                const y = handle.includes('n') ? safeZone.bounds.y : safeZone.bounds.y + safeZone.bounds.height;
                return (
                  <rect
                    key={`${safeZone.key}:${handle}`}
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
        })}
        {GUIDE_RECT_KEYS.map((guideKey) => {
          const rect = worldDraft.guides[guideKey];
          if (!rect) return null;
          const selected = selection?.kind === 'guide' && selection.key === guideKey;
          return (
            <g key={guideKey}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                className={styles.sceneLabGuideRect}
                data-selected={selected ? 'true' : 'false'}
                onPointerDown={(event) => beginRectDrag(event, { kind: 'guide', key: guideKey }, 'move', rect)}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const x = handle.includes('w') ? rect.x : rect.x + rect.width;
                const y = handle.includes('n') ? rect.y : rect.y + rect.height;
                return (
                  <rect
                    key={`${guideKey}:${handle}`}
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
        })}
        <line
          x1="0"
          x2={worldDraft.sourceWidth}
          y1={worldDraft.guides.horizonY}
          y2={worldDraft.guides.horizonY}
          className={styles.sceneLabGuideLine}
          data-selected={selection?.kind === 'guide' && selection.key === 'horizonY' ? 'true' : 'false'}
          onPointerDown={(event) => beginGuideLineDrag(event, 'horizonY', worldDraft.guides.horizonY)}
        />
        <line
          x1="0"
          x2={worldDraft.sourceWidth}
          y1={worldDraft.guides.floorY}
          y2={worldDraft.guides.floorY}
          className={styles.sceneLabGuideLine}
          data-selected={selection?.kind === 'guide' && selection.key === 'floorY' ? 'true' : 'false'}
          onPointerDown={(event) => beginGuideLineDrag(event, 'floorY', worldDraft.guides.floorY)}
        />
        {worldDraft.points.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r="7"
            className={styles.sceneLabAnchor}
            data-selected={selection?.kind === 'anchor' && selection.key === point.key ? 'true' : 'false'}
            onPointerDown={(event) => beginAnchorDrag(event, point.key, point.x, point.y)}
          />
        ))}
        <circle
          cx={worldDraft.fallbackAnchor.x}
          cy={worldDraft.fallbackAnchor.y}
          r="8"
          className={styles.sceneLabFallbackAnchor}
          data-selected={selection?.kind === 'fallback-anchor' ? 'true' : 'false'}
          onPointerDown={(event) => beginAnchorDrag(event, worldDraft.fallbackAnchor.key, worldDraft.fallbackAnchor.x, worldDraft.fallbackAnchor.y, true)}
        />
        {memberDiagnostics.map((member) => (
          <g
            key={member.key}
            className={styles.sceneLabMemberMarker}
            onPointerDown={() => setSelection({ kind: 'member', key: member.key })}
          >
            <line x1={member.x} y1={member.y} x2={member.targetX} y2={member.targetY} />
            <circle cx={member.x} cy={member.y} r="5" data-selected={selection?.kind === 'member' && selection.key === member.key ? 'true' : 'false'} />
          </g>
        ))}
      </svg>

      <section className={styles.sceneLabPanel} data-testid="scene-lab-panel">
        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabSectionTitle}>World</div>
          <div className={styles.sceneLabChipRow}>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'fallback-anchor' })}>Fallback</button>
            {worldDraft.points.map((point) => (
              <button key={point.key} type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'anchor', key: point.key })}>{point.label}</button>
            ))}
            {worldDraft.safeZones.map((safeZone) => (
              <button key={safeZone.key} type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'safe-zone', key: safeZone.key })}>{safeZone.label}</button>
            ))}
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'safeArea' })}>Safe area</button>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'centerSafe' })}>Center safe</button>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'ultrawideBleed' })}>Bleed</button>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'labelSafeTop' })}>Label safe</button>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'horizonY' })}>Horizon</button>
            <button type="button" className={styles.sceneLabChip} onClick={() => setSelection({ kind: 'guide', key: 'floorY' })}>Floor line</button>
          </div>
          <div className={styles.sceneLabFields}>
            {selectedAnchor ? (
              <>
                <SelectionNumberField label="Anchor X" value={selectedAnchor.x} testId="scene-lab-anchor-x" onChange={(value) => setWorldDraft((current) => ({
                  ...current,
                  points: current.points.map((point) => (point.key === selectedAnchor.key ? { ...point, x: clamp(Math.round(value), 0, current.sourceWidth) } : point)),
                }))} />
                <SelectionNumberField label="Anchor Y" value={selectedAnchor.y} testId="scene-lab-anchor-y" onChange={(value) => setWorldDraft((current) => ({
                  ...current,
                  points: current.points.map((point) => (point.key === selectedAnchor.key ? { ...point, y: clamp(Math.round(value), 0, current.sourceHeight) } : point)),
                }))} />
              </>
            ) : null}
            {selection?.kind === 'fallback-anchor' ? (
              <>
                <SelectionNumberField label="Fallback X" value={worldDraft.fallbackAnchor.x} onChange={(value) => setWorldDraft((current) => ({ ...current, fallbackAnchor: { ...current.fallbackAnchor, x: clamp(Math.round(value), 0, current.sourceWidth) } }))} />
                <SelectionNumberField label="Fallback Y" value={worldDraft.fallbackAnchor.y} onChange={(value) => setWorldDraft((current) => ({ ...current, fallbackAnchor: { ...current.fallbackAnchor, y: clamp(Math.round(value), 0, current.sourceHeight) } }))} />
              </>
            ) : null}
            {selectedSafeZone ? (
              <>
                <SelectionNumberField label="Zone X" value={selectedSafeZone.bounds.x} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, x: value }, current)))} />
                <SelectionNumberField label="Zone Y" value={selectedSafeZone.bounds.y} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, y: value }, current)))} />
                <SelectionNumberField label="Zone Width" value={selectedSafeZone.bounds.width} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, width: value }, current)))} />
                <SelectionNumberField label="Zone Height" value={selectedSafeZone.bounds.height} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'safe-zone', key: selectedSafeZone.key }, clampGhostlingWorldRect({ ...selectedSafeZone.bounds, height: value }, current)))} />
                <SelectionNumberField label="Roam Radius" value={selectedSafeZone.roamRadius} onChange={(value) => setWorldDraft((current) => ({ ...current, safeZones: current.safeZones.map((safeZone) => (safeZone.key === selectedSafeZone.key ? { ...safeZone, roamRadius: Math.max(1, Math.round(value)) } : safeZone)) }))} />
              </>
            ) : null}
            {selectedGuideRect && selection?.kind === 'guide' ? (
              <>
                <SelectionNumberField label="Guide X" value={selectedGuideRect.x} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, x: value }, current)))} />
                <SelectionNumberField label="Guide Y" value={selectedGuideRect.y} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, y: value }, current)))} />
                <SelectionNumberField label="Guide Width" value={selectedGuideRect.width} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, width: value }, current)))} />
                <SelectionNumberField label="Guide Height" value={selectedGuideRect.height} onChange={(value) => setWorldDraft((current) => applyRectSelectionUpdate(current, { kind: 'guide', key: selection.key }, clampGhostlingWorldRect({ ...selectedGuideRect, height: value }, current)))} />
              </>
            ) : null}
            {selection?.kind === 'guide' && (selection.key === 'horizonY' || selection.key === 'floorY') ? (
              <SelectionNumberField label={`${selection.key} Y`} value={worldDraft.guides[selection.key]} onChange={(value) => setWorldDraft((current) => {
                const nextY = clamp(Math.round(value), 0, current.sourceHeight);
                return {
                  ...current,
                  guides: { ...current.guides, [selection.key]: nextY },
                  horizonY: selection.key === 'horizonY' ? nextY : current.horizonY,
                  floorY: selection.key === 'floorY' ? nextY : current.floorY,
                };
              })} />
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
            <SelectionNumberField label="Max visible" value={bucketSettings.maxVisible} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], maxVisible: Math.max(1, Math.round(value)) } } }))} />
            <SelectionNumberField label="Speed min" value={bucketSettings.speedMin} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], speedMin: Math.max(1, value) } } }))} />
            <SelectionNumberField label="Speed max" value={bucketSettings.speedMax} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], speedMax: Math.max(current.buckets[tuningBucket].speedMin, value) } } }))} />
            <SelectionNumberField label="Pause min" value={bucketSettings.pauseMinMs} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], pauseMinMs: Math.max(0, Math.round(value)) } } }))} />
            <SelectionNumberField label="Pause max" value={bucketSettings.pauseMaxMs} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], pauseMaxMs: Math.max(current.buckets[tuningBucket].pauseMinMs, Math.round(value)) } } }))} />
            <SelectionNumberField label="Arrival radius" value={bucketSettings.arrivalRadius} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], arrivalRadius: Math.max(1, value) } } }))} />
            <SelectionNumberField label="Settle radius" value={bucketSettings.settleRadius} step={0.1} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], settleRadius: Math.max(0.1, value) } } }))} />
            <SelectionNumberField label="Min gap" value={bucketSettings.minGap} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], minGap: Math.max(1, value) } } }))} />
            <SelectionNumberField label="Flip velocity" value={bucketSettings.facingFlipVelocity} step={0.01} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], facingFlipVelocity: Math.max(0.01, value) } } }))} />
            <SelectionNumberField label="Flip distance" value={bucketSettings.facingFlipDistance} onChange={(value) => setTuningDraft((current) => ({ ...current, buckets: { ...current.buckets, [tuningBucket]: { ...current.buckets[tuningBucket], facingFlipDistance: Math.max(1, value) } } }))} />
            <SelectionNumberField label="Breakout ms" value={tuningDraft.shared.jamBreakoutMs} onChange={(value) => setTuningDraft((current) => ({ ...current, shared: { ...current.shared, jamBreakoutMs: Math.max(100, Math.round(value)) } }))} />
            <SelectionNumberField label="Vertical factor" value={tuningDraft.shared.verticalTravelFactor} step={0.01} onChange={(value) => setTuningDraft((current) => ({ ...current, shared: { ...current.shared, verticalTravelFactor: clamp(value, 0.1, 2) } }))} />
            <SelectionNumberField label="Settle damping" value={tuningDraft.shared.settleDamping} step={0.1} onChange={(value) => setTuningDraft((current) => ({ ...current, shared: { ...current.shared, settleDamping: Math.max(0.1, value) } }))} />
            <SelectionNumberField label="Min travel ratio" value={tuningDraft.shared.minTargetTravelRatio} step={0.01} onChange={(value) => setTuningDraft((current) => ({ ...current, shared: { ...current.shared, minTargetTravelRatio: clamp(value, 0.1, 1.2) } }))} />
          </div>
        </div>

        <div className={styles.sceneLabSection}>
          <div className={styles.sceneLabSectionTitle}>Preview</div>
          <div className={styles.sceneLabChipRow}>
            <button type="button" className={styles.sceneLabChip} data-selected={previewMode === 'sandbox' ? 'true' : 'false'} onClick={() => onPreviewModeChange('sandbox')}>Sandbox</button>
            <button type="button" className={styles.sceneLabChip} data-selected={previewMode === 'live' ? 'true' : 'false'} onClick={() => onPreviewModeChange('live')}>Live</button>
          </div>
          <div className={styles.sceneLabFields}>
            <SelectionNumberField label="Ghost count" value={ghostCount} min={1} max={8} onChange={(value) => onGhostCountChange(clamp(Math.round(value), 1, 8))} />
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
