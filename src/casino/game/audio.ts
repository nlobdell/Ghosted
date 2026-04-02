export class SlotAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  arm() {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    if (!this.context) {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.08;
      this.master.connect(this.context.destination);
    }

    void this.context.resume();
  }

  playSpinStart() {
    if (!this.ready()) return;
    this.tone(180, 0.09, 'triangle', 0, 0.035, 132);
    this.tone(220, 0.1, 'triangle', 0.08, 0.03, 156);
    this.noise(0.18, 0.02, 0.018);
  }

  playReelStop(index: number) {
    if (!this.ready()) return;
    const base = 250 + index * 34;
    this.tone(base, 0.07, 'square', 0, 0.03, base * 0.92);
    this.tone(base * 1.5, 0.05, 'triangle', 0.015, 0.018, base * 1.35);
  }

  playWin(payout: number) {
    if (!this.ready()) return;
    const bright = payout > 0 ? Math.min(1, payout / 600) : 0.2;
    this.tone(523.25, 0.14, 'triangle', 0, 0.04 + bright * 0.02, 659.25);
    this.tone(659.25, 0.16, 'triangle', 0.08, 0.035 + bright * 0.025, 783.99);
    this.tone(783.99, 0.24, 'sine', 0.16, 0.03 + bright * 0.03, 1046.5);
  }

  playFeatureTrigger() {
    if (!this.ready()) return;
    this.tone(392, 0.22, 'sawtooth', 0, 0.03, 523.25);
    this.tone(523.25, 0.24, 'triangle', 0.06, 0.032, 659.25);
    this.tone(659.25, 0.35, 'sine', 0.14, 0.035, 880);
    this.noise(0.28, 0.03, 0.018);
  }

  playMiss() {
    if (!this.ready()) return;
    this.tone(130.81, 0.1, 'triangle', 0, 0.018, 110);
  }

  private ready() {
    return Boolean(this.context && this.master);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
    gainAmount = 0.03,
    endFrequency = frequency
  ) {
    if (!this.context || !this.master) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  private noise(duration: number, delay = 0, gainAmount = 0.012) {
    if (!this.context || !this.master) return;

    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;

    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    const end = start + duration;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(end + 0.02);
  }
}
