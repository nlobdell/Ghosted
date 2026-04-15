'use client';

import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
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

function spriteAnchorShift(spec: SceneSpriteSpec) {
  if (!spec.visibleBounds || !spec.frameWidth) {
    return '0%';
  }

  const visibleCenter = (spec.visibleBounds.left + spec.visibleBounds.right + 1) / 2;
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
  const animated = spec.frames > 1 && spec.playback !== 'static' && Boolean(spec.durationMs);
  const style = {
    ...styleProp,
    ['--scene-sprite-image' as string]: `url("${spec.src}")`,
    ['--scene-sprite-frames' as string]: String(spec.frames),
    ['--scene-sprite-duration' as string]: `${spec.durationMs ?? 0}ms`,
    ['--scene-sprite-static-translate' as string]: spriteTranslate(spec.frames, spec.initialFrame ?? 0),
    ['--scene-sprite-end-translate' as string]: spriteEndTranslate(spec.frames),
    ['--scene-sprite-anchor-x' as string]: spriteAnchorShift(spec),
  } as CSSProperties;

  return (
    <span
      className={[
        styles.sceneSprite,
        spec.pixelated ? styles.sceneSpritePixelated : '',
        animated ? (spec.playback === 'loop' ? styles.sceneSpriteLoop : styles.sceneSpriteOnce) : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={style}
      data-sprite-id={spec.id}
      data-sprite-frames={String(spec.frames)}
      data-sprite-playback={animated ? spec.playback : 'static'}
      aria-hidden="true"
      {...rest}
    >
      <span className={styles.sceneSpriteStrip} />
    </span>
  );
}
