import { SYMBOL_TEXTURES } from './assets';

type WinEffect = 'coin' | 'crown' | 'gem' | 'ghost' | 'lantern' | 'mask' | 'moon' | 'rune' | 'scatter' | 'wild' | 'default';

const SYMBOL_META: Record<string, { emoji: string; glyph: string; label: string; textureKey: string; tint: number; winEffect: WinEffect }> = {
  coin: { emoji: '\u{1FA99}', glyph: 'CO', label: 'Coin', textureKey: SYMBOL_TEXTURES.coin.key, tint: 0xffd166, winEffect: 'coin' },
  crown: { emoji: '\u{1F451}', glyph: 'CR', label: 'Crown', textureKey: SYMBOL_TEXTURES.crown.key, tint: 0xffe29a, winEffect: 'crown' },
  gem: { emoji: '\u{1F48E}', glyph: 'GM', label: 'Gem', textureKey: SYMBOL_TEXTURES.gem.key, tint: 0x75e3ff, winEffect: 'gem' },
  ghost: { emoji: '\u{1F47B}', glyph: 'GH', label: 'Ghost', textureKey: SYMBOL_TEXTURES.ghost.key, tint: 0xdce7ff, winEffect: 'ghost' },
  lantern: { emoji: '\u{1F3EE}', glyph: 'LN', label: 'Lantern', textureKey: SYMBOL_TEXTURES.lantern.key, tint: 0xff8c42, winEffect: 'lantern' },
  mask: { emoji: '\u{1F3AD}', glyph: 'MK', label: 'Mask', textureKey: SYMBOL_TEXTURES.mask.key, tint: 0xffa36c, winEffect: 'mask' },
  moon: { emoji: '\u{1F319}', glyph: 'MN', label: 'Moon', textureKey: SYMBOL_TEXTURES.moon.key, tint: 0x9bc9ff, winEffect: 'moon' },
  rune: { emoji: '\u2728', glyph: 'RN', label: 'Rune', textureKey: SYMBOL_TEXTURES.rune.key, tint: 0xd6b8ff, winEffect: 'rune' },
  scatter: { emoji: '\u{1F52E}', glyph: 'SC', label: 'Scatter', textureKey: SYMBOL_TEXTURES.scatter.key, tint: 0x8cffc1, winEffect: 'scatter' },
  wild: { emoji: '\u{1F0CF}', glyph: 'WD', label: 'Wild', textureKey: SYMBOL_TEXTURES.wild.key, tint: 0xff5d8f, winEffect: 'wild' },
};

export function symbolMeta(symbol: string) {
  return SYMBOL_META[symbol] || {
    emoji: '\u2754',
    glyph: String(symbol || '?').slice(0, 2).toUpperCase(),
    label: String(symbol || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    textureKey: SYMBOL_TEXTURES.coin.key,
    tint: 0xffffff,
    winEffect: 'default' as const,
  };
}

export function uniqueSymbols(symbols: string[]) {
  return [...new Set(symbols.filter(Boolean))];
}
