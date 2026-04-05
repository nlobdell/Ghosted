'use client';

/* eslint-disable @next/next/no-img-element -- Companion animation falls back to runtime image URLs from the app server. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompanionAnimationFrame,
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
}: AnimatedCompanionStageProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pieceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shadowRef = useRef<HTMLDivElement | null>(null);

  const logicalWidth = Math.max(1, manifest?.width || 32);
  const logicalHeight = Math.max(1, manifest?.height || 32);
  const stageScale = logicalWidth >= 210 || logicalHeight >= 210 ? 1 : 3;
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
      const bodyOffset = addOffsets(rootOffset, resolveChannelOffset(manifest.motion.channels?.body, elapsedMs, prefersReducedMotion));
      const headOffset = addOffsets(rootOffset, resolveChannelOffset(manifest.motion.channels?.head, elapsedMs, prefersReducedMotion));

      const resolveGroupOffset = (group: string | null | undefined) => {
        if (!group || group === rootKey) return rootOffset;
        if (group === 'body') return bodyOffset;
        if (group === 'head') return headOffset;
        return addOffsets(rootOffset, resolveChannelOffset(manifest.motion.channels?.[group], elapsedMs, prefersReducedMotion));
      };

      if (shadowRef.current) {
        const shadowBias = (rootOffset.y + bodyOffset.y) * 0.12;
        shadowRef.current.style.transform = `translate(${roundPx(rootOffset.x * stageScale)}px, ${roundPx(rootOffset.y * stageScale)}px) scale(${Math.max(0.8, 1 - shadowBias * 0.02)})`;
        shadowRef.current.style.opacity = `${Math.max(0.12, (manifest.motion.shadowOpacity ?? 0.2) - shadowBias * 0.03)}`;
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

        let left = (frame.offsetX ?? 0);
        let top = (frame.offsetY ?? 0);
        let width = sourceWidth;
        let height = sourceHeight;
        let backgroundPositionX = -frame.x + (frame.offsetX ?? 0);
        let backgroundPositionY = -frame.y + (frame.offsetY ?? 0);

        if (piece.slice) {
          left = piece.slice.targetX;
          top = piece.slice.targetY;
          width = piece.slice.targetWidth;
          height = piece.slice.targetHeight;
          backgroundPositionX = -(frame.x + piece.slice.sourceX);
          backgroundPositionY = -(frame.y + piece.slice.sourceY);
        }

        node.style.left = `${roundPx(left * stageScale)}px`;
        node.style.top = `${roundPx(top * stageScale)}px`;
        node.style.width = `${roundPx(width * stageScale)}px`;
        node.style.height = `${roundPx(height * stageScale)}px`;
        node.style.transform = `translate(${roundPx(offset.x * stageScale)}px, ${roundPx(offset.y * stageScale)}px)`;
        node.style.backgroundPosition = `${roundPx(backgroundPositionX * stageScale)}px ${roundPx(backgroundPositionY * stageScale)}px`;
        node.style.backgroundSize = `${roundPx(sheetWidth * stageScale)}px ${roundPx(sheetHeight * stageScale)}px`;
      });

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [manifest, pieces, prefersReducedMotion, stageScale]);

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
            left: `${logicalWidth * stageScale * 0.28}px`,
            top: `${logicalHeight * stageScale * 0.88}px`,
            width: `${logicalWidth * stageScale * 0.44}px`,
            height: `${logicalHeight * stageScale * 0.08}px`,
            borderRadius: '999px',
            background: 'rgba(9, 8, 17, 0.2)',
            transformOrigin: 'center',
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
