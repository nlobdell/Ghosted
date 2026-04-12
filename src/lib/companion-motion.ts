import type {
  CompanionMotionAccent,
  CompanionMotionChannel,
  CompanionMotionWave,
  CompanionRenderRect,
} from '@/lib/types';

export type StagePresentation = 'ambient' | 'studio' | 'hero' | 'admin';

export type CompanionMotionVector = {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
};

export type CompanionMotionPivotMap = Record<string, CompanionRenderRect>;

export type CompanionMotionAccentEvent = {
  key: string;
  groups: string[];
  startMs: number;
  endMs: number;
  durationMs: number;
  overrides: Record<string, CompanionMotionChannel>;
};

export type Matrix2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

const STAGE_PRESENTATION_MULTIPLIERS: Record<StagePresentation, number> = {
  ambient: 1,
  studio: 1.15,
  hero: 1.28,
  admin: 0.86,
};

export function stagePresentationMultiplier(presentation: StagePresentation) {
  return STAGE_PRESENTATION_MULTIPLIERS[presentation] ?? 1;
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function motionGroupChain(groupKey: string | null | undefined, rootKey = 'root') {
  const normalizedRoot = String(rootKey || 'root');
  const group = String(groupKey || normalizedRoot);
  if (group === normalizedRoot || group === 'root') return [normalizedRoot];
  if (group === 'body') return [normalizedRoot, 'body'];
  if (group === 'head') return [normalizedRoot, 'body', 'head'];
  return [normalizedRoot, group];
}

export function unionRects(rects: CompanionRenderRect[]) {
  if (!rects.length) return null;

  let minX = rects[0]!.x;
  let minY = rects[0]!.y;
  let maxX = rects[0]!.x + rects[0]!.width;
  let maxY = rects[0]!.y + rects[0]!.height;

  for (const rect of rects.slice(1)) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  } satisfies CompanionRenderRect;
}

export function resolveWaveValue(
  wave: CompanionMotionWave | undefined,
  elapsedMs: number,
  multiplier = 1,
) {
  if (!wave) return 0;
  const amplitude = Number(wave.amplitude ?? 0);
  const durationMs = Number(wave.durationMs ?? 0);
  const phase = Number(wave.phase ?? 0);
  if (!Number.isFinite(amplitude) || amplitude === 0 || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(phase)) {
    return 0;
  }

  const radians = ((elapsedMs / durationMs) * Math.PI * 2) + (phase * Math.PI * 2);
  return Math.sin(radians) * amplitude * multiplier;
}

