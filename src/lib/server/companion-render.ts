import 'server-only';

import type { Database } from 'better-sqlite3';
import type { CompanionMotionChannel, CompanionSlotKey } from '@/lib/types';
import {
  type CompanionUserRow,
  companionCatalogAnyRow,
  companionLoadoutMap,
} from '@/lib/server/companion';
import { AppError } from '@/lib/server/core';
import {
  COMPANION_CANVAS_SIZE,
  COMPANION_DEFAULT_SHADOW_OPACITY,
  COMPANION_SLOT_LABELS,
  COMPANION_SLOT_ORDER,
  resolveCompanionLayerScene,
  companionAssetAnimation,
  companionAssetDataUri,
} from '@/lib/server/companion-storage';
import { womMePayload } from '@/lib/server/wom';

type CompanionLoadout = Record<CompanionSlotKey, string | null>;
type CompanionCardStat = {
  label: string;
  value: string;
};
type CompanionDiscordCardWom = Awaited<ReturnType<typeof womMePayload>>;
type CompanionDiscordCardProfile = {
  rankLabel: string | null;
  groupName: string | null;
  stats: CompanionCardStat[];
};

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const DECIMAL_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});
const DISCORD_CARD_WIDTH = 1200;
const DISCORD_CARD_HEIGHT = 630;
const DISCORD_STAGE_FRAME = {
  x: 58,
  y: 58,
  width: 304,
  height: 514,
};

type CompanionRenderUserRow = CompanionUserRow & {
  discord_id: string;
};

function escapeXml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapCompanionCardText(text: string, limit: number) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [] as string[];

  const lines: string[] = [];
  let current = words[0] ?? '';
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  lines.push(current);
  return lines;
}

function fitCompanionCardTitle(text: string, limit = 18) {
  const value = String(text ?? '').trim();
  if (value.length <= limit) return escapeXml(value);
  const shortened = value.slice(0, Math.max(0, limit - 1)).trimEnd();
  return `${escapeXml(shortened)}&#8230;`;
}

function renderCompanionCardCopy(options: {
  title: string;
  subtitle: string;
  body: string;
}) {
  const titleMarkup = `<text x="244" y="152" fill="#f7f6ff" font-family="Arial, sans-serif" font-size="28" font-weight="700">${fitCompanionCardTitle(options.title)}</text>`;
  const subtitleMarkup = `<text x="244" y="184" fill="#b8b0d5" font-family="Arial, sans-serif" font-size="16">${escapeXml(options.subtitle)}</text>`;
  const bodyMarkup = wrapCompanionCardText(options.body, 34)
    .slice(0, 2)
    .map((line, index) => `<text x="244" y="${226 + (index * 20)}" fill="#d9d4ef" font-family="Arial, sans-serif" font-size="15">${escapeXml(line)}</text>`)
    .join('');
  return titleMarkup + subtitleMarkup + bodyMarkup;
}

function formatCompanionCompactNumber(value: unknown) {
  if (!Number.isFinite(Number(value))) return null;
  return COMPACT_NUMBER_FORMATTER.format(Number(value));
}

function formatCompanionDecimalNumber(value: unknown) {
  if (!Number.isFinite(Number(value))) return null;
  return DECIMAL_NUMBER_FORMATTER.format(Number(value));
}

function buildCompanionDiscordCardStats(wom: CompanionDiscordCardWom) {
  const stats: CompanionCardStat[] = [];
  const totalExp = formatCompanionCompactNumber(wom.player.exp);
  const ehp = formatCompanionDecimalNumber(wom.player.ehp);
  const ehb = formatCompanionDecimalNumber(wom.player.ehb);

  if (totalExp) stats.push({ label: 'Total EXP', value: totalExp });
  if (ehp) stats.push({ label: 'EHP', value: ehp });
  if (ehb) stats.push({ label: 'EHB', value: ehb });
  if (Array.isArray(wom.competitions)) {
    stats.push({ label: 'Competitions', value: String(wom.competitions.length) });
  }
  if (stats.length < 4 && Array.isArray(wom.achievements)) {
    stats.push({ label: 'Achievements', value: String(wom.achievements.length) });
  }

  return stats.slice(0, 4);
}

