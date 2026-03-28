/**
 * Kaboom Game Simulation — runs 100 full games verifying all rules.
 * Fully event-driven: all listeners registered upfront before any game actions.
 * Run: node server/scripts/simulateGame.mjs
 */

// Speed up match window timer for simulation
process.env.MATCH_WINDOW_TIMER_MS = '100';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

const CARD_VALUES = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 10, 'Q': 10,
  'K-hearts': 25, 'K-diamonds': 25, 'K-clubs': 0, 'K-spades': 0,
  'Joker': -1,
};

function getCardValue(card) {
  if (card.rank === 'K' && card.suit) return CARD_VALUES[`K-${card.suit}`] ?? 0;
  return CARD_VALUES[card.rank] ?? 0;
}
function calcScore(cards) {
  return cards.reduce((sum, c) => sum + (c ? getCardValue(c) : 0), 0);
}

const stats = { completed: 0, hung: 0, failures: [] };
function fail(n, msg) { stats.failures.push({ game: n, error: msg }); }

let RoomManager, BotManager, registerLobbyHandlers, registerGameHandlers, registerBotHandlers;

async function loadModules() {
  const { execSync } = await import('child_process');
  try {
    execSync('npm run build:shared && npm run build --workspace=server', {
      cwd: new URL('../../', import.meta.url).pathname, stdio: 'pipe',
    });
  } catch { /* use existing dist */ }

  RoomManager = (await import('../dist/game/RoomManager.js')).RoomManager;
  BotManager = (await import('../dist/game/BotManager.js')).BotManager;
  registerLobbyHandlers = (await import('../dist/socket/lobbyHandlers.js')).registerLobbyHandlers;
  registerGameHandlers = (await import('../dist/socket/gameHandlers.js')).registerGameHandlers;
  registerBotHandlers = (await import('../dist/socket/botHandlers.js')).registerBotHandlers;
}

function createServer_(port) {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const rm = new RoomManager();
  const bm = new BotManager();

  io.use((s, next) => { s.data.uid = s.handshake.auth.uid; s.data.displayName = s.handshake.auth.displayName; next(); });
  io.on('connection', (s) => {
    registerLobbyHandlers(io, s, rm);
    registerGameHandlers(io, s, rm, bm);
    registerBotHandlers(io, s, rm, bm);
    s.on('disconnect', () => rm.handleDisconnect(s.data.uid, io));
  });

  return new Promise(r => httpServer.listen(port, () => r({ httpServer, io })));
}

