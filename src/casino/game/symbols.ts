const SYMBOL_META: Record<string, { emoji: string; glyph: string; icon: string; label: string; tint: number }> = {
  coin: { emoji: '\u{1FA99}', glyph: 'CO', icon: 'coin', label: 'Coin', tint: 0xffd166 },
  crown: { emoji: '\u{1F451}', glyph: 'CR', icon: 'crown', label: 'Crown', tint: 0xffe29a },
  gem: { emoji: '\u{1F48E}', glyph: 'GM', icon: 'gem', label: 'Gem', tint: 0x75e3ff },
  ghost: { emoji: '\u{1F47B}', glyph: 'GH', icon: 'ghost', label: 'Ghost', tint: 0xdce7ff },
  lantern: { emoji: '\u{1F3EE}', glyph: 'LN', icon: 'lantern', label: 'Lantern', tint: 0xff8c42 },
  mask: { emoji: '\u{1F3AD}', glyph: 'MK', icon: 'mask', label: 'Mask', tint: 0xffa36c },
  moon: { emoji: '\u{1F319}', glyph: 'MN', icon: 'moon', label: 'Moon', tint: 0x9bc9ff },
  rune: { emoji: '\u2728', glyph: 'RN', icon: 'rune', label: 'Rune', tint: 0xd6b8ff },
  scatter: { emoji: '\u{1F52E}', glyph: 'SC', icon: 'scatter', label: 'Scatter', tint: 0x8cffc1 },
  wild: { emoji: '\u{1F0CF}', glyph: 'WD', icon: 'wild', label: 'Wild', tint: 0xff5d8f },
};

export function symbolMeta(symbol: string) {
  return SYMBOL_META[symbol] || {
    emoji: '\u2754',
    glyph: String(symbol || '?').slice(0, 2).toUpperCase(),
    icon: 'default',
    label: String(symbol || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    tint: 0xffffff,
  };
}

export function uniqueSymbols(symbols: string[]) {
  return [...new Set(symbols.filter(Boolean))];
}
