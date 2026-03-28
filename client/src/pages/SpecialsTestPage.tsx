import { useState, useCallback } from 'react';
import type { Card as CardType, ClientGameState, ClientPlayerState } from '@kaboom/shared';
import GameBoard from '../components/game/GameBoard.tsx';
import { GameContext, type GameContextType } from '../contexts/GameContext.tsx';

// ─── Mock data ───

let mockId = 0;
function mc(rank: string, suit: string | null = 'hearts'): CardType {
  return { id: `m-${mockId++}`, rank: rank as CardType['rank'], suit: suit as CardType['suit'] };
}

function hiddenCards(count: number) {
  return Array.from({ length: count }, (_, i) => ({ slotIndex: i, faceDown: true as const }));
}

function makeOpponent(name: string, count = 4): ClientPlayerState {
  return {
    id: `opp-${name}`, displayName: name,
    cards: hiddenCards(count), connected: true, calledKaboom: false, cardCount: count,
  };
}

function makeYou(name = 'You', count = 4): ClientPlayerState {
  return {
    id: 'local-player', displayName: name,
    cards: hiddenCards(count), connected: true, calledKaboom: false, cardCount: count,
  };
}

function baseState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    phase: 'PLAYER_TURN',
    you: makeYou(),
    opponents: [makeOpponent('Alice'), makeOpponent('Bob'), makeOpponent('Carol')],
    activePlayerId: 'local-player',
    discardTop: mc('5', 'diamonds'),
    drawPileCount: 37,
    drawnCard: null,
    matchWindow: null,
    kaboomCallerId: null,
    turnOrder: ['local-player', 'opp-Alice', 'opp-Bob', 'opp-Carol'],
    ...overrides,
  };
}

// ─── Scenario definitions ───

interface ScenarioDef {
  readonly id: string;
  readonly group: string;
  readonly label: string;
  readonly desc: string;
  readonly gameState: ClientGameState;
  readonly drawnCard: CardType | null;
  readonly peekCards: readonly CardType[];
  readonly specialPrompt: { cardRank: string; ability: string } | null;
  readonly matchWindow: { discardedCard: CardType; duration: number; startTime: number } | null;
}

