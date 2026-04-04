import coinUrl from '../assets/symbols/coin.svg';
import crownUrl from '../assets/symbols/crown.svg';
import gemUrl from '../assets/symbols/gem.svg';
import ghostUrl from '../assets/symbols/ghost.svg';
import lanternUrl from '../assets/symbols/lantern.svg';
import maskUrl from '../assets/symbols/mask.svg';
import moonUrl from '../assets/symbols/moon.svg';
import runeUrl from '../assets/symbols/rune.svg';
import scatterUrl from '../assets/symbols/scatter.svg';
import wildUrl from '../assets/symbols/wild.svg';

type StaticAssetImport = string | { src: string };

function toAssetUrl(asset: StaticAssetImport): string {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object' && typeof asset.src === 'string') return asset.src;
  throw new Error('Unsupported asset import format.');
}

// Audio served from /public/audio/ to avoid bundler issues with binary assets
const reelStopUrl = '/audio/reel-stop.wav';
const spinStartUrl = '/audio/spin-start.wav';
const featureUrl = '/audio/feature-trigger.wav';
const missUrl = '/audio/miss.wav';
const winUrl = '/audio/win.wav';

export const SYMBOL_TEXTURES = {
  coin: { key: 'symbol-coin', url: toAssetUrl(coinUrl) },
  crown: { key: 'symbol-crown', url: toAssetUrl(crownUrl) },
  gem: { key: 'symbol-gem', url: toAssetUrl(gemUrl) },
  ghost: { key: 'symbol-ghost', url: toAssetUrl(ghostUrl) },
  lantern: { key: 'symbol-lantern', url: toAssetUrl(lanternUrl) },
  mask: { key: 'symbol-mask', url: toAssetUrl(maskUrl) },
  moon: { key: 'symbol-moon', url: toAssetUrl(moonUrl) },
  rune: { key: 'symbol-rune', url: toAssetUrl(runeUrl) },
  scatter: { key: 'symbol-scatter', url: toAssetUrl(scatterUrl) },
  wild: { key: 'symbol-wild', url: toAssetUrl(wildUrl) },
} as const;

export const AUDIO_ASSETS = {
  feature: { key: 'slot-feature', url: featureUrl },
  miss: { key: 'slot-miss', url: missUrl },
  reelStop: { key: 'slot-reel-stop', url: reelStopUrl },
  spinStart: { key: 'slot-spin-start', url: spinStartUrl },
  win: { key: 'slot-win', url: winUrl },
} as const;
