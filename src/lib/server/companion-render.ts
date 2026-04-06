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
  companionAnimationSourceDimensions,
  companionAssetAnimation,
  companionAssetDataUri,
  companionAssetRig,
  companionBaseAssetPath,
  resolveCompanionLayerSpecs,
} from '@/lib/server/companion-storage';

type CompanionLoadout = Record<CompanionSlotKey, string | null>;

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

function companionLayerImage(relativePath: string | null | undefined) {
  const dataUri = companionAssetDataUri(relativePath);
  if (!dataUri) return '';

  const animation = companionAssetAnimation(relativePath);
  const frames = Array.isArray(animation.frames) ? animation.frames : [];
  if (animation.mode === 'spritesheet' && frames.length > 0) {
    const frame = frames[0]!;
    const sourceWidth = Math.max(1, Math.trunc(frame.sourceWidth ?? frame.width ?? COMPANION_CANVAS_SIZE));
    const sourceHeight = Math.max(1, Math.trunc(frame.sourceHeight ?? frame.height ?? COMPANION_CANVAS_SIZE));
    const offsetX = Math.trunc(frame.offsetX ?? 0);
    const offsetY = Math.trunc(frame.offsetY ?? 0);
    const frameX = Math.trunc(frame.x ?? 0);
    const frameY = Math.trunc(frame.y ?? 0);
    const sheetWidth = Math.max(sourceWidth, Math.trunc(animation.sheetWidth ?? sourceWidth));
    const sheetHeight = Math.max(sourceHeight, Math.trunc(animation.sheetHeight ?? sourceHeight));
    return (
      `<svg x="0" y="0" width="${COMPANION_CANVAS_SIZE}" height="${COMPANION_CANVAS_SIZE}" `
      + `viewBox="0 0 ${sourceWidth} ${sourceHeight}" preserveAspectRatio="none">`
      + `<image href="${dataUri}" x="${offsetX - frameX}" y="${offsetY - frameY}" `
      + `width="${sheetWidth}" height="${sheetHeight}" preserveAspectRatio="none" />`
      + '</svg>'
    );
  }

  return `<image href="${dataUri}" x="0" y="0" width="${COMPANION_CANVAS_SIZE}" height="${COMPANION_CANVAS_SIZE}" preserveAspectRatio="none" />`;
}