async function resolveCompanionDiscordCardProfile(db: Database, userId: number | null | undefined) {
  if (!userId) return null;

  try {
    const wom = await womMePayload(db, { id: userId });
    return {
      rankLabel: wom.membership?.rankLabel ?? wom.membership?.role ?? null,
      groupName: wom.membership?.groupName ?? null,
      stats: buildCompanionDiscordCardStats(wom),
    } satisfies CompanionDiscordCardProfile;
  } catch {
    return null;
  }
}

function renderCompanionDiscordStatGrid(stats: CompanionCardStat[]) {
  const tiles = [
    { x: 448, y: 378 },
    { x: 780, y: 378 },
    { x: 448, y: 484 },
    { x: 780, y: 484 },
  ];

  return stats.slice(0, 4).map((stat, index) => {
    const tile = tiles[index];
    if (!tile) return '';

    return (
      `<g transform="translate(${tile.x} ${tile.y})">`
      + '<rect width="296" height="88" rx="22" fill="rgba(12, 14, 24, 0.82)" stroke="rgba(155, 182, 255, 0.18)" />'
      + `<text x="24" y="33" fill="#91a8ec" font-family="Arial, sans-serif" font-size="18" letter-spacing="0.8">${escapeXml(stat.label)}</text>`
      + `<text x="24" y="65" fill="#f4f6ff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(stat.value)}</text>`
      + '</g>'
    );
  }).join('');
}

function renderCompanionDiscordCardCopy(options: {
  title: string;
  subtitle: string;
  profile: CompanionDiscordCardProfile | null;
}) {
  const titleMarkup = `<text x="448" y="184" fill="#f7f6ff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${fitCompanionCardTitle(options.title, 24)}</text>`;
  const subtitleMarkup = `<text x="448" y="226" fill="#b8c4ea" font-family="Arial, sans-serif" font-size="26">${escapeXml(options.subtitle)}</text>`;

  if (!options.profile) {
    const fallbackBody = wrapCompanionCardText(
      'Link a Wise Old Man account to add clan rank and tracked progress to this Discord-ready Ghostling card.',
      46,
    )
      .slice(0, 3)
      .map((line, index) => `<text x="448" y="${296 + (index * 32)}" fill="#d9dff7" font-family="Arial, sans-serif" font-size="24">${escapeXml(line)}</text>`)
      .join('');

    return (
      titleMarkup
      + subtitleMarkup
      + '<text x="448" y="270" fill="#91a8ec" font-family="Arial, sans-serif" font-size="18" letter-spacing="2">WISE OLD MAN</text>'
      + fallbackBody
    );
  }

  const rankLines = wrapCompanionCardText(options.profile.rankLabel ?? 'Tracked member', 34).slice(0, 2);
  const groupLabel = options.profile.groupName
    ? `<text x="448" y="${rankLines.length > 1 ? 348 : 320}" fill="#c3cced" font-family="Arial, sans-serif" font-size="22">${escapeXml(options.profile.groupName)}</text>`
    : '';
  const statsMarkup = options.profile.stats.length
    ? renderCompanionDiscordStatGrid(options.profile.stats)
    : '<text x="448" y="410" fill="#d9dff7" font-family="Arial, sans-serif" font-size="24">Tracked data is linked, but no export stats are ready yet.</text>';

  return (
    titleMarkup
    + subtitleMarkup
    + '<text x="448" y="270" fill="#91a8ec" font-family="Arial, sans-serif" font-size="18" letter-spacing="2">WISE OLD MAN RANK</text>'
    + rankLines
      .map((line, index) => `<text x="448" y="${304 + (index * 28)}" fill="#f4f6ff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(line)}</text>`)
      .join('')
    + groupLabel
    + statsMarkup
  );
}