function buildScenarios(): readonly ScenarioDef[] {
  mockId = 0;
  return [
    // ── Game Start ──
    {
      id: 'deal', group: 'Game Start', label: 'Deal + Sneak Peek',
      desc: 'Full cinematic deal, then peek at bottom two cards',
      gameState: baseState({ phase: 'PEEK_PHASE', activePlayerId: null }),
      drawnCard: null, peekCards: [mc('7', 'spades'), mc('Q', 'hearts')],
      specialPrompt: null, matchWindow: null,
    },
    {
      id: 'your-turn', group: 'Game Start', label: 'Your Turn — Draw',
      desc: 'It is your turn. Tap deck or discard to draw. KABOOM button visible',
      gameState: baseState(), drawnCard: null,
      peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'opp-turn', group: 'Game Start', label: "Opponent's Turn",
      desc: "Alice's turn — wait and watch, your cards not interactive",
      gameState: baseState({ activePlayerId: 'opp-Alice' }),
      drawnCard: null, peekCards: [], specialPrompt: null, matchWindow: null,
    },

    // ── Draw + Swap/Discard ──
    {
      id: 'draw-normal', group: 'Draw & Play', label: 'Draw Normal Card',
      desc: '7 of Hearts drawn. Tap slot to swap, or tap Discard',
      gameState: baseState(), drawnCard: mc('7', 'hearts'),
      peekCards: [], specialPrompt: null, matchWindow: null,
    },

    // ── 10 — Full Flow ──
    {
      id: 'ten-drawn', group: '10 — Peek', label: '① Draw a 10',
      desc: '10 of Diamonds drawn. Tap "Peek" badge to use ability, or Discard to skip',
      gameState: baseState(), drawnCard: mc('10', 'diamonds'),
      peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'ten-active', group: '10 — Peek', label: '② Peek Mode Active',
      desc: 'All cards glow teal. Tap any card on the table to peek — lift animation plays',
      gameState: baseState({ phase: 'SPECIAL_ACTION' }),
      drawnCard: null, peekCards: [],
      specialPrompt: { cardRank: '10', ability: 'peek' }, matchWindow: null,
    },

    // ── Jack — Full Flow ──
    {
      id: 'jack-drawn', group: 'Jack — Trade', label: '① Draw a Jack',
      desc: 'Jack of Clubs drawn. Tap "Blind Trade" badge to use, or Discard to skip',
      gameState: baseState(), drawnCard: mc('J', 'clubs'),
      peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'jack-active', group: 'Jack — Trade', label: '② Trade Mode: Pick Your Card',
      desc: 'Your cards glow teal. Tap one of YOUR cards first to select it for trade',
      gameState: baseState({ phase: 'SPECIAL_ACTION' }),
      drawnCard: null, peekCards: [],
      specialPrompt: { cardRank: 'J', ability: 'blindTrade' }, matchWindow: null,
    },

    // ── Queen — Full Flow ──
    {
      id: 'queen-drawn', group: 'Queen — Peek+Trade', label: '① Draw a Queen',
      desc: 'Queen of Hearts drawn. Tap "Peek+Trade" badge to use, or Discard to skip',
      gameState: baseState(), drawnCard: mc('Q', 'hearts'),
      peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'queen-active', group: 'Queen — Peek+Trade', label: '② Pick Your Card, Then Opponent',
      desc: 'Tap your card, then tap opponent card to swap. Skip to cancel',
      gameState: baseState({ phase: 'SPECIAL_ACTION' }),
      drawnCard: null, peekCards: [],
      specialPrompt: { cardRank: 'Q', ability: 'peekAndTrade' }, matchWindow: null,
    },

    // ── Matching ──
    {
      id: 'match-open', group: 'Matching', label: 'Match Window Open',
      desc: 'A 5 was discarded. Discard glows gold. Tap your card to match it',
      gameState: baseState({ phase: 'MATCH_WINDOW', activePlayerId: 'opp-Alice' }),
      drawnCard: null, peekCards: [], specialPrompt: null,
      matchWindow: { discardedCard: mc('5', 'diamonds'), duration: 30000, startTime: Date.now() },
    },
    {
      id: 'match-locked', group: 'Matching', label: 'Match — You Discarded',
      desc: 'YOU discarded — your cards are NOT tappable, only opponents can match',
      gameState: baseState({ phase: 'MATCH_WINDOW', activePlayerId: 'local-player' }),
      drawnCard: null, peekCards: [], specialPrompt: null,
      matchWindow: { discardedCard: mc('8', 'clubs'), duration: 30000, startTime: Date.now() },
    },

    // ── Kaboom ──
    {
      id: 'kaboom-call', group: 'Kaboom', label: 'Call Kaboom',
      desc: 'Your turn — tap KABOOM! to call it',
      gameState: baseState(), drawnCard: null,
      peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'kaboom-opponent', group: 'Kaboom', label: 'Opponent Called Kaboom',
      desc: 'Alice called Kaboom — her grid is locked. Final round',
      gameState: baseState({
        kaboomCallerId: 'opp-Alice',
        opponents: [
          { ...makeOpponent('Alice'), calledKaboom: true },
          makeOpponent('Bob'), makeOpponent('Carol'),
        ],
      }),
      drawnCard: null, peekCards: [], specialPrompt: null, matchWindow: null,
    },
    {
      id: 'kaboom-you', group: 'Kaboom', label: 'YOU Called Kaboom',
      desc: 'Your grid locked with gold lock. Waiting for final turns',
      gameState: baseState({
        kaboomCallerId: 'local-player', activePlayerId: 'opp-Alice',
        you: { ...makeYou(), calledKaboom: true },
      }),
      drawnCard: null, peekCards: [], specialPrompt: null, matchWindow: null,
    },
  ];
}

const SCENARIOS = buildScenarios();
const GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];

// ─── Stateful test provider — simulates game responses ───

