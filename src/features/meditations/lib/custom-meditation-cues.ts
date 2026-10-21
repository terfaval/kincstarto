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
  private openingAudio: HTMLAudioElement | null = null;
  private onOpeningError: (() => void) | null = null;
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

  /** Start the dedicated signature synchronously from the tap/click on iOS.
   * HTMLMediaElement.play() is invoked BEFORE any asynchronous work, so Safari
   * does not lose its user activation while fetching/decoding the MP3.
   */
  playOpening(onMissing: () => void = () => {}) {
    if (this.disposed) { onMissing(); return; }
    this.stopOpening();
    // Unlock stage-cue Web Audio in the same gesture as the opening MP3.
    if (this.context) void this.context.resume().catch(onMissing);
    this.onOpeningError = onMissing;
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(CUSTOM_OPENING_PATH);
      audio.preload = "auto";
      audio.volume = 0.7;
    } catch {
      this.onOpeningError = null;
      onMissing();
      return;
    }
    this.openingAudio = audio;
    const fail = () => {
      if (this.openingAudio !== audio) return;
      this.stopOpening();
      onMissing();
    };
    audio.onerror = fail;
    audio.onended = () => {
      if (this.openingAudio === audio) this.stopOpening();
    };
    // Safari must receive play() in the initiating user gesture.
    void audio.play().catch(fail);
  }

  private stopOpening() {
    const audio = this.openingAudio;
    this.openingAudio = null;
    this.onOpeningError = null;
    if (!audio) return;
    audio.onerror = null;
    audio.onended = null;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* asset may not have loaded */ }
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

  pause() {
    this.openingAudio?.pause();
    if (this.context && !this.disposed) void this.context.suspend().catch(() => {});
  }
  resume() {
    // Called from the user's Resume tap; keep the opening cue in sync.
    const audio = this.openingAudio;
    if (audio && audio.paused && !audio.ended) {
      const onError = this.onOpeningError;
      void audio.play().catch(() => {
        if (this.openingAudio === audio) {
          this.stopOpening();
          onError?.();
        }
      });
    }
    if (this.context && !this.disposed) void this.context.resume().catch(() => {});
  }

  stopSources() {
    this.stopOpening();
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