function resolveDiscordCompanionStageLayout(sceneWidth: number, sceneHeight: number) {
  const maxSceneDimension = Math.max(1, sceneWidth, sceneHeight);
  const targetScale = 9 * (COMPANION_CANVAS_SIZE / maxSceneDimension);
  const maxScaleByWidth = (DISCORD_STAGE_FRAME.width - 28) / Math.max(1, sceneWidth);
  const maxScaleByHeight = (DISCORD_STAGE_FRAME.height - 72) / Math.max(1, sceneHeight);
  const stageScale = Math.max(1, Math.min(targetScale, maxScaleByWidth, maxScaleByHeight));
  const stageWidth = sceneWidth * stageScale;
  const stageHeight = sceneHeight * stageScale;
  const shadowCx = DISCORD_STAGE_FRAME.x + (DISCORD_STAGE_FRAME.width / 2);
  const shadowCy = DISCORD_STAGE_FRAME.y + DISCORD_STAGE_FRAME.height - 40;
  const shadowRx = Math.max(96, Math.min(136, stageWidth * 0.46));
  const shadowRy = Math.max(22, Math.min(30, stageHeight * 0.09));
  const stageFloorY = shadowCy - shadowRy;

  return {
    stageScale,
    stageX: DISCORD_STAGE_FRAME.x + ((DISCORD_STAGE_FRAME.width - stageWidth) / 2),
    stageY: stageFloorY - stageHeight,
    shadowCx,
    shadowCy,
    shadowRx,
    shadowRy,
  };
}

function renderDiscordCompanionCard(options: {
  sceneWidth: number;
  sceneHeight: number;
  layersMarkup: string;
  title: string;
  subtitle: string;
  animated: boolean;
  shadowDuration?: string;
  profile: CompanionDiscordCardProfile | null;
}) {
  const stageLayout = resolveDiscordCompanionStageLayout(options.sceneWidth, options.sceneHeight);
  const shadow = options.animated
    ? (
      `<ellipse cx="${stageLayout.shadowCx}" cy="${stageLayout.shadowCy}" rx="${stageLayout.shadowRx}" ry="${stageLayout.shadowRy}" fill="rgba(7, 8, 16, 0.42)">`
      + `<animate attributeName="rx" values="${stageLayout.shadowRx};${(stageLayout.shadowRx * 0.9).toFixed(3)};${stageLayout.shadowRx}" dur="${options.shadowDuration ?? '3.200s'}" repeatCount="indefinite" />`
      + `<animate attributeName="opacity" values="0.42;0.28;0.42" dur="${options.shadowDuration ?? '3.200s'}" repeatCount="indefinite" />`
      + '</ellipse>'
    )
    : `<ellipse cx="${stageLayout.shadowCx}" cy="${stageLayout.shadowCy}" rx="${stageLayout.shadowRx}" ry="${stageLayout.shadowRy}" fill="rgba(7, 8, 16, 0.34)" />`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DISCORD_CARD_WIDTH}" height="${DISCORD_CARD_HEIGHT}" viewBox="0 0 ${DISCORD_CARD_WIDTH} ${DISCORD_CARD_HEIGHT}" shape-rendering="crispEdges" style="image-rendering:pixelated">`
    + '<defs>'
    + '<linearGradient id="discord-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#090b13" /><stop offset="52%" stop-color="#17192d" /><stop offset="100%" stop-color="#211942" /></linearGradient>'
    + '<linearGradient id="discord-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(9, 11, 18, 0.98)" /><stop offset="100%" stop-color="rgba(18, 22, 35, 0.92)" /></linearGradient>'
    + '</defs>'
    + `<rect width="${DISCORD_CARD_WIDTH}" height="${DISCORD_CARD_HEIGHT}" rx="38" fill="url(#discord-bg)" />`
    + '<rect x="32" y="32" width="356" height="566" rx="34" fill="url(#discord-panel)" stroke="rgba(155, 182, 255, 0.16)" />'
    + `<rect x="${DISCORD_STAGE_FRAME.x}" y="${DISCORD_STAGE_FRAME.y}" width="${DISCORD_STAGE_FRAME.width}" height="${DISCORD_STAGE_FRAME.height}" rx="28" fill="rgba(10, 13, 23, 0.78)" stroke="rgba(155, 182, 255, 0.12)" />`
    + shadow
    + `<g transform="translate(${stageLayout.stageX.toFixed(3)} ${stageLayout.stageY.toFixed(3)}) scale(${stageLayout.stageScale.toFixed(4)})">`
    + options.layersMarkup
    + '</g>'
    + '<text x="448" y="118" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="18" letter-spacing="3">GHOSTED GHOSTLING</text>'
    + renderCompanionDiscordCardCopy({
      title: options.title,
      subtitle: options.subtitle,
      profile: options.profile,
    })
    + '<text x="448" y="582" fill="#8fa4e6" font-family="Arial, sans-serif" font-size="18">Discord-ready export • animated Ghostling card</text>'
    + '</svg>'
  );
}

