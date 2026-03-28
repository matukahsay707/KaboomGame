// All sounds synthesized with Web Audio API — no external files needed.
// Each function accepts an AudioContext and optional volume (0–1, scales relative to master).

type Ctx = AudioContext;

function noise(ctx: Ctx, duration: number, vol: number, delay = 0, filter?: { type: BiquadFilterType; freq: number }): void {
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, ctx.currentTime + delay);
    src.connect(f);
    f.connect(gain);
  } else {
    src.connect(gain);
  }

  gain.connect(ctx.destination);
  src.start(ctx.currentTime + delay);
}

function tone(
  ctx: Ctx, type: OscillatorType, freq: number, duration: number,
  vol: number, delay = 0, freqEnd?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration);
  }
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

// ─── Card Actions ───

export function playCardDeal(ctx: Ctx, v = 1): void {
  const filterFreq = 1800 + Math.random() * 400;
  noise(ctx, 0.02, 0.12 * v, 0, { type: 'bandpass', freq: filterFreq });
  tone(ctx, 'sine', 500 + Math.random() * 200, 0.04, 0.04 * v, 0.015);
}

export function playCardDrawDeck(ctx: Ctx, v = 1): void {
  noise(ctx, 0.03, 0.08 * v, 0, { type: 'bandpass', freq: 1200 });
  tone(ctx, 'sine', 600, 0.06, 0.05 * v, 0.02);
}

export function playCardDrawDiscard(ctx: Ctx, v = 1): void {
  noise(ctx, 0.03, 0.08 * v, 0, { type: 'bandpass', freq: 1200 });
  tone(ctx, 'sine', 600, 0.06, 0.05 * v, 0.02);
  tone(ctx, 'sine', 80, 0.015, 0.1 * v, 0.04);
}

export function playCardPlace(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 120, 0.08, 0.12 * v);
  tone(ctx, 'sine', 120, 0.06, 0.024 * v, 0.02); // reverb copy 1
  tone(ctx, 'sine', 120, 0.04, 0.024 * v, 0.04); // reverb copy 2
}

export function playCardFlip(ctx: Ctx, v = 1): void {
  noise(ctx, 0.01, 0.15 * v, 0, { type: 'highpass', freq: 4000 });
  tone(ctx, 'sine', 200, 0.02, 0.08 * v, 0.01);
}

// ─── Match Window ───

export function playMatchWindowOpen(ctx: Ctx, v = 1): void {
  // Sharp, bright ding — two harmonics
  tone(ctx, 'sine', 1760, 0.08, 0.18 * v);
  tone(ctx, 'sine', 2640, 0.06, 0.1 * v, 0.01);
}

export function playMatchWindowClose(ctx: Ctx, v = 1): void {
  // Low whomp — pitch drops quickly
  tone(ctx, 'sine', 250, 0.2, 0.15 * v, 0, 80);
  tone(ctx, 'sine', 120, 0.15, 0.08 * v, 0.05, 60);
}

// ─── Matching ───

export function playMatchSuccess(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 880, 0.1, 0.2 * v);
  tone(ctx, 'sine', 1108, 0.12, 0.2 * v, 0.08);
}

export function playMatchFail(ctx: Ctx, v = 1): void {
  tone(ctx, 'sawtooth', 300, 0.2, 0.12 * v, 0, 150);
}

export function playMatchTooSlow(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 400, 0.15, 0.1 * v, 0, 100);
}

// ─── Special Cards ───

export function playPeek10(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 1200, 0.06, 0.1 * v);
  tone(ctx, 'sine', 1500, 0.06, 0.1 * v, 0.04);
  tone(ctx, 'sine', 1800, 0.06, 0.1 * v, 0.08);
}

export function playJackTrade(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 600, 0.2, 0.1 * v, 0, 1000);
  tone(ctx, 'sine', 1000, 0.2, 0.1 * v, 0, 600);
}

export function playQueenPeek(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 1200, 0.06, 0.12 * v);
  tone(ctx, 'sine', 1500, 0.06, 0.12 * v, 0.04);
  tone(ctx, 'sine', 1800, 0.06, 0.12 * v, 0.08);
  tone(ctx, 'sine', 2000, 0.06, 0.12 * v, 0.12);
}

export function playQueenTrade(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 600, 0.2, 0.1 * v, 0, 1000);
  tone(ctx, 'sine', 1000, 0.2, 0.1 * v, 0, 600);
  tone(ctx, 'sine', 2400, 0.04, 0.06 * v, 0.08);
}

