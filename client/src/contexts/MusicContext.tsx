import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { audioManager } from '../audio/audioManager.ts';

interface MusicContextType {
  readonly muted: boolean;
  readonly toggle: () => void;
  readonly duck: () => void;
  readonly unduck: () => void;
  readonly swell: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { readonly children: ReactNode }) {
  const [muted, setMuted] = useState(!audioManager.isMusicPlaying());

  useEffect(() => {
    audioManager.playMusic();
  }, []);

  const toggle = useCallback(() => {
    audioManager.toggleMusic();
    setMuted(!audioManager.isMusicPlaying());
    // Small delay to check actual state after toggle
    setTimeout(() => setMuted(!audioManager.isMusicPlaying()), 50);
  }, []);

  const duck = useCallback(() => {
    audioManager.duck('hard', 3000);
  }, []);

  const unduck = useCallback(() => {
    // unduck happens automatically via the duck timer
  }, []);

  const swell = useCallback(() => {
    // Brief volume boost
    const current = audioManager.getMusicVolume();
    audioManager.setMusicVolume(Math.min(0.6, current * 1.5));
    setTimeout(() => audioManager.setMusicVolume(current), 2000);
  }, []);

  return (
    <MusicContext.Provider value={{ muted, toggle, duck, unduck, swell }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicContextType {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within MusicProvider');
  return ctx;
}