function companionAnimatedLayerMarkup(relativePath: string | null | undefined, layerId: string): [string, string] {
  const dataUri = companionAssetDataUri(relativePath);
  if (!dataUri) return ['', ''];

  const animation = companionAssetAnimation(relativePath);
  const frames = Array.isArray(animation.frames) ? animation.frames : [];
  if (animation.mode !== 'spritesheet' || animation.frameCount <= 1 || frames.length <= 1) {
    return ['', `<image href="${dataUri}" x="0" y="0" width="${COMPANION_CANVAS_SIZE}" height="${COMPANION_CANVAS_SIZE}" preserveAspectRatio="none" />`];
  }

  const clipId = `clip-${layerId}`;
  const frameSourceWidth = Math.max(...frames.map((frame) => Math.trunc(frame.sourceWidth ?? COMPANION_CANVAS_SIZE)));
  const frameSourceHeight = Math.max(...frames.map((frame) => Math.trunc(frame.sourceHeight ?? COMPANION_CANVAS_SIZE)));
  const scaleX = COMPANION_CANVAS_SIZE / Math.max(1, frameSourceWidth);
  const scaleY = COMPANION_CANVAS_SIZE / Math.max(1, frameSourceHeight);
  const sheetWidth = Math.max(Math.trunc(animation.sheetWidth ?? frameSourceWidth), frameSourceWidth) * scaleX;
  const sheetHeight = Math.max(Math.trunc(animation.sheetHeight ?? frameSourceHeight), frameSourceHeight) * scaleY;
  const totalDurationMs = Math.max(1, frames.reduce((sum, frame) => sum + Math.max(1, Math.trunc(frame.durationMs ?? 100)), 0));

  let elapsedMs = 0;
  const keyTimes: string[] = [];
  const xValues: string[] = [];
  const yValues: string[] = [];
  for (const frame of frames) {
    keyTimes.push((elapsedMs / totalDurationMs).toFixed(4));
    xValues.push(String((Math.trunc(frame.offsetX ?? 0) - Math.trunc(frame.x ?? 0)) * scaleX));
    yValues.push(String((Math.trunc(frame.offsetY ?? 0) - Math.trunc(frame.y ?? 0)) * scaleY));
    elapsedMs += Math.max(1, Math.trunc(frame.durationMs ?? 100));
  }

  keyTimes.push('1');
  xValues.push(xValues[xValues.length - 1] ?? '0');
  yValues.push(yValues[yValues.length - 1] ?? '0');
  const duration = Math.max(totalDurationMs / 1000, 0.1);
  const repeatCount = animation.loop ? 'indefinite' : '1';

  const defs = `<clipPath id="${clipId}"><rect x="0" y="0" width="${COMPANION_CANVAS_SIZE}" height="${COMPANION_CANVAS_SIZE}" /></clipPath>`;
  const markup = (
    `<g clip-path="url(#${clipId})">`
    + `<image href="${dataUri}" x="${xValues[0]}" y="${yValues[0]}" width="${sheetWidth.toFixed(4)}" height="${sheetHeight.toFixed(4)}" preserveAspectRatio="none">`
    + `<animate attributeName="x" values="${xValues.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${duration.toFixed(3)}s" repeatCount="${repeatCount}" calcMode="discrete" />`
    + `<animate attributeName="y" values="${yValues.join(';')}" keyTimes="${keyTimes.join(';')}" dur="${duration.toFixed(3)}s" repeatCount="${repeatCount}" calcMode="discrete" />`
    + '</image>'
    + '</g>'
  );
  return [defs, markup];
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
  return resolveCompanionLayerSpecs(db, loadout)
    .map((layer) => companionLayerImage(layer.relativePath))
    .filter(Boolean);
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
    currentUser?: CompanionUserRow | null;
  },
) {
  const loadout = Object.fromEntries(
    COMPANION_SLOT_ORDER.map((slot) => [slot, null]),
  ) as CompanionLoadout;
  let display = 'Ghosted Ghostling';
  let subtitle = 'Preview';

  if (options.userRef) {
    const row = getRenderOwnerByUserRef(db, options.userRef);
    if (!row) {
      throw new AppError('Companion owner not found.', 404);
    }
    Object.assign(loadout, companionLoadoutMap(db, row.id));
    display = userDisplayName(row);
    subtitle = `@${row.username}`;
  } else if (options.currentUser) {
    Object.assign(loadout, companionLoadoutMap(db, options.currentUser.id));
    display = userDisplayName({
      ...options.currentUser,
      discord_id: '',
    });
    subtitle = `@${options.currentUser.username}`;
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

  return { loadout, display, subtitle };
}

export function renderCompanionSvg(
  db: Database,
  loadout: CompanionLoadout,
  options: {
    displayName: string;
    subtitle?: string | null;
    card?: boolean;
  },
) {
  const layers = resolveCompanionLayers(db, loadout).join('');
  if (!layers.trim()) {
    return renderEmptyCompanionSvg({
      displayName: options.displayName,
      subtitle: options.subtitle,
      card: options.card,
      animated: false,
    });
  }

  if (options.card) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" shape-rendering="crispEdges" style="image-rendering:pixelated">'
      + '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0a11" /><stop offset="100%" stop-color="#1b1730" /></linearGradient></defs>'
      + '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
      + '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
      + '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
      + '<g transform="translate(47 53) scale(4.8)">'
      + layers
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
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 32 32" shape-rendering="crispEdges" style="image-rendering:pixelated">'
    + layers
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
  },
) {
  const basePath = companionBaseAssetPath(db);
  const baseAnimation = companionAssetAnimation(basePath);
  const [baseSourceWidth, baseSourceHeight] = companionAnimationSourceDimensions(baseAnimation);
  const baseRig = companionAssetRig(basePath, baseSourceWidth, baseSourceHeight);

  const layerDefs: string[] = [];
  const groupedMarkup: Record<string, string[]> = { root: [], body: [], head: [] };
  for (const layer of resolveCompanionLayerSpecs(db, loadout)) {
    const [defs, markup] = companionAnimatedLayerMarkup(layer.relativePath, String(layer.key));
    if (defs) layerDefs.push(defs);
    if (markup) {
      const motionGroup = layer.motionGroup || (layer.slot ? baseRig.slotGroups[layer.slot] ?? null : null);
      const groupKey = String(motionGroup || 'root');
      groupedMarkup[groupKey] ??= [];
      groupedMarkup[groupKey]!.push(markup);
    }
  }

  const defs = layerDefs.join('');
  const hasLayers = Object.values(groupedMarkup).some((markups) => markups.length > 0);
  if (!hasLayers) {
    return renderEmptyCompanionSvg({
      displayName: options.displayName,
      subtitle: options.subtitle,
      card: options.card,
      animated: true,
    });
  }

  const motionChannels = baseRig.motionChannels;
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
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" shape-rendering="crispEdges" style="image-rendering:pixelated">'
      + '<defs>'
      + defs
      + '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0a11" /><stop offset="100%" stop-color="#1b1730" /></linearGradient>'
      + '</defs>'
      + '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
      + '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
      + '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
      + '<ellipse cx="123" cy="255" rx="44" ry="11" fill="rgba(10, 8, 18, 0.34)">'
      + `<animate attributeName="rx" values="44;40;44" dur="${shadowDuration}" repeatCount="indefinite" />`
      + `<animate attributeName="opacity" values="0.34;0.24;0.34" dur="${shadowDuration}" repeatCount="indefinite" />`
      + '</ellipse>'
      + '<g transform="translate(47 53) scale(4.8)">'
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

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 32 32" shape-rendering="crispEdges" style="image-rendering:pixelated">'
    + '<defs>'
    + defs
    + '</defs>'
    + `<ellipse cx="16" cy="29" rx="8.5" ry="2.4" fill="rgba(10, 8, 18, ${COMPANION_DEFAULT_SHADOW_OPACITY + 0.12})">`
    + `<animate attributeName="rx" values="8.5;7.9;8.5" dur="${shadowDuration}" repeatCount="indefinite" />`
    + `<animate attributeName="opacity" values="${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.12).toFixed(2)};${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.02).toFixed(2)};${(COMPANION_DEFAULT_SHADOW_OPACITY + 0.12).toFixed(2)}" dur="${shadowDuration}" repeatCount="indefinite" />`
    + '</ellipse>'
    + layers
    + '</svg>'
  );
}

export function renderRequestedCompanionSvg(
  db: Database,
  options: {
    animated: boolean;
    userRef: string;
    previewSlug: string;
    card: boolean;
    currentUser?: CompanionUserRow | null;
  },
) {
  const { loadout, display, subtitle } = resolveCompanionRenderRequest(db, {
    userRef: options.userRef,
    previewSlug: options.previewSlug,
    currentUser: options.currentUser,
  });

  return options.animated
    ? renderAnimatedCompanionSvg(db, loadout, {
      displayName: display,
      subtitle,
      card: options.card,
    })
    : renderCompanionSvg(db, loadout, {
      displayName: display,
      subtitle,
      card: options.card,
    });
}
