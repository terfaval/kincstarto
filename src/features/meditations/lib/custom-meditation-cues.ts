import { CUSTOM_OPENING_PATH, getCustomCuePath, type CustomCueId } from "./custom-meditation-types";

/**
 * A one-shot Web Audio player, deliberately separate from the looping reader engine.
 * Creation and playOpening() happen inside the user's Start click to unlock iOS audio.
 * The dedicated file is reserved for the start only: never a stage option.
 */
export class CustomMeditationCues {
  private context: AudioContext | null = null;
  private cache = new Map<string, Promise<AudioBuffer | null>>();
  private sources = new Set<AudioScheduledSourceNode>();
  private generation = 0;
  private disposed = false;

  constructor() {
    try {
      this.context = typeof AudioContext !== "undefined" ? new AudioContext() : null;
    } catch {
      this.context = null;
    }
  }

  get supported() { return this.context !== null; }

  /** The exclusive opening signature is played once for Start/Restart. */
  async playOpening(onMissing: () => void = () => {}) {
    const context = this.context;
    if (!context || this.disposed) { onMissing(); return; }
    const token = this.generation;
    // Resume inside the user's click before awaiting the file load.
    try { await context.resume(); } catch { onMissing(); return; }
    const buffer = await this.load(CUSTOM_OPENING_PATH);
    if (this.disposed || token !== this.generation) return;
    if (!buffer) { onMissing(); return; }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = 0.7;
    source.connect(gain);
    gain.connect(context.destination);
    this.track(source);
    source.start();
  }

  prepare(cueIds: (CustomCueId | null)[]) {
    for (const cueId of cueIds) if (cueId) void this.load(getCustomCuePath(cueId));
  }

  private load(path: string): Promise<AudioBuffer | null> {
    const existing = this.cache.get(path);
    if (existing) return existing;
    const context = this.context;
    const promise = (async () => {
      if (!context) return null;
      try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })();
    this.cache.set(path, promise);
    return promise;
  }

  private track(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.addEventListener("ended", () => this.sources.delete(source), { once: true });
  }

  /** Earlier cue tails are cancelled when the next boundary arrives. */
  async playStageCue(id: CustomCueId | null, repeats: number, onDone: () => void, onMissing: () => void) {
    this.stopSources();
    const token = this.generation;
    if (!id) { onDone(); return; }
    const buffer = await this.load(getCustomCuePath(id));
    if (this.disposed || token !== this.generation) return;
    const context = this.context;
    if (!buffer || !context) {
      onMissing();
      onDone();
      return;
    }
    const count = Math.max(1, Math.min(8, Math.trunc(repeats)));
    const intervalSec = buffer.duration + 0.65;
    const start = context.currentTime + 0.03;
    const cueGain = context.createGain();
    cueGain.gain.value = 0.7;
    cueGain.connect(context.destination);
    for (let index = 0; index < count; index++) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(cueGain);
      this.track(source);
      if (index === count - 1) {
        source.addEventListener("ended", () => {
          if (!this.disposed && token === this.generation) onDone();
        }, { once: true });
      }
      source.start(start + index * intervalSec);
    }
  }

  pause() { if (this.context && !this.disposed) void this.context.suspend().catch(() => {}); }
  resume() { if (this.context && !this.disposed) void this.context.resume().catch(() => {}); }

  stopSources() {
    this.generation++;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* already ended */ }
    }
    this.sources.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSources();
    if (this.context) void this.context.close().catch(() => {});
  }
}
