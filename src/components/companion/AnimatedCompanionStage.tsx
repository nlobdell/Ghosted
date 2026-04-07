'use client';

/* eslint-disable @next/next/no-img-element -- Companion animation falls back to runtime image URLs from the app server. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompanionMotionChannel,
  CompanionMotionWave,
  CompanionRenderLayer,
  CompanionRenderManifest,
  CompanionRenderSlice,
} from '@/lib/types';

type AnimatedCompanionStageProps = {
  manifest?: CompanionRenderManifest | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
  targetSize?: number;
};

type StageOffset = {
  x: number;
  y: number;
};

type StagePiece = {
  key: string;
  src: string;
  zIndex: number;
  motionGroup?: string | null;
  animation: CompanionRenderLayer['animation'];
  slice?: CompanionRenderSlice;
};

const SHADOW_WIDTH_RATIO = 17 / 32;
const SHADOW_HEIGHT_RATIO = 4.8 / 32;
const SHADOW_LEFT_RATIO = 7.5 / 32;
const SHADOW_TOP_RATIO = 26.6 / 32;
const SHADOW_MIN_SCALE_X = 7.9 / 8.5;
const DEFAULT_LOGICAL_STAGE_SIZE = 32;

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
    return frames[0];
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
  return frames[frames.length - 1];
}

function resolveAxisOffset(wave: CompanionMotionWave | undefined, elapsedMs: number, reducedMotion: boolean) {
  if (reducedMotion || !wave || wave.amplitude === 0 || wave.durationMs <= 0) return 0;
  const phase = (wave.phase ?? 0) * Math.PI * 2;
  return Math.sin((elapsedMs / wave.durationMs) * Math.PI * 2 + phase) * wave.amplitude;
}

function resolveChannelOffset(channel: CompanionMotionChannel | undefined, elapsedMs: number, reducedMotion: boolean): StageOffset {
  return {
    x: resolveAxisOffset(channel?.offsetX, elapsedMs, reducedMotion),
    y: resolveAxisOffset(channel?.offsetY, elapsedMs, reducedMotion),
  };
}

function addOffsets(...offsets: Array<StageOffset | undefined>): StageOffset {
  return offsets.reduce<StageOffset>(
    (sum, offset) => ({
      x: sum.x + (offset?.x ?? 0),
      y: sum.y + (offset?.y ?? 0),
    }),
    { x: 0, y: 0 },
  );
}

export function AnimatedCompanionStage({
  manifest,
  fallbackSrc,
  alt,
  className,
  targetSize = 224,
}: AnimatedCompanionStageProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pieceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shadowRef = useRef<HTMLDivElement | null>(null);

  const logicalWidth = Math.max(1, manifest?.width || DEFAULT_LOGICAL_STAGE_SIZE);
  const logicalHeight = Math.max(1, manifest?.height || DEFAULT_LOGICAL_STAGE_SIZE);
  // Treat targetSize as the desired stage width and keep the sprite on an
  // integer scale so the live preview stays crisp even when accessories make
  // the stage taller than it is wide.
  const stageScale = Math.max(1, Math.floor(targetSize / logicalWidth) || 1);
  const stageWidth = logicalWidth * stageScale;
  const stageHeight = logicalHeight * stageScale;

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
            motionGroup: slice.motionGroup ?? layer.motionGroup,
            animation: layer.animation,
            slice,
          }));
        }
        return [{
          key: layer.key,
          src: layer.src,
          zIndex: layer.zIndex,
          motionGroup: layer.motionGroup,
          animation: layer.animation,
        }];
      }),
    [manifest],
  );

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
    if (!manifest || !pieces.length) return undefined;

    let frameId = 0;
    const startTime = performance.now();
    const rootKey = manifest.motion.rootGroup || 'root';

    const render = (timestamp: number) => {
      const elapsedMs = timestamp - startTime;
      const rootOffset = resolveChannelOffset(manifest.motion.channels?.[rootKey], elapsedMs, prefersReducedMotion);
      const bodyLocal = resolveChannelOffset(manifest.motion.channels?.body, elapsedMs, prefersReducedMotion);
      const headLocal = resolveChannelOffset(manifest.motion.channels?.head, elapsedMs, prefersReducedMotion);
      const bodyOffset = addOffsets(rootOffset, bodyLocal);
      const headOffset = addOffsets(bodyOffset, headLocal);

      const resolveGroupOffset = (group: string | null | undefined) => {
        if (!group || group === rootKey || group === 'root') return rootOffset;
        if (group === 'body') return bodyOffset;
        if (group === 'head') return headOffset;
        return addOffsets(rootOffset, resolveChannelOffset(manifest.motion.channels?.[group], elapsedMs, prefersReducedMotion));
      };

      if (shadowRef.current) {
        const shadowDurationMs = Math.max(1, Math.trunc(manifest.motion.channels?.body?.offsetY?.durationMs ?? 2860));
        const shadowProgress = prefersReducedMotion ? 1 : (Math.cos((elapsedMs / shadowDurationMs) * Math.PI * 2) + 1) / 2;
        const shadowScaleX = SHADOW_MIN_SCALE_X + ((1 - SHADOW_MIN_SCALE_X) * shadowProgress);
        const shadowOpacityLow = (manifest.motion.shadowOpacity ?? 0.2) + 0.02;
        const shadowOpacityHigh = (manifest.motion.shadowOpacity ?? 0.2) + 0.12;
        const shadowOpacity = shadowOpacityLow + ((shadowOpacityHigh - shadowOpacityLow) * shadowProgress);
        shadowRef.current.style.transform = `scaleX(${shadowScaleX.toFixed(4)})`;
        shadowRef.current.style.opacity = shadowOpacity.toFixed(3);
      }

      pieces.forEach((piece) => {
        const node = pieceRefs.current[piece.key];
        if (!node) return;

        const frame = currentFrame(piece, elapsedMs, prefersReducedMotion);
        const offset = resolveGroupOffset(piece.motionGroup);
        const sourceWidth = Math.max(1, frame.sourceWidth ?? frame.width);
        const sourceHeight = Math.max(1, frame.sourceHeight ?? frame.height);
        const sheetWidth = Math.max(sourceWidth, piece.animation.sheetWidth ?? sourceWidth);
        const sheetHeight = Math.max(sourceHeight, piece.animation.sheetHeight ?? sourceHeight);

        let left = 0;
        let top = 0;
        let width = logicalWidth;
        let height = logicalHeight;
        let backgroundScaleX = logicalWidth / sourceWidth;
        let backgroundScaleY = logicalHeight / sourceHeight;
        let backgroundPositionX = (-frame.x + (frame.offsetX ?? 0)) * backgroundScaleX;
        let backgroundPositionY = (-frame.y + (frame.offsetY ?? 0)) * backgroundScaleY;

        if (piece.slice) {
          left = piece.slice.targetX;
          top = piece.slice.targetY;
          width = piece.slice.targetWidth;
          height = piece.slice.targetHeight;
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

        node.style.left = `${roundPx(left * stageScale)}px`;
        node.style.top = `${roundPx(top * stageScale)}px`;
        node.style.width = `${roundPx(width * stageScale)}px`;
        node.style.height = `${roundPx(height * stageScale)}px`;
        node.style.transform = `translate3d(${roundPx(offset.x * stageScale)}px, ${roundPx(offset.y * stageScale)}px, 0)`;
        node.style.backgroundPosition = `${roundPx(backgroundPositionX * stageScale)}px ${roundPx(backgroundPositionY * stageScale)}px`;
        node.style.backgroundSize = `${roundPx(sheetWidth * backgroundScaleX * stageScale)}px ${roundPx(sheetHeight * backgroundScaleY * stageScale)}px`;
      });

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [logicalHeight, logicalWidth, manifest, pieces, prefersReducedMotion, stageScale]);

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
            left: `${logicalWidth * stageScale * SHADOW_LEFT_RATIO}px`,
            top: `${logicalHeight * stageScale * SHADOW_TOP_RATIO}px`,
            width: `${logicalWidth * stageScale * SHADOW_WIDTH_RATIO}px`,
            height: `${logicalHeight * stageScale * SHADOW_HEIGHT_RATIO}px`,
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
              willChange: 'transform, background-position',
            }}
          />
        ))}
      </div>
    </div>
  );
}
