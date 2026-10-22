import { CUSTOM_OPENING_PATH, getCustomCuePath, type CustomCueId } from "./custom-meditation-types";

/**
 * One reusable HTMLAudioElement for both the opening signature and stage cues.
 *
 * iOS Safari can mute/interupt Web Audio independently from regular media
 * elements (including when the phone's silent switch is enabled). The first
 * play() is called synchronously from Start, giving this same element its
 * initial user activation before any timer-based stage cues are requested.
 *
 * We reuse that element when the source changes. Creating a new Audio object
 * at a later stage boundary would lose the user-activated playback path.
 */
export class CustomMeditationCues {
  private audio: HTMLAudioElement | null = null;
  private generation = 0;
  private disposed = false;
  private remainingPlays = 0;
  private active = false;

  get supported() { return typeof Audio !== "undefined"; }

  private getAudio(): HTMLAudioElement | null {
    if (this.disposed) return null;
    if (this.audio) return this.audio;
    if (!this.supported) return null;
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = 0.7;
      this.audio = audio;
      return audio;
    } catch {
      return null;
    }
  }

  /** Start immediately inside the Start/Restart click; do not await loading. */
  playOpening(onMissing: () => void = () => {}) {
    this.stopSources();
    const token = this.generation;
    const audio = this.getAudio();
    if (!audio) { onMissing(); return; }
    this.active = true;
    this.remainingPlays = 1;
    const fail = () => {
      if (this.disposed || token !== this.generation) return;
      this.stopSources();
      onMissing();
    };
    audio.onerror = fail;
    audio.onended = () => {
      if (this.disposed || token !== this.generation) return;
      this.active = false;
      this.remainingPlays = 0;
      audio.onended = null;
      audio.onerror = null;
    };
    try {
      audio.src = CUSTOM_OPENING_PATH;
      // Safari must receive play() before the initiating click returns.
      void audio.play().catch(fail);
    } catch {
      fail();
    }
  }

  /** Warm the HTTP cache without spawning additional, locked audio players. */
  prepare(cueIds: (CustomCueId | null)[]) {
    if (typeof fetch === "undefined") return;
    for (const id of new Set(cueIds.filter((cue): cue is CustomCueId => cue !== null))) {
      void fetch(getCustomCuePath(id)).catch(() => {});
    }
  }

  /** The final onDone fires after the last complete recording, not on cue start. */
  playStageCue(id: CustomCueId | null, repeats: number, onDone: () => void, onMissing: () => void) {
    this.stopSources();
    const token = this.generation;
    if (!id) { onDone(); return; }
    const audio = this.getAudio();
    if (!audio) { onMissing(); onDone(); return; }

    this.active = true;
    this.remainingPlays = Math.max(1, Math.min(8, Math.trunc(repeats) || 1));

    const fail = () => {
      if (this.disposed || token !== this.generation) return;
      this.stopSources();
      onMissing();
      onDone(); // A missing/broken file must not strand the final stage.
    };
    const playAgain = () => {
      if (this.disposed || token !== this.generation || !this.active) return;
      try { audio.currentTime = 0; } catch { /* media metadata may not be ready yet */ }
      try {
        void audio.play().catch(fail);
      } catch {
        fail();
      }
    };
    audio.onerror = fail;
    audio.onended = () => {
      if (this.disposed || token !== this.generation || !this.active) return;
      this.remainingPlays--;
      if (this.remainingPlays > 0) {
        playAgain();
        return;
      }
      this.active = false;
      audio.onerror = null;
      audio.onended = null;
      onDone();
    };
    try {
      // Reuse the user-unlocked opening element instead of Web Audio.
      audio.src = getCustomCuePath(id);
      playAgain();
    } catch {
      fail();
    }
  }

  pause() {
    if (this.active) this.audio?.pause();
  }

  resume() {
    const audio = this.audio;
    if (!this.active || !audio || !audio.paused || this.disposed) return;
    // Resume is itself initiated by a user tap.
    void audio.play().catch(() => {
      // Playback can fail after an iOS audio interruption: use the same
      // per-clip error callback so the user sees an explicit warning.
      audio.onerror?.(new Event("error"));
    });
  }

  stopSources() {
    this.generation++;
    this.active = false;
    this.remainingPlays = 0;
    const audio = this.audio;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* not yet loaded */ }
  }

  dispose() {
    if (this.disposed) return;
    this.stopSources();
    this.disposed = true;
    const audio = this.audio;
    this.audio = null;
    if (audio) audio.removeAttribute("src");
  }
}
