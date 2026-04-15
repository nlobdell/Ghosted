'use client';

import { useEffect, useState, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import type { SceneSpriteSpec } from './scene-sprite-catalog';
import styles from './loot-chest-scene.module.css';

function spriteTranslate(frames: number, frameIndex = 0) {
  if (frames <= 1 || frameIndex <= 0) {
    return '0%';
  }

  return `${-((frameIndex * 100) / frames)}%`;
}

function spriteEndTranslate(frames: number) {
  if (frames <= 1) {
    return '0%';
  }

  return `${-(((frames - 1) * 100) / frames)}%`;
}

function clampFrameIndex(spec: SceneSpriteSpec, frameIndex: number) {
  if (spec.frames <= 1) {
    return 0;
  }

  return Math.max(0, Math.min(spec.frames - 1, frameIndex));
}

function spriteAnchorShift(spec: SceneSpriteSpec, frameIndex: number) {
  const bounds = spec.frameAnchorBounds?.[frameIndex] ?? spec.anchorBounds ?? spec.visibleBounds;
  if (!bounds || !spec.frameWidth) {
    return '0%';
  }

  const visibleCenter = (bounds.left + bounds.right + 1) / 2;
  const frameCenter = spec.frameWidth / 2;
  return `${((frameCenter - visibleCenter) / spec.frameWidth) * 100}%`;
}

export function SceneSprite({
  spec,
  className,
  style: styleProp,
  ...rest
}: {
  spec: SceneSpriteSpec;
} & Omit<ComponentPropsWithoutRef<'span'>, 'children'>) {
  const initialFrame = clampFrameIndex(spec, spec.initialFrame ?? 0);
  const [frameIndex, setFrameIndex] = useState(initialFrame);
  const animated = spec.frames > 1 && spec.playback !== 'static' && Boolean(spec.durationMs);

  useEffect(() => {
    setFrameIndex(initialFrame);

    if (!animated || !spec.durationMs) {
      return undefined;
    }

    const frameCount = spec.playback === 'loop'
      ? spec.frames
      : Math.max(1, spec.frames - 1 - initialFrame);
    const intervalMs = spec.durationMs / frameCount;
    let nextFrame = initialFrame;

    const intervalId = window.setInterval(() => {
      if (spec.playback === 'loop') {
        nextFrame = (nextFrame + 1) % spec.frames;
      } else {
        nextFrame = Math.min(spec.frames - 1, nextFrame + 1);
      }

      setFrameIndex(nextFrame);

      if (spec.playback === 'once' && nextFrame >= spec.frames - 1) {
        window.clearInterval(intervalId);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [animated, initialFrame, spec.durationMs, spec.frames, spec.id, spec.playback]);

  const style = {
    ...styleProp,
    ['--scene-sprite-image' as string]: `url("${spec.src}")`,
    ['--scene-sprite-frames' as string]: String(spec.frames),
    ['--scene-sprite-duration' as string]: `${spec.durationMs ?? 0}ms`,
    ['--scene-sprite-static-translate' as string]: spriteTranslate(spec.frames, frameIndex),
    ['--scene-sprite-end-translate' as string]: spriteEndTranslate(spec.frames),
    ['--scene-sprite-anchor-x' as string]: spriteAnchorShift(spec, frameIndex),
  } as CSSProperties;

  return (
    <span
      className={[
        styles.sceneSprite,
        spec.pixelated ? styles.sceneSpritePixelated : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={style}
      data-sprite-id={spec.id}
      data-sprite-frame={String(frameIndex)}
      data-sprite-frames={String(spec.frames)}
      data-sprite-playback={animated ? spec.playback : 'static'}
      aria-hidden="true"
      {...rest}
    >
      <span className={styles.sceneSpriteStrip} />
    </span>
  );
}