function companionSvgTranslateAnimation(
  wave: CompanionMotionChannel['offsetX'] | CompanionMotionChannel['offsetY'] | undefined,
  axis: 'x' | 'y',
  steps = 10,
) {
  if (!wave) return '';

  const amplitude = Number(wave.amplitude ?? 0);
  const durationMs = Math.max(1, Math.trunc(Number(wave.durationMs ?? 0)));
  const phase = Number(wave.phase ?? 0);
  if (!Number.isFinite(amplitude) || amplitude === 0 || !Number.isFinite(durationMs) || !Number.isFinite(phase)) {
    return '';
  }

  const values: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const radians = progress * Math.PI * 2 + (phase * Math.PI * 2);
    const offset = Math.sin(radians) * amplitude;
    values.push(axis === 'x' ? `${offset.toFixed(3)} 0` : `0 ${offset.toFixed(3)}`);
  }

  return `<animateTransform attributeName="transform" type="translate" additive="sum" values="${values.join(';')}" dur="${(durationMs / 1000).toFixed(3)}s" repeatCount="indefinite" />`;
}

function companionSvgMotionGroupMarkup(
  groupKey: string,
  markup: string,
  channel: CompanionMotionChannel | undefined,
) {
  if (!markup) return '';
  const xAnimation = companionSvgTranslateAnimation(channel?.offsetX, 'x');
  const yAnimation = companionSvgTranslateAnimation(channel?.offsetY, 'y');
  return `<g id="ghostling-${escapeXml(groupKey)}">${xAnimation}${yAnimation}${markup}</g>`;
}

function companionAnimationFrames(relativePath: string | null | undefined) {
  const animation = companionAssetAnimation(relativePath);
  const frames = Array.isArray(animation.frames) ? animation.frames : [];
  return {
    animation,
    frames: frames.length
      ? frames
      : [{
        x: 0,
        y: 0,
        width: animation.frameWidth || COMPANION_CANVAS_SIZE,
        height: animation.frameHeight || COMPANION_CANVAS_SIZE,
        durationMs: 1000,
        offsetX: 0,
        offsetY: 0,
        sourceWidth: animation.frameWidth || COMPANION_CANVAS_SIZE,
        sourceHeight: animation.frameHeight || COMPANION_CANVAS_SIZE,
      }],
  };
}

function companionStaticSliceMarkup(
  relativePath: string | null | undefined,
  slice: {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    targetX: number;
    targetY: number;
    targetWidth: number;
    targetHeight: number;
  },
) {
  const dataUri = companionAssetDataUri(relativePath);
  if (!dataUri) return '';

  const { animation, frames } = companionAnimationFrames(relativePath);
  const frame = frames[0]!;
  const sourceWidth = Math.max(1, Math.trunc(slice.sourceWidth));
  const sourceHeight = Math.max(1, Math.trunc(slice.sourceHeight));
  const sheetWidth = Math.max(sourceWidth, Math.trunc(animation.sheetWidth ?? sourceWidth));
  const sheetHeight = Math.max(sourceHeight, Math.trunc(animation.sheetHeight ?? sourceHeight));
  const imageX = (frame.offsetX ?? 0) - frame.x - slice.sourceX;
  const imageY = (frame.offsetY ?? 0) - frame.y - slice.sourceY;

  return (
    `<svg x="${slice.targetX}" y="${slice.targetY}" width="${slice.targetWidth}" height="${slice.targetHeight}" `
    + `viewBox="0 0 ${sourceWidth} ${sourceHeight}" preserveAspectRatio="none">`
    + `<image href="${dataUri}" x="${imageX}" y="${imageY}" width="${sheetWidth}" height="${sheetHeight}" preserveAspectRatio="none" />`
    + '</svg>'
  );
}

