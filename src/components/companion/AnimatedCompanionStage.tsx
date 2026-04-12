'use client';

/* eslint-disable @next/next/no-img-element -- Companion animation falls back to runtime image URLs from the app server. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  accentMotionForGroup,
  buildAccentSchedule,
  composeMotionMatrix,
  evaluateMotionChannel,
  multiplyMatrix,
  matrixForElement,
  matrixToCss,
  mergeMotionVectors,
  motionGroupChain,
  resolveStageShadowRect,
  stagePresentationMultiplier,
  unionRects,
  type CompanionMotionAccentEvent,
  type Matrix2D,
  type StagePresentation,
} from '@/lib/companion-motion';
import type {
  CompanionRenderLayer,
  CompanionRenderManifest,
  CompanionRenderRect,
  CompanionRenderSlice,
} from '@/lib/types';

type AnimatedCompanionStageProps = {
  manifest?: CompanionRenderManifest | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
  targetSize?: number;
  presentation?: StagePresentation;
  seedKey?: string;
  showDebugOverlay?: boolean;
};

type StagePiece = {
  key: string;
  src: string;
  zIndex: number;
  role: string;
  motionGroup: string;
  animation: CompanionRenderLayer['animation'];
  slice?: CompanionRenderSlice;
  baseRect: CompanionRenderRect;
};

const SHADOW_MIN_SCALE_X = 7.9 / 8.5;
const DEFAULT_LOGICAL_STAGE_SIZE = 32;
const ACCENT_LOOKAHEAD_MS = 180_000;

function roundPx(value: number) {
  return Math.round(value);
}

function currentFrame(layer: StagePiece, elapsedMs: number, reducedMotion: boolean) {
  const frames = layer.animation.frames?.length
    ? layer.animation.frames
    : Array.from({ length: Math.max(1, layer.animation.frameCount) }, (_, index) => ({
      x: index * layer.animation.frameWidth,
      y: 0,
      width: layer.animation.frameWidth,
      height: layer.animation.frameHeight,
      durationMs: layer.animation.fps > 0 ? Math.round(1000 / layer.animation.fps) : 1000,
      offsetX: 0,
      offsetY: 0,
      sourceWidth: layer.animation.frameWidth,
      sourceHeight: layer.animation.frameHeight,
    }));

  if (reducedMotion || layer.animation.mode !== 'spritesheet' || frames.length <= 1) {
    return frames[0]!;
  }

  const totalDuration = frames.reduce((sum, frame) => sum + Math.max(1, frame.durationMs), 0);
  const playbackTime = layer.animation.loop
    ? elapsedMs % totalDuration
    : Math.min(elapsedMs, Math.max(0, totalDuration - 1));

  let cursor = playbackTime;
  for (const frame of frames) {
    cursor -= Math.max(1, frame.durationMs);
    if (cursor < 0) return frame;
  }
  return frames[frames.length - 1]!;
}

function rectCenter(rect: CompanionRenderRect) {
  return {
    x: rect.x + (rect.width / 2),
    y: rect.y + (rect.height / 2),
  };
}

function resolvePieceBaseRect(
  layer: CompanionRenderLayer,
  slice: CompanionRenderSlice | undefined,
  logicalWidth: number,
  logicalHeight: number,
) {
  if (slice) {
    return {
      x: slice.targetX,
      y: slice.targetY,
      width: slice.targetWidth,
      height: slice.targetHeight,
    } satisfies CompanionRenderRect;
  }

  return {
    x: 0,
    y: 0,
    width: logicalWidth,
    height: logicalHeight,
  } satisfies CompanionRenderRect;
}

export function AnimatedCompanionStage({
  manifest,
  fallbackSrc,
  alt,
  className,
  targetSize = 224,
  presentation = 'ambient',
  seedKey,
  showDebugOverlay = false,
}: AnimatedCompanionStageProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isInView, setIsInView] = useState(true);
  const pieceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const visibilityRef = useRef(true);
  const lastTimestampRef = useRef(0);
  const activeElapsedRef = useRef(0);
  const accentEventsRef = useRef<CompanionMotionAccentEvent[]>([]);
  const accentHorizonRef = useRef(0);

  const logicalWidth = Math.max(1, manifest?.width || DEFAULT_LOGICAL_STAGE_SIZE);
  const logicalHeight = Math.max(1, manifest?.height || DEFAULT_LOGICAL_STAGE_SIZE);
  const stageScale = Math.max(1, Math.floor(targetSize / logicalWidth) || 1);
  const stageWidth = logicalWidth * stageScale;
  const stageHeight = logicalHeight * stageScale;
  const rootKey = manifest?.motion.rootGroup || 'root';
  const presentationMultiplier = stagePresentationMultiplier(presentation);
  const stableSeedKey = seedKey || `${presentation}:${alt}`;

  const pieces = useMemo<StagePiece[]>(
    () => (manifest?.layers ?? [])
      .slice()
      .sort((left, right) => left.zIndex - right.zIndex)
      .flatMap((layer) => {
        if (layer.slices?.length) {
          return layer.slices.map((slice, index) => ({
            key: `${layer.key}:${slice.key || index}`,
            src: layer.src,
            zIndex: layer.zIndex,
            role: layer.role,
            motionGroup: String(slice.motionGroup ?? layer.motionGroup ?? rootKey),
            animation: layer.animation,
            slice,
            baseRect: resolvePieceBaseRect(layer, slice, logicalWidth, logicalHeight),
          }));
        }

        return [{
          key: layer.key,
          src: layer.src,
          zIndex: layer.zIndex,
          role: layer.role,
          motionGroup: String(layer.motionGroup ?? rootKey),
          animation: layer.animation,
          baseRect: resolvePieceBaseRect(layer, undefined, logicalWidth, logicalHeight),
        }];
      }),
    [logicalHeight, logicalWidth, manifest, rootKey],
  );

  const groupBounds = useMemo(() => {
    const allRects = pieces.map((piece) => piece.baseRect);
    const bodyRects = pieces
      .filter((piece) => ['body', 'head'].includes(piece.motionGroup))
      .map((piece) => piece.baseRect);
    const headRects = pieces
      .filter((piece) => piece.motionGroup === 'head')
      .map((piece) => piece.baseRect);
    const bounds: Record<string, CompanionRenderRect> = {};

    const rootBounds = unionRects(allRects);
    if (rootBounds) bounds[rootKey] = rootBounds;

    const resolvedBodyBounds = unionRects(bodyRects);
    if (resolvedBodyBounds) bounds.body = resolvedBodyBounds;

    const resolvedHeadBounds = unionRects(headRects);
    if (resolvedHeadBounds) bounds.head = resolvedHeadBounds;

    const customGroups = new Set(
      pieces
        .map((piece) => piece.motionGroup)
        .filter((group) => ![rootKey, 'root', 'body', 'head'].includes(group)),
    );
    for (const group of customGroups) {
      const rect = unionRects(
        pieces
          .filter((piece) => piece.motionGroup === group)
          .map((piece) => piece.baseRect),
      );
      if (rect) bounds[group] = rect;
    }

    return bounds;
  }, [pieces, rootKey]);

  const debugShadowRect = manifest?.debug?.shadowRect ?? resolveStageShadowRect(logicalWidth, logicalHeight);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQuery.addListener?.(sync);
    return () => legacyMediaQuery.removeListener?.(sync);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncVisibility = () => {
      visibilityRef.current = document.visibilityState !== 'hidden';
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !stageRef.current || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.12 },
    );

    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!manifest || !pieces.length) return undefined;

    let frameId = 0;
    lastTimestampRef.current = 0;
    activeElapsedRef.current = 0;
    accentHorizonRef.current = ACCENT_LOOKAHEAD_MS;
    accentEventsRef.current = buildAccentSchedule(manifest.motion.accents, stableSeedKey, accentHorizonRef.current);

    const render = (timestamp: number) => {
      const shouldPause = prefersReducedMotion || !isInView || !visibilityRef.current;
      const lastTimestamp = lastTimestampRef.current;
      const deltaMs = lastTimestamp > 0 ? Math.min(timestamp - lastTimestamp, 100) : 16;
      lastTimestampRef.current = timestamp;

      if (!shouldPause) {
        activeElapsedRef.current += deltaMs;
      }

      const elapsedMs = activeElapsedRef.current;
      const motionMultiplier = prefersReducedMotion ? 0 : presentationMultiplier;
      if (elapsedMs + ACCENT_LOOKAHEAD_MS > accentHorizonRef.current) {
        accentHorizonRef.current = elapsedMs + ACCENT_LOOKAHEAD_MS;
        accentEventsRef.current = buildAccentSchedule(manifest.motion.accents, stableSeedKey, accentHorizonRef.current);
      }

      const groupMatrices: Record<string, Matrix2D> = {};
      const rootBounds = groupBounds[rootKey] ?? groupBounds.root ?? {
        x: 0,
        y: 0,
        width: logicalWidth,
        height: logicalHeight,
      };
      const rootPivot = rectCenter(rootBounds);
      const rootMotion = mergeMotionVectors(
        evaluateMotionChannel(manifest.motion.channels?.[rootKey], elapsedMs, { multiplier: motionMultiplier }),
        accentMotionForGroup(accentEventsRef.current, rootKey, elapsedMs, motionMultiplier),
      );
      const rootMatrix = composeMotionMatrix(
        {
          ...rootMotion,
          translateX: rootMotion.translateX * stageScale,
          translateY: rootMotion.translateY * stageScale,
        },
        {
          x: rootPivot.x * stageScale,
          y: rootPivot.y * stageScale,
        },
      );
      groupMatrices[rootKey] = rootMatrix;

      const resolvedBodyBounds = groupBounds.body;
      const bodyLocalMotion = mergeMotionVectors(
        evaluateMotionChannel(manifest.motion.channels?.body, elapsedMs, { multiplier: motionMultiplier }),
        accentMotionForGroup(accentEventsRef.current, 'body', elapsedMs, motionMultiplier),
      );
      const bodyMatrix = resolvedBodyBounds
        ? multiplyMatrix(rootMatrix, composeMotionMatrix(
          {
            ...bodyLocalMotion,
            translateX: bodyLocalMotion.translateX * stageScale,
            translateY: bodyLocalMotion.translateY * stageScale,
          },
          {
            x: rectCenter(resolvedBodyBounds).x * stageScale,
            y: rectCenter(resolvedBodyBounds).y * stageScale,
          },
        ))
        : rootMatrix;

      const resolvedHeadBounds = groupBounds.head;
      const headLocalMotion = mergeMotionVectors(
        evaluateMotionChannel(manifest.motion.channels?.head, elapsedMs, { multiplier: motionMultiplier }),
        accentMotionForGroup(accentEventsRef.current, 'head', elapsedMs, motionMultiplier),
      );
      const headMatrix = resolvedHeadBounds
        ? multiplyMatrix(bodyMatrix, composeMotionMatrix(
          {
            ...headLocalMotion,
            translateX: headLocalMotion.translateX * stageScale,
            translateY: headLocalMotion.translateY * stageScale,
          },
          {
            x: rectCenter(resolvedHeadBounds).x * stageScale,
            y: rectCenter(resolvedHeadBounds).y * stageScale,
          },
        ))
        : bodyMatrix;

      if (shadowRef.current) {
        const shadowDurationMs = Math.max(1, Math.trunc(manifest.motion.channels?.body?.offsetY?.durationMs ?? 2860));
        const shadowProgress = prefersReducedMotion ? 1 : (Math.cos((elapsedMs / shadowDurationMs) * Math.PI * 2) + 1) / 2;
        const bodyScaleBoost = Math.max(0, bodyLocalMotion.scaleX - 1);
        const shadowScaleX = SHADOW_MIN_SCALE_X + ((1 - SHADOW_MIN_SCALE_X) * shadowProgress) + (bodyScaleBoost * 0.35);
        const shadowOpacityLow = (manifest.motion.shadowOpacity ?? 0.2) + 0.02;
        const shadowOpacityHigh = (manifest.motion.shadowOpacity ?? 0.2) + 0.12;
        const shadowOpacity = shadowOpacityLow + ((shadowOpacityHigh - shadowOpacityLow) * shadowProgress);
        shadowRef.current.style.transform = `scaleX(${shadowScaleX.toFixed(4)})`;
        shadowRef.current.style.opacity = shadowOpacity.toFixed(3);
      }

      const otherGroups = new Set(
        pieces
          .map((piece) => piece.motionGroup)
          .filter((group) => ![rootKey, 'root', 'body', 'head'].includes(group)),
      );
      for (const groupKey of otherGroups) {
        const bounds = groupBounds[groupKey] ?? rootBounds;
        const groupMotion = mergeMotionVectors(
          evaluateMotionChannel(manifest.motion.channels?.[groupKey], elapsedMs, { multiplier: motionMultiplier }),
          accentMotionForGroup(accentEventsRef.current, groupKey, elapsedMs, motionMultiplier),
        );
        const matrix = multiplyMatrix(rootMatrix, composeMotionMatrix(
          {
            ...groupMotion,
            translateX: groupMotion.translateX * stageScale,
            translateY: groupMotion.translateY * stageScale,
          },
          {
            x: rectCenter(bounds).x * stageScale,
            y: rectCenter(bounds).y * stageScale,
          },
        ));
        groupMatrices[groupKey] = matrix;
      }

      pieces.forEach((piece) => {
        const node = pieceRefs.current[piece.key];
        if (!node) return;

        const frame = currentFrame(piece, elapsedMs, prefersReducedMotion);
        const sourceWidth = Math.max(1, frame.sourceWidth ?? frame.width);
        const sourceHeight = Math.max(1, frame.sourceHeight ?? frame.height);
        const sheetWidth = Math.max(sourceWidth, piece.animation.sheetWidth ?? sourceWidth);
        const sheetHeight = Math.max(sourceHeight, piece.animation.sheetHeight ?? sourceHeight);

        let left = piece.baseRect.x;
        let top = piece.baseRect.y;
        let width = piece.baseRect.width;
        let height = piece.baseRect.height;
        let backgroundScaleX = width / sourceWidth;
        let backgroundScaleY = height / sourceHeight;
        let backgroundPositionX = (-frame.x + (frame.offsetX ?? 0)) * backgroundScaleX;
        let backgroundPositionY = (-frame.y + (frame.offsetY ?? 0)) * backgroundScaleY;

        if (piece.slice) {
          backgroundScaleX = width / Math.max(1, piece.slice.sourceWidth);
          backgroundScaleY = height / Math.max(1, piece.slice.sourceHeight);
          backgroundPositionX = -(frame.x + piece.slice.sourceX) * backgroundScaleX;
          backgroundPositionY = -(frame.y + piece.slice.sourceY) * backgroundScaleY;
        } else {
          left = (frame.offsetX ?? 0) * backgroundScaleX;
          top = (frame.offsetY ?? 0) * backgroundScaleY;
          width = sourceWidth * backgroundScaleX;
          height = sourceHeight * backgroundScaleY;
        }

        const leftPx = roundPx(left * stageScale);
        const topPx = roundPx(top * stageScale);
        const widthPx = roundPx(width * stageScale);
        const heightPx = roundPx(height * stageScale);
        const chain = motionGroupChain(piece.motionGroup, rootKey);
        let composedGlobalMatrix = rootMatrix;
        if (chain.includes('body')) {
          composedGlobalMatrix = bodyMatrix;
        }
        if (chain.includes('head')) {
          composedGlobalMatrix = headMatrix;
        }
        const customGroup = chain.find((groupKey) => ![rootKey, 'root', 'body', 'head'].includes(groupKey));
        if (customGroup && groupMatrices[customGroup]) {
          composedGlobalMatrix = groupMatrices[customGroup]!;
        }
        const composedLocalMatrix = matrixForElement(composedGlobalMatrix, leftPx, topPx);

        node.style.left = `${leftPx}px`;
        node.style.top = `${topPx}px`;
        node.style.width = `${widthPx}px`;
        node.style.height = `${heightPx}px`;
        node.style.transform = matrixToCss(composedLocalMatrix);
        node.style.backgroundPosition = `${roundPx(backgroundPositionX * stageScale)}px ${roundPx(backgroundPositionY * stageScale)}px`;
        node.style.backgroundSize = `${roundPx(sheetWidth * backgroundScaleX * stageScale)}px ${roundPx(sheetHeight * backgroundScaleY * stageScale)}px`;
      });

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    groupBounds,
    isInView,
    logicalHeight,
    logicalWidth,
    manifest,
    pieces,
    prefersReducedMotion,
    presentationMultiplier,
    rootKey,
    stableSeedKey,
    stageScale,
  ]);

  if (!manifest || !pieces.length) {
    return (
      <div
        className={className}
        style={{
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        <img
          src={fallbackSrc}
          alt={alt}
          style={{ width: `${stageWidth}px`, height: `${stageHeight}px`, display: 'block', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className={className}
      style={{
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
        display: 'grid',
        placeItems: 'center',
        overflow: 'visible',
        flex: '0 0 auto',
      }}
    >
      <div
        role="img"
        aria-label={alt}
        style={{
          position: 'relative',
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          overflow: 'visible',
        }}
      >
        <div
          ref={shadowRef}
          style={{
            position: 'absolute',
            left: `${debugShadowRect.x * stageScale}px`,
            top: `${debugShadowRect.y * stageScale}px`,
            width: `${debugShadowRect.width * stageScale}px`,
            height: `${debugShadowRect.height * stageScale}px`,
            borderRadius: '999px',
            background: 'rgba(9, 8, 17, 0.2)',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
          }}
        />
        {pieces.map((piece) => (
          <div
            key={piece.key}
            ref={(node) => {
              pieceRefs.current[piece.key] = node;
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: piece.zIndex,
              backgroundImage: `url("${piece.src}")`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              transformOrigin: '0 0',
              willChange: 'transform, background-position',
            }}
          />
        ))}
        {showDebugOverlay ? (
          <svg
            aria-hidden="true"
            width={stageWidth}
            height={stageHeight}
            viewBox={`0 0 ${logicalWidth} ${logicalHeight}`}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 999,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <rect
              x={debugShadowRect.x}
              y={debugShadowRect.y}
              width={debugShadowRect.width}
              height={debugShadowRect.height}
              rx={debugShadowRect.height / 2}
              fill="none"
              stroke="rgba(244, 212, 113, 0.9)"
              strokeDasharray="1.6 1.2"
              strokeWidth="0.45"
            />
            {pieces.map((piece) => (
              <g key={`debug:${piece.key}`}>
                <rect
                  x={piece.baseRect.x}
                  y={piece.baseRect.y}
                  width={piece.baseRect.width}
                  height={piece.baseRect.height}
                  fill="none"
                  stroke="rgba(123, 214, 255, 0.92)"
                  strokeWidth="0.42"
                />
                <text
                  x={piece.baseRect.x}
                  y={Math.max(1, piece.baseRect.y - 0.8)}
                  fill="#f6fbff"
                  fontSize="2.4"
                  fontFamily="monospace"
                >
                  {`${piece.role} [${piece.motionGroup}]`}
                </text>
              </g>
            ))}
            {Object.entries(manifest.debug?.slotAnchors ?? {}).map(([slotKey, point]) => (
              point ? (
                <g key={`anchor:${slotKey}`}>
                  <circle cx={point.x} cy={point.y} r="0.9" fill="#ff8ca8" />
                  <circle cx={point.x} cy={point.y} r="2.2" fill="none" stroke="#ff8ca8" strokeWidth="0.32" />
                  <text x={point.x + 1.6} y={point.y - 1.2} fill="#ffe4ec" fontSize="2.5" fontFamily="monospace">
                    {slotKey}
                  </text>
                </g>
              ) : null
            ))}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