function StatefulTestProvider({ scenario, children, onLog }: {
  scenario: ScenarioDef;
  children: React.ReactNode;
  onLog: (msg: string) => void;
}) {
  const [drawnCard, setDrawnCard] = useState<CardType | null>(scenario.drawnCard);
  const [specialPrompt, setSpecialPrompt] = useState(scenario.specialPrompt);
  const [matchWindow, setMatchWindow] = useState(scenario.matchWindow);
  const [peekCards, setPeekCards] = useState<readonly CardType[]>(scenario.peekCards);
  const [peekReveal, setPeekReveal] = useState<{ card: CardType; playerId: string; slotIndex: number } | null>(null);
  const [gameState, setGameState] = useState(scenario.gameState);

  const value: GameContextType = {
    roomState: null,
    gameState,
    drawnCard,
    peekCards,
    scores: null,
    winnerIds: null,
    error: null,
    specialPrompt,
    matchWindow,
    peekReveal,
    connectionStatus: 'connected',
    reconnectAttempt: 0,
    createRoom: () => {},
    joinRoom: () => {},
    leaveRoom: () => {},
    startGame: () => {},
    peekDone: () => {
      onLog('peekDone — sneak peek closed');
      setPeekCards([]);
      setGameState((s) => ({ ...s, phase: 'PLAYER_TURN', activePlayerId: 'local-player' }));
    },
    drawFromDeck: () => {
      const card = mc((['2','3','4','5','6','7','8','9'] as const)[Math.floor(Math.random() * 8)], 'spades');
      onLog(`drawFromDeck → ${card.rank} of ${card.suit}`);
      setDrawnCard(card);
    },
    drawFromDiscard: () => {
      onLog('drawFromDiscard');
      setDrawnCard(gameState.discardTop);
    },
    swapCard: (slot) => {
      onLog(`swapCard → slot ${slot}`);
      setDrawnCard(null);
      setGameState((s) => ({ ...s, phase: 'MATCH_WINDOW' }));
      setMatchWindow({ discardedCard: mc('A', 'hearts'), duration: 5000, startTime: Date.now() });
      setTimeout(() => {
        setMatchWindow(null);
        setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
      }, 3000);
    },
    discardCard: () => {
      onLog('discardCard — plain discard, no special');
      setDrawnCard(null);
      setGameState((s) => ({ ...s, phase: 'MATCH_WINDOW' }));
      setMatchWindow({ discardedCard: mc('3', 'clubs'), duration: 5000, startTime: Date.now() });
      setTimeout(() => {
        setMatchWindow(null);
        setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
      }, 3000);
    },
    discardUseSpecial: () => {
      onLog('discardUseSpecial — card discarded, ability activated');
      const rank = drawnCard?.rank ?? '10';
      setDrawnCard(null);
      const ability = rank === 'J' ? 'blindTrade' : rank === 'Q' ? 'peekAndTrade' : 'peek';
      setSpecialPrompt({ cardRank: rank, ability });
      setGameState((s) => ({ ...s, phase: 'SPECIAL_ACTION' }));
    },
    useSpecial: (ability, targetPlayer, targetSlot) => {
      onLog(`useSpecial: ${ability} → ${targetPlayer} slot ${targetSlot}`);
      if (ability === 'peek' && targetPlayer && targetSlot !== undefined) {
        const fakeCard = mc(
          (['A','5','K','Q','7','3'] as const)[Math.floor(Math.random()*6)],
          (['hearts','spades','diamonds','clubs'] as const)[Math.floor(Math.random()*4)]
        );
        onLog(`Peeked card: ${fakeCard.rank} of ${fakeCard.suit}`);

        // Show the revealed card face on the table for 2 seconds
        setPeekReveal({ card: fakeCard, playerId: targetPlayer, slotIndex: targetSlot });
        setSpecialPrompt(null);

        // After 2s, clear reveal and go to match window
        setTimeout(() => {
          setPeekReveal(null);
          setGameState((s) => ({ ...s, phase: 'MATCH_WINDOW' }));
          setMatchWindow({ discardedCard: mc('6', 'diamonds'), duration: 5000, startTime: Date.now() });
        }, 2000);

        setTimeout(() => {
          setMatchWindow(null);
          setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
        }, 5000);
      }
    },
    skipSpecial: () => {
      onLog('skipSpecial — ability skipped');
      setSpecialPrompt(null);
      setGameState((s) => ({ ...s, phase: 'MATCH_WINDOW' }));
      setMatchWindow({ discardedCard: mc('4', 'hearts'), duration: 5000, startTime: Date.now() });
      setTimeout(() => {
        setMatchWindow(null);
        setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
      }, 3000);
    },
    peekResult: (slot) => { onLog(`peekResult slot ${slot}`); },
    tradeSelect: (mySlot, targetPlayer, targetSlot) => {
      onLog(`tradeSelect: my slot ${mySlot} ↔ ${targetPlayer} slot ${targetSlot}`);
      setSpecialPrompt(null);
      setGameState((s) => ({ ...s, phase: 'MATCH_WINDOW' }));
      setMatchWindow({ discardedCard: mc('9', 'clubs'), duration: 5000, startTime: Date.now() });
      setTimeout(() => {
        setMatchWindow(null);
        setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
      }, 3000);
    },
    matchAttempt: (slot) => {
      onLog(`matchAttempt slot ${slot}`);
      setMatchWindow(null);
      setGameState((s) => ({ ...s, phase: 'PLAYER_TURN' }));
    },
    callKaboom: () => {
      onLog('KABOOM called!');
      setGameState((s) => ({
        ...s,
        phase: 'KABOOM_FINAL' as const,
        kaboomCallerId: 'local-player',
        you: { ...s.you, calledKaboom: true },
      }));
    },
    startBotGame: () => {},
    restartGame: () => {},
    joinMatchmaking: () => {},
    cancelMatchmaking: () => {},
    matchmakingStatus: null,
    clearError: () => {},
    daniaKaboom: false,
    forceReconnect: () => {},
    socket: null,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// ─── Main Page ───

export default function SpecialsTestPage() {
  const [activeId, setActiveId] = useState<string>(SCENARIOS[0].id);
  const [key, setKey] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const active = SCENARIOS.find((s) => s.id === activeId)!;

  const selectScenario = useCallback((id: string) => {
    setActiveId(id);
    setKey((k) => k + 1);
    setLogs([]);
  }, []);

  const handleLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  return (
    <div className="h-[100dvh] w-screen flex overflow-hidden bg-kaboom-dark">
      {/* ─── Left sidebar ─── */}
      <div className="w-60 lg:w-68 flex-shrink-0 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <h1 className="text-sm font-black text-kaboom-gold">Test Scenarios</h1>
          <a href="/lobby" className="text-[10px] text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-white/5">Exit</a>
        </div>

        <div className="flex-1 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group} className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-kaboom-accent uppercase tracking-wider px-2 mb-0.5">{group}</div>
              {SCENARIOS.filter((s) => s.group === group).map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg mb-0.5 transition-all ${
                    activeId === s.id
                      ? 'bg-kaboom-accent/15 border border-kaboom-accent/30 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="text-[11px] font-medium leading-tight">{s.label}</div>
                  <div className="text-[9px] text-gray-500 leading-tight mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Log panel */}
        <div className="border-t border-gray-800 p-2 h-36 overflow-y-auto">
          <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Event Log</div>
          {logs.length === 0 && <div className="text-[10px] text-gray-600">Interact with the board...</div>}
          {logs.map((l, i) => (
            <div key={i} className="text-[10px] text-gray-400 font-mono leading-tight">{l}</div>
          ))}
        </div>
      </div>

      {/* ─── Right — full game board ─── */}
      <div className="flex-1 relative">
        <StatefulTestProvider key={key} scenario={active} onLog={handleLog}>
          <GameBoard
            key={key}
            gameState={active.gameState}
            currentUserId="local-player"
            onQuit={() => { window.location.href = '/lobby'; }}
          />
        </StatefulTestProvider>
      </div>
    </div>
  );
}
