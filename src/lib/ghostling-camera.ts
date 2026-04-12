import type {
  GhostlingSceneDensityBucket,
  GhostlingWorldRect,
  GhostlingWorldSpec,
} from '@/lib/ghostling-world';

export type GhostlingSceneCameraGuideMode = 'safe-area' | 'center-safe' | 'ultrawide-bleed' | 'fixed-crop';
export type GhostlingSceneCameraLayout = 'responsive-fit' | 'fixed-crop';

export interface GhostlingSceneCameraMetrics {
  width: number;
  height: number;
  viewportAspect: number;
  bucket: GhostlingSceneDensityBucket;
  worldViewport: GhostlingWorldRect;
  scale: number;
  scaleX: number;
  scaleY: number;
  renderWidth: number;
  renderHeight: number;
  offsetX: number;
  offsetY: number;
  guideMode: GhostlingSceneCameraGuideMode;
  labelSafeTopPx: number | null;
}

export interface GhostlingSceneLabelClampOptions {
  wrapperTopPx: number;
  labelHeightPx?: number;
  gapPx?: number;
  paddingPx?: number;
}

const CENTER_SAFE_VIEWPORT_ASPECT = 16 / 9;
const ULTRAWIDE_BLEED_VIEWPORT_ASPECT = 21 / 9;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + ((end - start) * amount);
}

function interpolateRect(start: GhostlingWorldRect, end: GhostlingWorldRect, amount: number): GhostlingWorldRect {
  return {
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
    width: lerp(start.width, end.width, amount),
    height: lerp(start.height, end.height, amount),
  };
}

function normalize(amount: number, start: number, end: number) {
  if (end <= start) return 0;
  return clamp((amount - start) / (end - start), 0, 1);
}

function resolveGuideViewport(
  world: GhostlingWorldSpec,
  viewportAspect: number,
): { rect: GhostlingWorldRect; guideMode: GhostlingSceneCameraGuideMode } {
  if (viewportAspect <= CENTER_SAFE_VIEWPORT_ASPECT) {
    return {
      rect: world.guides.centerSafe,
      guideMode: 'fixed-crop',
    };
  }

  if (viewportAspect >= ULTRAWIDE_BLEED_VIEWPORT_ASPECT) {
    return {
      rect: world.guides.ultrawideBleed,
      guideMode: 'ultrawide-bleed',
    };
  }

  return {
    rect: interpolateRect(
      world.guides.centerSafe,
      world.guides.ultrawideBleed,
      normalize(viewportAspect, CENTER_SAFE_VIEWPORT_ASPECT, ULTRAWIDE_BLEED_VIEWPORT_ASPECT),
    ),
    guideMode: 'center-safe',
  };
}

export function createGhostlingSceneCameraMetrics(
  world: GhostlingWorldSpec,
  viewportWidth: number,
  viewportHeight: number,
  bucket: GhostlingSceneDensityBucket,
  layout: GhostlingSceneCameraLayout = 'responsive-fit',
): GhostlingSceneCameraMetrics {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const viewportAspect = width / height;
  if (layout === 'fixed-crop') {
    const scale = 1;
    const renderWidth = world.sourceWidth * scale;
    const renderHeight = world.sourceHeight * scale;
    const offsetX = (width - renderWidth) / 2;
    const offsetY = height - renderHeight;
    const worldViewport: GhostlingWorldRect = {
      x: clamp((-offsetX) / scale, 0, Math.max(0, world.sourceWidth - (width / scale))),
      y: clamp((-offsetY) / scale, 0, Math.max(0, world.sourceHeight - (height / scale))),
      width: Math.min(world.sourceWidth, width / scale),
      height: Math.min(world.sourceHeight, height / scale),
    };
    const labelSafeTopPx = world.guides.labelSafeTop
      ? offsetY + ((world.guides.labelSafeTop.y + world.guides.labelSafeTop.height) * scale)
      : null;

    return {
      width,
      height,
      viewportAspect,
      bucket,
      worldViewport,
      scale,
      scaleX: scale,
      scaleY: scale,
      renderWidth,
      renderHeight,
      offsetX,
      offsetY,
      guideMode: 'center-safe',
      labelSafeTopPx,
    };
  }

  const guideViewport = resolveGuideViewport(world, viewportAspect);
  const guideCenterX = guideViewport.rect.x + (guideViewport.rect.width / 2);
  const scale = Math.min(
    width / Math.max(1, guideViewport.rect.width),
    height / Math.max(1, world.sourceHeight),
  );
  const renderWidth = world.sourceWidth * scale;
  const renderHeight = world.sourceHeight * scale;
  const minOffsetX = width - renderWidth;
  const maxOffsetX = 0;
  const offsetX = clamp((width / 2) - (guideCenterX * scale), minOffsetX, maxOffsetX);
  const offsetY = height - renderHeight;
  const worldViewport: GhostlingWorldRect = {
    x: clamp((-offsetX) / scale, 0, Math.max(0, world.sourceWidth - (width / scale))),
    y: 0,
    width: Math.min(world.sourceWidth, width / scale),
    height: world.sourceHeight,
  };
  const labelSafeTopPx = world.guides.labelSafeTop
    ? offsetY + ((world.guides.labelSafeTop.y + world.guides.labelSafeTop.height) * scale)
    : null;

  return {
    width,
    height,
    viewportAspect,
    bucket,
    worldViewport,
    scale,
    scaleX: scale,
    scaleY: scale,
    renderWidth,
    renderHeight,
    offsetX,
    offsetY,
    guideMode: guideViewport.guideMode,
    labelSafeTopPx,
  };
}

export function projectGhostlingWorldPoint(
  camera: GhostlingSceneCameraMetrics,
  x: number,
  y: number,
) {
  return {
    x: camera.offsetX + (x * camera.scaleX),
    y: camera.offsetY + (y * camera.scaleY),
  };
}

export function projectGhostlingWorldRect(
  camera: GhostlingSceneCameraMetrics,
  rect: GhostlingWorldRect,
): GhostlingWorldRect {
  const point = projectGhostlingWorldPoint(camera, rect.x, rect.y);
  return {
    x: point.x,
    y: point.y,
    width: rect.width * camera.scaleX,
    height: rect.height * camera.scaleY,
  };
}

export function unprojectGhostlingScreenPoint(
  camera: GhostlingSceneCameraMetrics,
  x: number,
  y: number,
) {
  return {
    x: (x - camera.offsetX) / camera.scaleX,
    y: (y - camera.offsetY) / camera.scaleY,
  };
}

export function resolveGhostlingLabelClampOffset(
  camera: GhostlingSceneCameraMetrics,
  options: GhostlingSceneLabelClampOptions,
) {
  if (camera.labelSafeTopPx === null) return 0;

  const labelHeightPx = options.labelHeightPx ?? 24;
  const gapPx = options.gapPx ?? 8;
  const paddingPx = options.paddingPx ?? 4;
  const defaultTop = options.wrapperTopPx - gapPx - labelHeightPx;
  const minTop = camera.labelSafeTopPx + paddingPx;

  return Math.max(0, minTop - defaultTop);
}
