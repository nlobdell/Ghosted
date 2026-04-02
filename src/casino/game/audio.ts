import { AUDIO_ASSETS } from './assets';

type AudioKey = keyof typeof AUDIO_ASSETS;
type PlayOptions = {
  playbackRate?: number;
  volume?: number;
};

export class SlotAudio {
  private armed = false;
  private pool = new Map<AudioKey, HTMLAudioElement[]>();

  arm() {
    if (this.armed) return;
    this.armed = true;
    (Object.keys(AUDIO_ASSETS) as AudioKey[]).forEach((key) => {
      const audio = new Audio(AUDIO_ASSETS[key].url);
      audio.preload = 'auto';
      this.pool.set(key, [audio]);
    });
  }

  play(key: AudioKey, options: PlayOptions = {}) {
    this.arm();
    const stack = this.pool.get(key);
    if (!stack?.length) return;

    const source = stack.find((audio) => audio.paused || audio.ended) || new Audio(AUDIO_ASSETS[key].url);
    if (!stack.includes(source)) {
      source.preload = 'auto';
      stack.push(source);
    }

    source.currentTime = 0;
    source.playbackRate = options.playbackRate ?? 1;
    source.volume = options.volume ?? 0.6;
    void source.play().catch(() => {});
  }
}
