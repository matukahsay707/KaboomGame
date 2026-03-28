type SoundFn = (ctx: AudioContext, volume?: number) => void;

const STORAGE_KEY = 'kaboom_audio_settings';
const MAX_CONCURRENT = 3;

interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private musicVolume = 0.4;
  private sfxVolume = 1.0;
  private activeSounds = 0;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private preDuckVolume = 0.4;
  private unlocked = false;

  constructor() {
    this.loadSettings();
    this.setupUnlock();
    this.setupVisibility();
  }

  // ─── AudioContext management ───

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private setupUnlock(): void {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.getCtx(); // create + resume
      if (this.musicEl && this.musicEl.paused) {
        this.musicEl.play().catch(() => {});
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };

    // iOS requires touchstart specifically
    document.addEventListener('click', unlock, { once: false });
    document.addEventListener('touchstart', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });
  }

  private setupVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.ctx?.suspend();
        if (this.musicEl) this.musicEl.pause();
      } else {
        this.ctx?.resume();
        if (this.musicEl && this.musicVolume > 0) {
          this.musicEl.play().catch(() => {});
        }
      }
    });
  }

  // ─── SFX ───

  playSFX(soundFn: SoundFn, priority = 4): void {
    if (this.sfxVolume === 0) return;
    if (this.activeSounds >= MAX_CONCURRENT && priority > 4) return; // drop low priority

    try {
      const ctx = this.getCtx();
      this.activeSounds++;
      soundFn(ctx, this.sfxVolume);
      // Estimate sound done after 500ms
      setTimeout(() => { this.activeSounds = Math.max(0, this.activeSounds - 1); }, 500);
    } catch {
      // Audio unavailable
    }
  }

  // ─── Music ───

  playMusic(src = '/audio/background.mp3?v=2'): void {
    if (this.musicEl) return;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = this.musicVolume;
    audio.preload = 'auto';
    this.musicEl = audio;

    audio.play().catch(() => {
      // Will start on first user interaction via unlock
    });
  }

  stopMusic(): void {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.src = '';
      this.musicEl = null;
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicEl) this.musicEl.volume = this.musicVolume;
    this.saveSettings();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    this.saveSettings();
  }

  getSFXVolume(): number {
    return this.sfxVolume;
  }

  isMusicPlaying(): boolean {
    return !!this.musicEl && !this.musicEl.paused;
  }

  toggleMusic(): void {
    if (!this.musicEl) {
      this.playMusic();
      return;
    }
    if (this.musicEl.paused) {
      this.musicEl.volume = this.musicVolume;
      this.musicEl.play().catch(() => {});
    } else {
      this.musicEl.pause();
    }
  }

  // ─── Ducking ───

  duck(level: 'soft' | 'hard' | 'mute', durationMs: number): void {
    if (!this.musicEl) return;

    this.preDuckVolume = this.musicVolume;

    if (this.duckTimer) clearTimeout(this.duckTimer);

    const targetVol = level === 'mute' ? 0 : level === 'hard' ? this.musicVolume * 0.1 : this.musicVolume * 0.25;

    // Quick fade down
    this.fadeMusic(targetVol, 200);

    // Fade back after duration
    this.duckTimer = setTimeout(() => {
      this.fadeMusic(this.preDuckVolume, 800);
    }, durationMs);
  }

  private fadeMusic(target: number, durationMs: number): void {
    if (!this.musicEl) return;
    const start = this.musicEl.volume;
    const diff = target - start;
    const steps = durationMs / 20;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (!this.musicEl || step >= steps) {
        if (this.musicEl) this.musicEl.volume = Math.max(0, target);
        clearInterval(interval);
        return;
      }
      // Exponential-ish curve
      const t = step / steps;
      const eased = 1 - Math.pow(1 - t, 3);
      this.musicEl.volume = Math.max(0, start + diff * eased);
    }, 20);
  }

  // ─── Settings persistence ───

  saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
      }));
    } catch {
      // localStorage unavailable
    }
  }

  loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const settings: AudioSettings = JSON.parse(raw);
        this.musicVolume = settings.musicVolume ?? 0.4;
        this.sfxVolume = settings.sfxVolume ?? 1.0;
      }
    } catch {
      // Use defaults
    }
  }
}

// Singleton
export const audioManager = new AudioManager();