// ─── Kaboom Moments ───

export function playKaboomCall(ctx: Ctx, v = 1): void {
  // Phase 1: low rumble building
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, ctx.currentTime);
  g.gain.setValueAtTime(0.01, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.3 * v, ctx.currentTime + 0.8);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.2);

  // Phase 2: explosion at 0.8s
  noise(ctx, 0.05, 0.35 * v, 0.8);
  // Phase 3: reverb tail
  noise(ctx, 0.08, 0.15 * v, 0.9);
  noise(ctx, 0.06, 0.08 * v, 1.0);
  noise(ctx, 0.05, 0.04 * v, 1.15);
}

export function playDaniaKaboom(ctx: Ctx, v = 1): void {
  // Deeper, more dramatic explosion
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(40, ctx.currentTime);
  g.gain.setValueAtTime(0.01, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.4 * v, ctx.currentTime + 1.0);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 2.0);

  // Heavy explosion burst
  noise(ctx, 0.08, 0.4 * v, 1.0);
  noise(ctx, 0.1, 0.25 * v, 1.1);
  noise(ctx, 0.08, 0.15 * v, 1.25);
  noise(ctx, 0.06, 0.1 * v, 1.4);
  noise(ctx, 0.05, 0.06 * v, 1.55);
}

export function playKaboomLocked(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 800, 0.02, 0.1 * v);
  tone(ctx, 'sine', 1200, 0.02, 0.1 * v, 0.005);
}

export function playKaboomFinalTick(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 1000, 0.015, 0.08 * v);
}

// ─── Reveal and Scoring ───

export function playCardRevealFlip(ctx: Ctx, v = 1): void {
  noise(ctx, 0.015, 0.18 * v, 0, { type: 'highpass', freq: 3000 });
  tone(ctx, 'sine', 100, 0.04, 0.12 * v, 0.015);
}

export function playScoreCount(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 1400, 0.008, 0.06 * v);
}

export function playRoundWin(ctx: Ctx, v = 1): void {
  // Major chord: C5, E5, G5
  const attack = 0.02;
  const dur = 0.4;
  [523, 659, 784].forEach((freq) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.15 * v, ctx.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  });
}

export function playRoundLoseKaboom(ctx: Ctx, v = 1): void {
  // Wah-wah sad trombone
  const osc1 = ctx.createOscillator();
  const filter1 = ctx.createBiquadFilter();
  const g1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(400, ctx.currentTime);
  filter1.type = 'lowpass';
  filter1.frequency.setValueAtTime(2000, ctx.currentTime);
  filter1.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.6);
  g1.gain.setValueAtTime(0.1 * v, ctx.currentTime);
  g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc1.connect(filter1);
  filter1.connect(g1);
  g1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.6);

  // Second wah
  tone(ctx, 'sawtooth', 300, 0.4, 0.08 * v, 0.5, 150);
}

export function playPenaltyCard(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 400, 0.015, 0.1 * v); // impact
  tone(ctx, 'sine', 80, 0.06, 0.12 * v, 0.01); // thunk
}

// ─── UI and Social ───

export function playYourTurn(ctx: Ctx, v = 1): void {
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(660, ctx.currentTime);
  g1.gain.setValueAtTime(0.001, ctx.currentTime);
  g1.gain.linearRampToValueAtTime(0.1 * v, ctx.currentTime + 0.01);
  g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc1.connect(g1);
  g1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.08);

  tone(ctx, 'sine', 880, 0.08, 0.1 * v, 0.08);
}

export function playTurnTimerWarning(ctx: Ctx, v = 1, secondsLeft = 5): void {
  // Pitch increases as time runs out
  const pitches = [800, 866, 933, 1000, 1066];
  const idx = Math.max(0, Math.min(4, 5 - secondsLeft));
  tone(ctx, 'sine', pitches[idx], 0.02, 0.06 * v);
}

export function playTurnTimeout(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 300, 0.2, 0.08 * v, 0, 200);
}

export function playPlayerJoin(ctx: Ctx, v = 1): void {
  tone(ctx, 'sine', 523, 0.06, 0.1 * v);
  tone(ctx, 'sine', 784, 0.1, 0.1 * v, 0.06);
}

export function playPlayerDisconnect(ctx: Ctx, v = 1): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.04);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, ctx.currentTime);
  g.gain.setValueAtTime(0.08 * v, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  osc.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.04);
}