function companionAnimatedSliceMarkup(
  relativePath: string | null | undefined,
  slice: {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    targetX: number;
    targetY: number;
    targetWidth: number;
    targetHeight: number;
  },
): string {
  const dataUri = companionAssetDataUri(relativePath);
  if (!dataUri) return '';

  const { animation, frames } = companionAnimationFrames(relativePath);
  const sourceWidth = Math.max(1, Math.trunc(slice.sourceWidth));
  const sourceHeight = Math.max(1, Math.trunc(slice.sourceHeight));

  if (animation.mode !== 'spritesheet' || animation.frameCount <= 1 || frames.length <= 1) {
    return companionStaticSliceMarkup(relativePath, slice);
  }

  const sheetWidth = Math.max(sourceWidth, Math.trunc(animation.sheetWidth ?? sourceWidth));
  const sheetHeight = Math.max(sourceHeight, Math.trunc(animation.sheetHeight ?? sourceHeight));
  const totalDurationMs = Math.max(1, frames.reduce((sum, frame) => sum + Math.max(1, Math.trunc(frame.durationMs ?? 100)), 0));

  let elapsedMs = 0;
  const keyTimes: string[] = [];
  const xValues: string[] = [];
  const yValues: string[] = [];
  for (const frame of frames) {
    keyTimes.push((elapsedMs / totalDurationMs).toFixed(4));
    xValues.push(String((Math.trunc(frame.offsetX ?? 0) - Math.trunc(frame.x ?? 0) - Math.trunc(slice.sourceX ?? 0))));
    yValues.push(String((Math.trunc(frame.offsetY ?? 0) - Math.trunc(frame.y ?? 0) - Math.trunc(slice.sourceY ?? 0))));
    elapsedMs += Math.max(1, Math.trunc(frame.durationMs ?? 100));
  }

  keyTimes.push('1');
  xValues.push(xValues[xValues.length - 1] ?? '0');
  yValues.push(yValues[yValues.length - 1] ?? '0');
  const duration = Math.max(totalDurationMs / 1000, 0.1);
  const repeatCount = animation.loop ? 'indefinite' : '1';

  return (
    `<svg x="${slice.targetX}" y="${slice.targetY}" width="${slice.targetWidth}" height="${slice.targetHeight}" `
    + `viewBox="0 0 ${sourceWidth} ${sourceHeight}" preserveAspectRatio="none">`
    + `<image href="${dataUri}" x="${xValues[0]}" y="${yValues[0]}" width="${sheetWidth}" height="${sheetHeight}" preserveAspectRatio="none">`
    + `<animate attributeName="x" values="${xValues.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${duration.toFixed(3)}s" repeatCount="${repeatCount}" calcMode="discrete" />`
    + `<animate attributeName="y" values="${yValues.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${duration.toFixed(3)}s" repeatCount="${repeatCount}" calcMode="discrete" />`
    + '</image>'
    + '</svg>'
  );
}