function connect(port, uid, name) {
  return new Promise(r => {
    const s = ioClient(`http://localhost:${port}`, { auth: { uid, displayName: name }, transports: ['websocket'], forceNew: true });
    s.on('connect', () => r(s));
  });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Create a deferred promise that can be resolved externally */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// ─── Run one game ───

async function runGame(gameNum, port) {
  const N = 4;
  const sockets = [];

  for (let i = 0; i < N; i++) {
    sockets.push(await connect(port, `g${gameNum}p${i}`, `P${i}`));
  }

  try {
    // ─── Register ALL listeners UPFRONT before any game actions ───

    let turnCount = 0;
    let kaboomCalled = false;
    let gameEnded = false;
    let revealData = null;
    let winnerData = null;

    // Deferred promises for phase transitions
    const roomCreated = deferred();
    const allJoined = [];
    for (let i = 1; i < N; i++) allJoined.push(deferred());
    const allStarted = sockets.map(() => deferred());
    const allPeeked = sockets.map(() => deferred());
    const gameEnd = deferred();

    // Room creation
    sockets[0].once('room:created', (d) => roomCreated.resolve(d));

    // Join events (each joiner waits for their own playerJoined)
    for (let i = 1; i < N; i++) {
      sockets[i].once('room:playerJoined', () => allJoined[i - 1].resolve());
    }

    // Game started + peek cards (emitted back-to-back by server)
    for (let i = 0; i < N; i++) {
      sockets[i].once('game:started', () => allStarted[i].resolve());
      sockets[i].once('game:peekCards', () => allPeeked[i].resolve());
    }

    // Game end events
    sockets[0].on('game:reveal', (d) => { revealData = d; });
    sockets[0].on('game:winner', (d) => {
      winnerData = d;
      gameEnded = true;
      gameEnd.resolve();
    });

    // Turn handler — each player reacts when it's their turn
    for (let i = 0; i < N; i++) {
      const sock = sockets[i];
      const uid = `g${gameNum}p${i}`;

      sock.on('game:turnStart', async (data) => {
        if (gameEnded) return;
        if (data.activePlayerId !== uid) return;

        turnCount++;

        // Maybe call Kaboom
        if (!kaboomCalled && (turnCount > 10 && Math.random() < 0.15 || turnCount > 40)) {
          kaboomCalled = true;
          sock.emit('game:callKaboom');
          return;
        }

        // Draw from deck
        sock.emit('game:drawDeck');

        // Wait for card drawn
        const drawResult = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 5000);
          sock.once('game:cardDrawn', (d) => { clearTimeout(timer); resolve(d); });
        });

        if (!drawResult || !drawResult.card) return;

        await wait(10);

        // Discard (simplest valid move)
        sock.emit('game:discard');
        // Server will start match window, then emit next turnStart
      });

      // Skip special actions
      sock.on('game:stateUpdate', (data) => {
        if (gameEnded) return;
        const gs = data.gameState;
        if (gs.phase === 'SPECIAL_ACTION' && gs.activePlayerId === uid) {
          sock.emit('game:skipSpecial');
        }
      });
    }

    // ─── Now drive the game flow ───

    // 1. Create room
    sockets[0].emit('room:create', { maxPlayers: N });
    const { roomState } = await roomCreated.promise;
    const code = roomState.roomCode;

    // 2. Join others
    for (let i = 1; i < N; i++) {
      sockets[i].emit('room:join', { roomCode: code });
      await allJoined[i - 1].promise;
    }

    await wait(50);

    // 3. Start game (listeners already registered for game:started + game:peekCards)
    sockets[0].emit('game:start');
    await Promise.all(allStarted.map(d => d.promise));
    await Promise.all(allPeeked.map(d => d.promise));

    // 4. Peek done
    for (const s of sockets) s.emit('game:peekDone');

    // game:allPeeked → game:turnStart fires automatically, caught by our turnStart listeners

    // 5. Wait for game to end
    const GAME_TIMEOUT = 120000;
    try {
      await Promise.race([
        gameEnd.promise,
        wait(GAME_TIMEOUT).then(() => { throw new Error('timeout'); }),
      ]);
    } catch {
      stats.hung++;
      fail(gameNum, `Hung after ${turnCount} turns — no winner received`);
      return;
    }

    // ─── Validate ───
    if (revealData) {
      const players = revealData.players;

      // 1. Score accuracy
      for (const p of players) {
        const expected = calcScore(p.cards);
        if (p.score !== expected) fail(gameNum, `Score mismatch: ${p.displayName} ${p.score} != ${expected}`);
      }

      // 2. Has winner
      const winners = players.filter(p => p.isWinner);
      if (winners.length === 0) fail(gameNum, 'No winner');

      // 3. Winner is lowest score
      const minScore = Math.min(...players.map(p => p.score));
      for (const w of winners) {
        if (w.score !== minScore && !players.find(p => p.calledKaboom)) {
          fail(gameNum, `Winner ${w.displayName} score ${w.score} != min ${minScore}`);
        }
      }

      // 4. Kaboom rules
      const caller = players.find(p => p.calledKaboom);
      if (caller) {
        const nonCallers = players.filter(p => !p.calledKaboom);
        const minNC = Math.min(...nonCallers.map(p => p.score));
        if (caller.score < minNC && !caller.isWinner) fail(gameNum, 'Kaboom caller has lowest but not winner');
        if (caller.score >= minNC && caller.isWinner) fail(gameNum, 'Kaboom caller should lose');
      }

      // 5. Card count sanity
      for (const p of players) {
        const count = p.cards.filter(c => c !== null).length;
        if (count > 10) fail(gameNum, `${p.displayName} has ${count} cards`);
      }
    }

    stats.completed++;
  } catch (e) {
    stats.hung++;
    fail(gameNum, `Exception: ${e.message}`);
  } finally {
    for (const s of sockets) {
      s.removeAllListeners();
      s.disconnect();
    }
  }
}

// ─── Main ───

async function main() {
  const PORT = 4999;
  const TOTAL = 100;

  console.log('🎴 Kaboom Game Simulator');
  console.log(`   Running ${TOTAL} games with 4 players each\n`);

  await loadModules();
  console.log('   Modules loaded');

  const { httpServer, io } = await createServer_(PORT);
  console.log(`   Server on :${PORT}\n`);

  const startAll = Date.now();

  for (let i = 1; i <= TOTAL; i++) {
    process.stdout.write(`   Game ${i}/${TOTAL}...`);
    const t = Date.now();
    await runGame(i, PORT);
    const ms = Date.now() - t;
    const status = stats.failures.find(f => f.game === i) ? ' ❌' : ' ✓';
    process.stdout.write(` ${ms}ms${status}\n`);
  }

  io.close();
  httpServer.close();

  const totalTime = ((Date.now() - startAll) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SIMULATION RESULTS');
  console.log('═'.repeat(50));
  console.log(`   Total:     ${TOTAL} games in ${totalTime}s`);
  console.log(`   Completed: ${stats.completed}`);
  console.log(`   Hung:      ${stats.hung}`);
  console.log(`   Failures:  ${stats.failures.length}`);

  if (stats.failures.length > 0) {
    console.log('\n   FAILURES:');
    const grouped = new Map();
    for (const f of stats.failures) {
      const key = f.error.slice(0, 100);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(f.game);
    }
    for (const [err, games] of grouped) {
      console.log(`   ❌ ${err}`);
      console.log(`      Games: ${games.slice(0, 15).join(', ')}${games.length > 15 ? ` (+${games.length - 15})` : ''}`);
    }
  } else {
    console.log('\n   ✅ All games passed all assertions!');
  }
  console.log('═'.repeat(50));
  process.exit(stats.failures.length > 0 || stats.hung > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
