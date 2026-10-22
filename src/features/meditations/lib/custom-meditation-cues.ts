import type { CustomCueId } from "./custom-meditation-types";

/**
 * Audio sprite: seven 7-second recordings, each followed by 2 seconds of
 * silence, then a 90-second virtually silent loop zone. The MP3 is bundled
 * with this module's patch and generated from the user's selected sounds.
 *
 * On iOS, playing a second MP3 after the first ends can be blocked even when
 * it reuses the original Audio element. Keep ONE media file continuously
 * playing after the user-initiated Start tap, and seek within it for cues.
 * Stage boundaries NEVER change src and NEVER invoke play().
 */
const SPRITE_PATH = "/audio/timer/meditation-sprite.mp3";
const CLIP_SECONDS = 7;
const SLOT_SECONDS = 9;
const SILENCE_START = SLOT_SECONDS * 7; // 63s
const SILENCE_END = SILENCE_START + 90;

const CUE_OFFSETS: Record<CustomCueId, number> = {
  bells: SLOT_SECONDS,
  cymbal: SLOT_SECONDS * 2,
  windchime: SLOT_SECONDS * 3,
  "singing-bowl-hit": SLOT_SECONDS * 4,
  "bell-hit-crown-chakra": SLOT_SECONDS * 5,
  "bell-hit-root-chakra": SLOT_SECONDS * 6,
};

type Mode = "idle" | "opening" | "silent" | "cue";
type CuePlayback = { start: number; end: number; remaining: number; done: () => void; missing: () => void };

export class CustomMeditationCues {
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: Mode = "idle";
  private activeCue: CuePlayback | null = null;
  private openingMissing: (() => void) | null = null;
  private disposed = false;
  private playbackAttempt = 0;

  get supported() { return typeof Audio !== "undefined"; }

  private diagnostic(message: string) {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("meditationAudioDebug") === "1") {
      console.info(`[meditation-audio] ${message}`);
    }
  }

  private getAudio(): HTMLAudioElement | null {
    if (this.disposed) return null;
    if (this.audio) return this.audio;
    if (!this.supported) return null;
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.src = SPRITE_PATH; // assigned once; never replaced at stage boundaries
      audio.ontimeupdate = () => this.monitor();
      audio.onerror = () => this.handleFailure("audio error");
      audio.onended = () => this.handleFailure("sprite unexpectedly ended");
      this.audio = audio;
      return audio;
    } catch {
      return null;
    }
  }

  private startMonitor() {
    if (!this.timer && typeof window !== "undefined") {
      this.timer = window.setInterval(() => this.monitor(), 100);
    }
  }

  private seek(seconds: number): boolean {
    const audio = this.audio;
    if (!audio) return false;
    try {
      audio.currentTime = seconds;
      return true;
    } catch {
      this.handleFailure("seek error");
      return false;
    }
  }

  private toSilence() {
    this.mode = "silent";
    this.diagnostic("silent bed");
    this.seek(SILENCE_START + 0.25);
  }

  private finishCue() {
    const cue = this.activeCue;
    if (!cue) return;
    cue.remaining -= 1;
    if (cue.remaining > 0) {
      this.diagnostic(`repeat cue (${cue.remaining} left)`);
      this.seek(cue.start);
      return;
    }
    this.activeCue = null;
    this.toSilence();
    this.diagnostic("cue finished");
    cue.done();
  }

  private monitor() {
    const audio = this.audio;
    if (this.disposed || !audio || audio.paused || audio.seeking) return;
    const position = audio.currentTime;
    if (this.mode === "opening" && position >= CLIP_SECONDS) {
      this.openingMissing = null;
      this.toSilence();
    } else if (this.mode === "cue" && this.activeCue && position >= this.activeCue.end) {
      this.finishCue();
    } else if (this.mode === "silent" && position >= SILENCE_END - 2) {
      this.seek(SILENCE_START + 0.25);
    }
  }

  private handleFailure(reason: string) {
    if (this.disposed || this.mode === "idle") return;
    this.diagnostic(`failure: ${reason}`);
    const cue = this.activeCue;
    const openingMissing = this.openingMissing;
    this.activeCue = null;
    this.openingMissing = null;
    this.mode = "idle";
    this.audio?.pause();
    if (cue) { cue.missing(); cue.done(); }
    else openingMissing?.();
  }

  /** Called synchronously inside the Start/Restart user click. */
  playOpening(onMissing: () => void = () => {}) {
    this.stopSources();
    const audio = this.getAudio();
    if (!audio) { onMissing(); return; }
    this.mode = "opening";
    this.openingMissing = onMissing;
    this.diagnostic("opening started");
    // On first play, currentTime is already zero. On restart, seek while the
    // same user gesture is active; this is not a new resource/playback session.
    if (audio.currentTime !== 0 && !this.seek(0)) return;
    this.startMonitor();
    const attempt = ++this.playbackAttempt;
    try {
      void audio.play().catch(() => {
        if (attempt === this.playbackAttempt) this.handleFailure("play blocked");
      });
    } catch {
      this.handleFailure("play threw");
    }
  }

  /** Prefetch the one audio resource; no separate per-cue audio players. */
  prepare(_cueIds: (CustomCueId | null)[]) {
    // getAudio() already assigns preload=auto and src. No fetch() is needed.
  }

  /**
   * Jump within the ALREADY PLAYING sprite. A stage's cue begins when its
   * configured duration has elapsed, regardless of the 7-second opening sound.
   * The final onDone fires after the last 7-second recording completes.
   */
  playStageCue(id: CustomCueId | null, repeats: number, onDone: () => void, onMissing: () => void) {
    if (this.disposed) { onMissing(); onDone(); return; }
    this.activeCue = null;
    if (!id) {
      if (this.mode !== "idle") this.toSilence();
      this.diagnostic("silent stage boundary");
      onDone();
      return;
    }
    const audio = this.audio;
    if (!audio || this.mode === "idle" || audio.paused) {
      this.diagnostic("cue requested but audio session is inactive");
      onMissing();
      onDone();
      return;
    }
    const start = CUE_OFFSETS[id];
    if (start === undefined) { onMissing(); onDone(); return; }
    this.activeCue = {
      start, end: start + CLIP_SECONDS,
      remaining: Math.max(1, Math.min(8, Math.trunc(repeats) || 1)),
      done: onDone, missing: onMissing,
    };
    this.mode = "cue";
    this.diagnostic(`cue ${id}, repeats ${this.activeCue.remaining}`);
    // Crucially: do not call play() or change audio.src here.
    this.seek(start);
  }

  pause() { this.audio?.pause(); }

  resume() {
    const audio = this.audio;
    if (!audio || this.disposed || this.mode === "idle" || !audio.paused) return;
    // Resume comes directly from the user's Play tap.
    const attempt = ++this.playbackAttempt;
    try {
      void audio.play().catch(() => {
        if (attempt === this.playbackAttempt) this.handleFailure("resume blocked");
      });
    } catch { this.handleFailure("resume threw"); }
  }

  stopSources() {
    this.playbackAttempt++;
    this.mode = "idle";
    this.activeCue = null;
    this.openingMissing = null;
    this.audio?.pause();
    this.diagnostic("stopped");
  }

  dispose() {
    if (this.disposed) return;
    this.stopSources();
    this.disposed = true;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    const audio = this.audio;
    this.audio = null;
    if (audio) {
      audio.ontimeupdate = null;
      audio.onerror = null;
      audio.onended = null;
      audio.removeAttribute("src");
      audio.load();
    }
  }
}