function renderEmptyCompanionSvg(options: {
  displayName: string;
  subtitle?: string | null;
  card?: boolean;
  animated?: boolean;
}) {
  const title = options.displayName || 'Ghosted Ghostling';
  const subtitleText = options.subtitle || 'Ghostling vault';

  if (options.card) {
    const bob = options.animated
      ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="4.2s" repeatCount="indefinite" />'
      : '';
    const shadow = options.animated
      ? '<ellipse cx="123" cy="255" rx="38" ry="10" fill="rgba(10, 8, 18, 0.28)"><animate attributeName="rx" values="38;34;38" dur="4.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.28;0.18;0.28" dur="4.2s" repeatCount="indefinite" /></ellipse>'
      : '<ellipse cx="123" cy="255" rx="38" ry="10" fill="rgba(10, 8, 18, 0.24)" />';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">'
      + '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0a11" /><stop offset="100%" stop-color="#1b1730" /></linearGradient></defs>'
      + '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
      + '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
      + '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
      + shadow
      + '<g transform="translate(47 53) scale(4.8)"><g>'
      + bob
      + '<rect x="8" y="7" width="16" height="16" rx="8" fill="rgba(226, 235, 255, 0.14)" stroke="#5a6b93" />'
      + '<circle cx="13" cy="15" r="1.2" fill="#d8e5ff" opacity="0.65" />'
      + '<circle cx="19" cy="15" r="1.2" fill="#d8e5ff" opacity="0.65" />'
      + '<path d="M13 19 C15 21 17 21 19 19" fill="none" stroke="#9bb6ff" stroke-width="1.1" stroke-linecap="round" />'
      + '</g></g>'
      + '<text x="244" y="106" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">GHOSTED GHOSTLING</text>'
      + renderCompanionCardCopy({
        title,
        subtitle: subtitleText,
        body: 'No default Ghostling ships with the site. Upload a base and cosmetics from the admin vault to bring this stage to life.',
      })
      + '<rect x="244" y="250" width="182" height="34" rx="17" fill="#16132a" stroke="#312759" />'
      + '<text x="262" y="271" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14">awaiting uploaded art</text>'
      + '</svg>'
    );
  }

  const bob = options.animated
    ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="4.2s" repeatCount="indefinite" />'
    : '';
  const shadow = options.animated
    ? '<ellipse cx="80" cy="123" rx="26" ry="7" fill="rgba(10, 8, 18, 0.24)"><animate attributeName="rx" values="26;22;26" dur="4.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.24;0.14;0.24" dur="4.2s" repeatCount="indefinite" /></ellipse>'
    : '<ellipse cx="80" cy="123" rx="26" ry="7" fill="rgba(10, 8, 18, 0.18)" />';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'
    + '<defs><linearGradient id="empty-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0d0b16" /><stop offset="100%" stop-color="#1a1630" /></linearGradient></defs>'
    + '<rect width="160" height="160" rx="30" fill="url(#empty-bg)" />'
    + shadow
    + '<g transform="translate(0 0)">'
    + bob
    + '<rect x="48" y="34" width="64" height="64" rx="24" fill="rgba(226, 235, 255, 0.12)" stroke="#4b5b86" />'
    + '<circle cx="68" cy="62" r="4" fill="#d8e5ff" opacity="0.68" />'
    + '<circle cx="92" cy="62" r="4" fill="#d8e5ff" opacity="0.68" />'
    + '<path d="M68 79 C74 84 86 84 92 79" fill="none" stroke="#9bb6ff" stroke-width="4" stroke-linecap="round" />'
    + '</g>'
    + '<text x="80" y="145" fill="#cdd8ff" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">No base uploaded yet</text>'
    + '</svg>'
  );
}

function resolveCompanionLayers(db: Database, loadout: CompanionLoadout) {
  const scene = resolveCompanionLayerScene(db, loadout);
  const markup = scene.layers
    .flatMap((layer) => layer.slices.map((slice) => companionStaticSliceMarkup(layer.relativePath, slice)))
    .filter(Boolean)
    .join('');
  return {
    scene,
    markup,
  };
}

function userDisplayName(user: CompanionRenderUserRow) {
  return user.global_name || user.username;
}

function getRenderOwnerByUserRef(db: Database, userRef: string) {
  if (!userRef) return null;
  if (/^\d+$/.test(userRef)) {
    return db.prepare(`
      SELECT id, discord_id, username, global_name
      FROM users
      WHERE id = ?
    `).get(Number(userRef)) as CompanionRenderUserRow | undefined;
  }

  return db.prepare(`
    SELECT id, discord_id, username, global_name
    FROM users
    WHERE discord_id = ?
  `).get(userRef) as CompanionRenderUserRow | undefined;
}

export function resolveCompanionRenderRequest(
  db: Database,
  options: {
    userRef: string;
    previewSlug: string;
    baseOnly?: boolean;
    currentUser?: CompanionUserRow | null;
  },
) {
  const loadout = Object.fromEntries(
    COMPANION_SLOT_ORDER.map((slot) => [slot, null]),
  ) as CompanionLoadout;
  let display = 'Ghosted Ghostling';
  let subtitle = 'Preview';
  let ownerId: number | null = null;

  if (options.baseOnly) {
    subtitle = 'Ghostling vault';
  } else if (options.userRef) {
    const row = getRenderOwnerByUserRef(db, options.userRef);
    if (!row) {
      throw new AppError('Companion owner not found.', 404);
    }
    Object.assign(loadout, companionLoadoutMap(db, row.id));
    display = userDisplayName(row);
    subtitle = `@${row.username}`;
    ownerId = row.id;
  } else if (options.currentUser) {
    Object.assign(loadout, companionLoadoutMap(db, options.currentUser.id));
    display = userDisplayName({
      ...options.currentUser,
      discord_id: '',
    });
    subtitle = `@${options.currentUser.username}`;
    ownerId = options.currentUser.id;
  }

  if (options.previewSlug) {
    const item = companionCatalogAnyRow(db, options.previewSlug);
    if (!item) {
      throw new AppError('Preview item not found.', 404);
    }
    loadout[item.slot_key] = options.previewSlug;
    if (!options.userRef) {
      display = item.name;
      subtitle = COMPANION_SLOT_LABELS[item.slot_key] ?? item.slot_key;
    }
  }

  return { loadout, display, subtitle, ownerId };
}

