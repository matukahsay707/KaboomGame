import { useCallback } from 'react';
import { audioManager } from '../audio/audioManager.ts';
import * as sfx from '../audio/soundEffects.ts';

export type SoundName = keyof typeof SOUND_MAP;

const SOUND_MAP = {
  // Card actions
  cardDeal: { fn: sfx.playCardDeal, priority: 5, duck: null },
  cardDrawDeck: { fn: sfx.playCardDrawDeck, priority: 3, duck: 'soft' as const },
  cardDrawDiscard: { fn: sfx.playCardDrawDiscard, priority: 3, duck: 'soft' as const },
  cardPlace: { fn: sfx.playCardPlace, priority: 4, duck: 'soft' as const },
  cardFlip: { fn: sfx.playCardFlip, priority: 4, duck: null },
  cardDraw: { fn: sfx.playCardDrawDeck, priority: 3, duck: 'soft' as const },
  // Matching
  matchWindowOpen: { fn: sfx.playMatchWindowOpen, priority: 2, duck: null },
  matchWindowClose: { fn: sfx.playMatchWindowClose, priority: 3, duck: null },
  matchSuccess: { fn: sfx.playMatchSuccess, priority: 2, duck: 'soft' as const },
  matchFail: { fn: sfx.playMatchFail, priority: 2, duck: 'soft' as const },
  matchTooSlow: { fn: sfx.playMatchTooSlow, priority: 4, duck: null },
  // Specials
  peek10: { fn: sfx.playPeek10, priority: 3, duck: 'soft' as const },
  jackTrade: { fn: sfx.playJackTrade, priority: 3, duck: 'soft' as const },
  queenPeek: { fn: sfx.playQueenPeek, priority: 3, duck: 'soft' as const },
  queenTrade: { fn: sfx.playQueenTrade, priority: 3, duck: 'soft' as const },
  // Kaboom
  kaboom: { fn: sfx.playKaboomCall, priority: 1, duck: 'hard' as const },
  daniaKaboom: { fn: sfx.playDaniaKaboom, priority: 1, duck: 'mute' as const },
  kaboomLocked: { fn: sfx.playKaboomLocked, priority: 3, duck: null },
  kaboomFinalTick: { fn: sfx.playKaboomFinalTick, priority: 5, duck: null },
  // Reveal
  cardRevealFlip: { fn: sfx.playCardRevealFlip, priority: 3, duck: null },
  scoreCount: { fn: sfx.playScoreCount, priority: 6, duck: null },
  win: { fn: sfx.playRoundWin, priority: 1, duck: 'mute' as const },
  lose: { fn: sfx.playRoundLoseKaboom, priority: 1, duck: 'mute' as const },
  penaltyCard: { fn: sfx.playPenaltyCard, priority: 2, duck: 'soft' as const },
  // UI
  turnNotify: { fn: sfx.playYourTurn, priority: 2, duck: null },
  buttonClick: { fn: (ctx: AudioContext, v?: number) => sfx.playCardFlip(ctx, (v ?? 1) * 0.5), priority: 7, duck: null },
  timerTick: { fn: sfx.playKaboomFinalTick, priority: 7, duck: null },
  countdownTick: { fn: sfx.playKaboomFinalTick, priority: 6, duck: null },
  playerJoin: { fn: sfx.playPlayerJoin, priority: 3, duck: null },
  playerDisconnect: { fn: sfx.playPlayerDisconnect, priority: 3, duck: null },
  cardSwap: { fn: sfx.playJackTrade, priority: 4, duck: 'soft' as const },
} as const;

const DUCK_DURATIONS: Record<string, number> = {
  soft: 2000,
  hard: 4000,
  mute: 1500,
};

export function useSound() {
  const play = useCallback((name: SoundName) => {
    const entry = SOUND_MAP[name];
    if (!entry) return;

    audioManager.playSFX(entry.fn, entry.priority);

    if (entry.duck) {
      audioManager.duck(entry.duck, DUCK_DURATIONS[entry.duck]);
    }
  }, []);

  return { play };
}
