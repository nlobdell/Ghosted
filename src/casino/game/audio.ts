import Phaser from 'phaser';
import { AUDIO_ASSETS } from './assets';

export function preloadSlotAudio(scene: Phaser.Scene) {
  Object.values(AUDIO_ASSETS).forEach((asset) => {
    if (!scene.cache.audio.exists(asset.key)) {
      scene.load.audio(asset.key, asset.url);
    }
  });
}

export function armSceneAudio(scene: Phaser.Scene) {
  const manager = scene.sound as Phaser.Sound.WebAudioSoundManager & { context?: AudioContext };
  const context = manager.context;
  if (context && context.state === 'suspended') {
    void context.resume();
  }
}

export function playSceneSound(scene: Phaser.Scene, key: keyof typeof AUDIO_ASSETS, config: Phaser.Types.Sound.SoundConfig = {}) {
  const asset = AUDIO_ASSETS[key];
  if (!asset || !scene.cache.audio.exists(asset.key)) return;
  scene.sound.play(asset.key, config);
}