export function renderCompanionSvg(
  db: Database,
  loadout: CompanionLoadout,
  options: {
    displayName: string;
    subtitle?: string | null;
    card?: boolean;
    discord?: boolean;
    discordProfile?: CompanionDiscordCardProfile | null;
  },
) {
  const { scene, markup } = resolveCompanionLayers(db, loadout);
  if (!markup.trim()) {
    return renderEmptyCompanionSvg({
      displayName: options.displayName,
      subtitle: options.subtitle,
      card: options.card,
      animated: false,
    });
  }

  if (options.card) {
    if (options.discord) {
      return renderDiscordCompanionCard({
        sceneWidth: scene.width,
        sceneHeight: scene.height,
        layersMarkup: markup,
        title: options.displayName,
        subtitle: options.subtitle || 'Ghosted Ghostling',
        animated: false,
        profile: options.discordProfile ?? null,
      });
    }

    const cardScale = 4.8 * (COMPANION_CANVAS_SIZE / Math.max(scene.width, scene.height));
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" shape-rendering="crispEdges" style="image-rendering:pixelated">'
      + '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0a11" /><stop offset="100%" stop-color="#1b1730" /></linearGradient></defs>'
      + '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
      + '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
      + '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
      + `<g transform="translate(47 53) scale(${cardScale.toFixed(4)})">`
      + markup
      + '</g>'
      + '<text x="244" y="106" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">GHOSTED GHOSTLING</text>'
      + renderCompanionCardCopy({
        title: options.displayName,
        subtitle: options.subtitle || 'Ghosted Ghostling',
        body: 'Spend points, unlock cosmetics, and share your tiny ghost anywhere Ghosted shows up.',
      })
      + '<rect x="244" y="250" width="170" height="34" rx="17" fill="#16132a" stroke="#312759" />'
      + '<text x="262" y="271" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14">discord-ready share card</text>'
      + '</svg>'
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 ${scene.width} ${scene.height}" shape-rendering="crispEdges" style="image-rendering:pixelated">`
    + markup
    + '</svg>'
  );
}