export function motionVectorIdentity(): CompanionMotionVector {
  return {
    translateX: 0,
    translateY: 0,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

export function evaluateMotionChannel(
  channel: CompanionMotionChannel | undefined,
  elapsedMs: number,
  options: { multiplier?: number; envelope?: number } = {},
) {
  const amplitudeMultiplier = (options.multiplier ?? 1) * (options.envelope ?? 1);
  return {
    translateX: resolveWaveValue(channel?.offsetX, elapsedMs, amplitudeMultiplier),
    translateY: resolveWaveValue(channel?.offsetY, elapsedMs, amplitudeMultiplier),
    rotateDeg: resolveWaveValue(channel?.rotateDeg, elapsedMs, amplitudeMultiplier),
    scaleX: 1 + resolveWaveValue(channel?.scaleX, elapsedMs, amplitudeMultiplier),
    scaleY: 1 + resolveWaveValue(channel?.scaleY, elapsedMs, amplitudeMultiplier),
  } satisfies CompanionMotionVector;
}

export function mergeMotionVectors(...vectors: Array<CompanionMotionVector | undefined>) {
  return vectors.reduce<CompanionMotionVector>(
    (combined, vector) => ({
      translateX: combined.translateX + (vector?.translateX ?? 0),
      translateY: combined.translateY + (vector?.translateY ?? 0),
      rotateDeg: combined.rotateDeg + (vector?.rotateDeg ?? 0),
      scaleX: combined.scaleX * (vector?.scaleX ?? 1),
      scaleY: combined.scaleY * (vector?.scaleY ?? 1),
    }),
    motionVectorIdentity(),
  );
}

export function buildAccentSchedule(
  accents: CompanionMotionAccent[] | undefined,
  seedKey: string,
  untilMs: number,
) {
  if (!Array.isArray(accents) || accents.length === 0) return [] as CompanionMotionAccentEvent[];

  const safeUntilMs = Math.max(0, untilMs);
  const events: CompanionMotionAccentEvent[] = [];

  for (const accent of accents) {
    const durationMs = Math.max(1, Math.trunc(Number(accent.durationMs ?? 0) || 0));
    const intervalMsMin = Math.max(1, Math.trunc(Number(accent.intervalMsMin ?? durationMs) || durationMs));
    const intervalMsMax = Math.max(intervalMsMin, Math.trunc(Number(accent.intervalMsMax ?? intervalMsMin) || intervalMsMin));
    const groups = Array.isArray(accent.groups)
      ? accent.groups.map((group) => String(group || '').trim()).filter(Boolean)
      : [];
    if (!groups.length) continue;

    const rng = mulberry32(hashSeed(`${seedKey}:${accent.key}`));
    const nextGap = () => intervalMsMin + Math.round(rng() * Math.max(0, intervalMsMax - intervalMsMin));
    let cursor = Math.round(rng() * intervalMsMin);

    while (cursor <= safeUntilMs) {
      events.push({
        key: String(accent.key || 'accent'),
        groups,
        startMs: cursor,
        endMs: cursor + durationMs,
        durationMs,
        overrides: accent.overrides ?? {},
      });
      cursor += durationMs + nextGap();
    }
  }

  return events.sort((left, right) => left.startMs - right.startMs);
}

function accentEnvelope(progress: number) {
  return Math.sin(clamp01(progress) * Math.PI);
}

export function accentMotionForGroup(
  events: CompanionMotionAccentEvent[],
  groupKey: string,
  elapsedMs: number,
  multiplier = 1,
) {
  let combined = motionVectorIdentity();

  for (const event of events) {
    if (elapsedMs < event.startMs || elapsedMs > event.endMs) continue;
    if (!event.groups.includes(groupKey)) continue;

    const channel = event.overrides[groupKey];
    if (!channel) continue;

    const localElapsed = elapsedMs - event.startMs;
    const envelope = accentEnvelope(localElapsed / Math.max(1, event.durationMs));
    combined = mergeMotionVectors(
      combined,
      evaluateMotionChannel(channel, localElapsed, {
        multiplier,
        envelope,
      }),
    );
  }

  return combined;
}

export function identityMatrix(): Matrix2D {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };
}

export function multiplyMatrix(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: (left.a * right.a) + (left.c * right.b),
    b: (left.b * right.a) + (left.d * right.b),
    c: (left.a * right.c) + (left.c * right.d),
    d: (left.b * right.c) + (left.d * right.d),
    e: (left.a * right.e) + (left.c * right.f) + left.e,
    f: (left.b * right.e) + (left.d * right.f) + left.f,
  };
}

export function translateMatrix(x: number, y: number): Matrix2D {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: x,
    f: y,
  };
}

export function scaleMatrix(scaleX: number, scaleY: number): Matrix2D {
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: 0,
    f: 0,
  };
}

export function rotateMatrix(deg: number): Matrix2D {
  const radians = (deg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: 0,
    f: 0,
  };
}

export function composeMotionMatrix(
  vector: CompanionMotionVector,
  pivot: { x: number; y: number },
) {
  return multiplyMatrix(
    translateMatrix(vector.translateX, vector.translateY),
    multiplyMatrix(
      translateMatrix(pivot.x, pivot.y),
      multiplyMatrix(
        rotateMatrix(vector.rotateDeg),
        multiplyMatrix(
          scaleMatrix(vector.scaleX, vector.scaleY),
          translateMatrix(-pivot.x, -pivot.y),
        ),
      ),
    ),
  );
}

export function matrixForElement(matrix: Matrix2D, left: number, top: number) {
  return multiplyMatrix(
    translateMatrix(-left, -top),
    multiplyMatrix(matrix, translateMatrix(left, top)),
  );
}

export function matrixToCss(matrix: Matrix2D) {
  const precision = (value: number) => Number(value.toFixed(6));
  return `matrix(${precision(matrix.a)}, ${precision(matrix.b)}, ${precision(matrix.c)}, ${precision(matrix.d)}, ${precision(matrix.e)}, ${precision(matrix.f)})`;
}

export function matrixToSvg(matrix: Matrix2D) {
  const precision = (value: number) => Number(value.toFixed(6));
  return `matrix(${precision(matrix.a)} ${precision(matrix.b)} ${precision(matrix.c)} ${precision(matrix.d)} ${precision(matrix.e)} ${precision(matrix.f)})`;
}

export function resolveStageShadowRect(width: number, height: number) {
  return {
    x: width * (7.5 / 32),
    y: height * (26.6 / 32),
    width: width * (17 / 32),
    height: height * (4.8 / 32),
  } satisfies CompanionRenderRect;
}
