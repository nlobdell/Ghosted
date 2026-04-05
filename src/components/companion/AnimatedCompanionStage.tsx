'use client';

/* eslint-disable @next/next/no-img-element -- Companion animation falls back to runtime image URLs from the app server. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompanionAnimationFrame,
  CompanionLayerAnimation,
  CompanionRenderLayer,
  CompanionRenderManifest,
} from '@/lib/types';

type LoadedLayer = {
  image: HTMLImageElement;
  layer: CompanionRenderLayer;
};

type AnimatedCompanionStageProps = {
  manifest?: CompanionRenderManifest | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load stage asset: ${src}`));
    image.src = src;
  });
}

function resolveFrames(animation: CompanionLayerAnimation): CompanionAnimationFrame[] {
  if (animation.frames?.length) return animation.frames;

  const frameDuration = animation.fps > 0 ? Math.round(1000 / animation.fps) : 1000;
  return Array.from({ length: Math.max(1, animation.frameCount) }, (_, index) => ({
    x: index * animation.frameWidth,
    y: 0,
    width: animation.frameWidth,
    height: animation.frameHeight,
    durationMs: frameDuration,
    offsetX: 0,
    offsetY: 0,
    sourceWidth: animation.frameWidth,
    sourceHeight: animation.frameHeight,
  }));
}

function currentFrame(layer: CompanionRenderLayer, elapsedMs: number, reducedMotion: boolean) {
  const { animation } = layer;
  const frames = resolveFrames(animation);
  if (reducedMotion || animation.mode !== 'spritesheet' || frames.length <= 1) {
    return frames[0];
  }

  const totalDuration = frames.reduce((sum, frame) => sum + Math.max(1, frame.durationMs), 0);
  const playbackTime = animation.loop
    ? elapsedMs % totalDuration
    : Math.min(elapsedMs, Math.max(0, totalDuration - 1));

  let cursor = playbackTime;
  for (const frame of frames) {
    cursor -= Math.max(1, frame.durationMs);
    if (cursor < 0) return frame;
  }

  return frames[frames.length - 1];
}

function drawLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  layer: CompanionRenderLayer,
  elapsedMs: number,
  reducedMotion: boolean,
  width: number,
  height: number,
) {
  const frame = currentFrame(layer, elapsedMs, reducedMotion);
  const { animation } = layer;

  if (!frame || animation.mode !== 'spritesheet' || animation.frameCount <= 1) {
    context.drawImage(image, 0, 0, image.naturalWidth || width, image.naturalHeight || height, 0, 0, width, height);
    return;
  }

  const sourceWidth = Math.max(1, frame.sourceWidth ?? frame.width);
  const sourceHeight = Math.max(1, frame.sourceHeight ?? frame.height);
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;
  const destX = (frame.offsetX ?? 0) * scaleX;
  const destY = (frame.offsetY ?? 0) * scaleY;
  const destWidth = frame.width * scaleX;
  const destHeight = frame.height * scaleY;

  context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    destX,
    destY,
    destWidth,
    destHeight,
  );
}

export function AnimatedCompanionStage({
  manifest,
  fallbackSrc,
  alt,
  className,
}: AnimatedCompanionStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [loadedLayers, setLoadedLayers] = useState<LoadedLayer[] | null>(null);
  const [failed, setFailed] = useState(false);

  const layers = useMemo(
    () => [...(manifest?.layers ?? [])].sort((left, right) => left.zIndex - right.zIndex),
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
    if (!layers.length) {
      setLoadedLayers(null);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoadedLayers(null);
    setFailed(false);

    Promise.all(
      layers.map(async (layer) => ({
        layer,
        image: await loadImage(layer.src),
      })),
    )
      .then((nextLayers) => {
        if (cancelled) return;
        setLoadedLayers(nextLayers);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [layers]);

  useEffect(() => {
    if (!manifest || !loadedLayers?.length || failed) return undefined;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const width = manifest.width || 32;
    const height = manifest.height || 32;
    const motion = manifest.motion;

    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = false;

    let frameId = 0;
    const startTime = performance.now();

    const render = (timestamp: number) => {
      const elapsedMs = timestamp - startTime;
      const bobDurationMs = Math.max(600, motion?.bobDurationMs ?? 2200);
      const bobAmplitude = prefersReducedMotion ? 0 : (motion?.bobAmplitudePx ?? 1.15);
      const bobOffset = bobAmplitude ? Math.sin((elapsedMs / bobDurationMs) * Math.PI * 2) * bobAmplitude : 0;
      const bobRatio = bobAmplitude ? bobOffset / bobAmplitude : 0;
      const shadowOpacity = motion?.shadowOpacity ?? 0.2;

      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgba(9, 8, 17, ${Math.max(0.08, shadowOpacity - (bobRatio * 0.05))})`;
      context.beginPath();
      context.ellipse(
        width * 0.5,
        height - 3,
        width * (0.25 - (bobRatio * 0.02)),
        height * (0.05 - (bobRatio * 0.005)),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.save();
      context.translate(0, -bobOffset);
      loadedLayers.forEach(({ image, layer }) => {
        drawLayer(context, image, layer, elapsedMs, prefersReducedMotion, width, height);
      });
      context.restore();

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [failed, loadedLayers, manifest, prefersReducedMotion]);

  if (!manifest || !layers.length || failed || !loadedLayers?.length) {
    return <img src={fallbackSrc} alt={alt} className={className} />;
  }

  return <canvas ref={canvasRef} className={className} role="img" aria-label={alt} />;
}