export function renderAnimatedCompanionSvg(
  db: Database,
  loadout: CompanionLoadout,
  options: {
    displayName: string;
    subtitle?: string | null;
    card?: boolean;
    discord?: boolean;
    discordProfile?: CompanionDiscordCardProfile | null;
  },
) {
  const scene = resolveCompanionLayerScene(db, loadout);
  const baseConfig = scene.baseConfig;

  const groupedMarkup: Record<string, string[]> = { root: [], body: [], head: [] };
  for (const layer of scene.layers) {
    for (const slice of layer.slices) {
      const markup = companionAnimatedSliceMarkup(layer.relativePath, slice);
      if (markup) {
        const motionGroup = slice.motionGroup || layer.motionGroup || (layer.slot ? baseConfig.rig.slotGroups[layer.slot] ?? null : null);
        const groupKey = String(motionGroup || 'root');
        groupedMarkup[groupKey] ??= [];
        groupedMarkup[groupKey]!.push(markup);
      }
    }
  }

  const hasLayers = Object.values(groupedMarkup).some((markups) => markups.length > 0);
  if (!hasLayers) {
    return renderEmptyCompanionSvg({
      displayName: options.displayName,
      subtitle: options.subtitle,
      card: options.card,
      animated: true,
    });
  }

  const motionChannels = baseConfig.rig.motionChannels;
  const headMarkup = companionSvgMotionGroupMarkup('head', (groupedMarkup.head ?? []).join(''), motionChannels.head);
  const bodyMarkup = companionSvgMotionGroupMarkup(
    'body',
    (groupedMarkup.body ?? []).join('') + headMarkup,
    motionChannels.body,
  );
  const otherGroups = Object.entries(groupedMarkup)
    .filter(([groupKey, markups]) => !['root', 'body', 'head'].includes(groupKey) && markups.length > 0)
    .map(([groupKey, markups]) => companionSvgMotionGroupMarkup(groupKey, markups.join(''), motionChannels[groupKey]))
    .join('');
  const layers = companionSvgMotionGroupMarkup(
    'root',
    (groupedMarkup.root ?? []).join('') + otherGroups + bodyMarkup,
    motionChannels.root,
  );
  const shadowDurationMs = Math.max(1, Math.trunc(motionChannels.body?.offsetY?.durationMs ?? 2860));
  const shadowDuration = `${(shadowDurationMs / 1000).toFixed(3)}s`;

  if (options.card) {
    if (options.discord) {
      return renderDiscordCompanionCard({
        sceneWidth: scene.width,
        sceneHeight: scene.height,
        layersMarkup: layers,
        title: options.displayName,
        subtitle: options.subtitle || 'Ghosted Ghostling',
        animated: true,
        shadowDuration,
        profile: options.discordProfile ?? null,
      });
    }

    const cardScale = 4.8 * (COMPANION_CANVAS_SIZE / Math.max(scene.width, scene.height));
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" shape-rendering="crispEdges" style="image-rendering:pixelated">'
      + '<defs>'
      + '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0a11" /><stop offset="100%" stop-color="#1b1730" /></linearGradient>'
      + '</defs>'
      + '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
      + '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
      + '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
      + '<ellipse cx="123" cy="255" rx="44" ry="11" fill="rgba(10, 8, 18, 0.34)">'
      + `<animate attributeName="rx" values="44;40;44" dur="${shadowDuration}" repeatCount="indefinite" />`
      + `<animate attributeName="opacity" values="0.34;0.24;0.34" dur="${shadowDuration}" repeatCount="indefinite" />`
      + '</ellipse>'
      + `<g transform="translate(47 53) scale(${cardScale.toFixed(4)})">`
      + layers
      + '</g>'
      + '<text x="244" y="106" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">GHOSTED GHOSTLING</text>'
      + renderCompanionCardCopy({
        title: options.displayName,
        subtitle: options.subtitle || 'Ghosted Ghostling',
        body: 'Animated SVG export with layered Ghostling motion tuned to match the hall.',
      })
      + '<rect x="244" y="250" width="182" height="34" rx="17" fill="#16132a" stroke="#312759" />'
      + '<text x="262" y="271" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14">animated svg share card</text>'
      + '</svg>'
    );
  }

  const shadowRx = scene.width * 0.265625;
  const shadowRy = scene.height * 0.075;
  const shadowMinRx = shadowRx * (7.9 / 8.5);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 ${scene.width} ${scene.height}" shape-rendering="crispEdges" style="image-rendering:pixelated">`
    + `<ellipse cx="${scene.width / 2}" cy="${scene.height - 3}" rx="${shadowRx}" ry="${shadowRy}" fill="rgba(10, 8, 18, ${COMPANION_DEFAULT_SHADOW_OPACITY + 0.12})">`
    + `<animate attributeName="rx" values="${shadowRx};${shadowMinRx};${shadowRx}" dur="${shadowDuration}" repeatCount="indefinite" />`
    + `<animate attributeName="opacity" values="${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.12).toFixed(2)};${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.02).toFixed(2)};${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.12).toFixed(2)}" dur="${shadowDuration}" repeatCount="indefinite" />`
    + '</ellipse>'
    + layers
    + '</svg>'
  );
}

export async function renderRequestedCompanionSvg(
  db: Database,
  options: {
    animated: boolean;
    userRef: string;
    previewSlug: string;
    card: boolean;
    discord?: boolean;
    baseOnly?: boolean;
    currentUser?: CompanionUserRow | null;
  },
) {
  const { loadout, display, subtitle, ownerId } = resolveCompanionRenderRequest(db, {
    userRef: options.userRef,
    previewSlug: options.previewSlug,
    baseOnly: options.baseOnly,
    currentUser: options.currentUser,
  });
  const discordProfile = options.card && options.discord
    ? await resolveCompanionDiscordCardProfile(db, ownerId)
    : null;

  return options.animated
    ? renderAnimatedCompanionSvg(db, loadout, {
      displayName: display,
      subtitle,
      card: options.card,
      discord: options.discord,
      discordProfile,
    })
    : renderCompanionSvg(db, loadout, {
      displayName: display,
      subtitle,
      card: options.card,
      discord: options.discord,
      discordProfile,
    });
}
