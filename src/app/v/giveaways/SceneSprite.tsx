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

function spriteSignature(spec: SceneSpriteSpec, initialFrame: number) {
  return [
    spec.id,
    spec.src,
    spec.frames,
    spec.playback,
    spec.durationMs ?? 0,
    spec.frameWidth ?? 0,
    spec.frameHeight ?? 0,
    initialFrame,
  ].join('|');
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
  const signature = spriteSignature(spec, initialFrame);
  const [spriteState, setSpriteState] = useState(() => ({
    signature,
    frameIndex: initialFrame,
  }));
  const animated = spec.frames > 1 && spec.playback !== 'static' && Boolean(spec.durationMs);
  const textured = Boolean(spec.textureLayer);
  const texturedAnimated = Boolean(
    spec.textureLayer?.durationMs
    && ((spec.textureLayer.scrollX && spec.textureLayer.scrollX !== '0px')
      || (spec.textureLayer.scrollY && spec.textureLayer.scrollY !== '0px')),
  );
  const displayFrameIndex = spriteState.signature === signature ? spriteState.frameIndex : initialFrame;

  useEffect(() => {
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

      setSpriteState({
        signature,
        frameIndex: nextFrame,
      });

      if (spec.playback === 'once' && nextFrame >= spec.frames - 1) {
        window.clearInterval(intervalId);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [animated, initialFrame, signature, spec.durationMs, spec.frames, spec.playback]);

  const style = {
    ...styleProp,
    ['--scene-sprite-image' as string]: `url("${spec.src}")`,
    ['--scene-sprite-frames' as string]: String(spec.frames),
    ['--scene-sprite-duration' as string]: `${spec.durationMs ?? 0}ms`,
    ['--scene-sprite-static-translate' as string]: spriteTranslate(spec.frames, displayFrameIndex),
    ['--scene-sprite-end-translate' as string]: spriteEndTranslate(spec.frames),
    ['--scene-sprite-anchor-x' as string]: spriteAnchorShift(spec, displayFrameIndex),
    ['--scene-texture-image' as string]: spec.textureLayer ? `url("${spec.textureLayer.src}")` : 'none',
    ['--scene-texture-mask-image' as string]: `url("${spec.textureLayer?.maskSrc ?? spec.src}")`,
    ['--scene-texture-mask-frames' as string]: String(spec.textureLayer?.maskFrames ?? spec.frames),
    ['--scene-texture-repeat' as string]: spec.textureLayer?.repeat ?? 'repeat',
    ['--scene-texture-size' as string]: spec.textureLayer?.size ?? 'auto',
    ['--scene-texture-duration' as string]: `${spec.textureLayer?.durationMs ?? 0}ms`,
    ['--scene-texture-scroll-x' as string]: spec.textureLayer?.scrollX ?? '0px',
    ['--scene-texture-scroll-y' as string]: spec.textureLayer?.scrollY ?? '0px',
    ['--scene-texture-opacity' as string]: String(spec.textureLayer?.opacity ?? 1),
    ['--scene-detail-image' as string]: `url("${spec.detailLayer?.src ?? spec.src}")`,
    ['--scene-detail-opacity' as string]: String(spec.detailLayer?.opacity ?? 1),
    ['--scene-detail-blend-mode' as string]: spec.detailLayer?.mixBlendMode ?? 'normal',
    ['--scene-detail-filter' as string]: spec.detailLayer?.filter ?? 'none',
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
      data-sprite-frame={String(displayFrameIndex)}
      data-sprite-frames={String(spec.frames)}
      data-sprite-playback={animated ? spec.playback : 'static'}
      data-sprite-textured={textured ? 'true' : 'false'}
      aria-hidden="true"
      {...rest}
    >
      {textured ? (
        <>
          <span
            className={[
              styles.sceneSpriteTextureMask,
              spec.textureLayer?.pixelated ? styles.sceneSpritePixelated : '',
              texturedAnimated ? styles.sceneSpriteTextureAnimated : '',
            ].filter(Boolean).join(' ')}
            data-sprite-layer="texture"
          />
          {spec.detailLayer ? (
            <span
              className={[
                styles.sceneSpriteDetailStrip,
                (spec.detailLayer.pixelated ?? spec.pixelated) ? styles.sceneSpritePixelated : '',
              ].filter(Boolean).join(' ')}
              data-sprite-layer="detail"
            />
          ) : null}
        </>
      ) : (
        <span className={styles.sceneSpriteStrip} />
      )}
    </span>
  );
}
