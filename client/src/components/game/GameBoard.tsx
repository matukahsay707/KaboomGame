import { useState, useEffect, useRef, useCallback } from 'react';
import type { ClientGameState } from '@kaboom/shared';
import { useGameState } from '../../hooks/useGameState.tsx';
import { useSound } from '../../hooks/useSound.tsx';
import { useMusic } from '../../contexts/MusicContext.tsx';
import { useTableLayout } from '../../hooks/useTableLayout.tsx';
import PlayerHand from './PlayerHand.tsx';
import CenterArea from './CenterArea.tsx';
import DrawnCardInline from './DrawnCardInline.tsx';
import DealAnimation from './DealAnimation.tsx';
import SneakPeek from './SneakPeek.tsx';
import GameStartBanner from './GameStartBanner.tsx';
import PeekAnimation from './PeekAnimation.tsx';
import TradeArcAnimation from './TradeArcAnimation.tsx';
import ActionBanner, { type BannerEvent } from './ActionBanner.tsx';

interface GameBoardProps {
  readonly gameState: ClientGameState;
  readonly currentUserId: string;
  readonly onQuit?: () => void;
}

type EntryPhase = 'dealing' | 'peeking' | 'starting' | 'playing';

export default function GameBoard({ gameState, currentUserId, onQuit }: GameBoardProps) {
  const {
    drawnCard, peekCards, specialPrompt, matchWindow, peekReveal,
    error, clearError, peekDone,
    drawFromDeck, drawFromDiscard,
    swapCard, discardCard, discardUseSpecial,
    useSpecial, skipSpecial, tradeSelect,
    matchAttempt, callKaboom,
    daniaKaboom,
    socket,
  } = useGameState();

  const { play } = useSound();
  const music = useMusic();
  const layout = useTableLayout(gameState.opponents.length);

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const prevPhaseRef = useRef(gameState.phase);
  const prevMatchWindowRef = useRef(!!matchWindow);
  const [bannerQueue, setBannerQueue] = useState<BannerEvent[]>([]);

  const queueBanner = useCallback((event: BannerEvent) => {
    setBannerQueue((prev) => [...prev, event]);
  }, []);

  const dequeueBanner = useCallback(() => {
    setBannerQueue((prev) => prev.slice(1));
  }, []);

  // Entry sequence: deal → peek → start banner → play
  const [entryPhase, setEntryPhase] = useState<EntryPhase>(() => {
    if (gameState.phase !== 'PEEK_PHASE') return 'playing';
    return 'dealing';
  });

  const isMyTurn = gameState.activePlayerId === currentUserId;

  // Sound on phase change
  useEffect(() => {
    if (prevPhaseRef.current !== gameState.phase) {
      if (gameState.phase === 'PLAYER_TURN' && isMyTurn) play('turnNotify');
      prevPhaseRef.current = gameState.phase;
    }
  }, [gameState.phase, isMyTurn, play]);

  // Kaboom banner + music duck
  useEffect(() => {
    if (gameState.kaboomCallerId && gameState.phase === 'KABOOM_FINAL') {
      const callerName = gameState.kaboomCallerId === currentUserId
        ? 'You'
        : gameState.opponents.find((o) => o.id === gameState.kaboomCallerId)?.displayName ?? 'Someone';
      play('kaboom');
      music.duck();
      queueBanner({
        playerName: callerName,
        actionText: 'KABOOM',
        detailText: 'Final round',
        accentColor: '#f5c518',
        secondaryPulse: '#e94560',
      });
      const timer = setTimeout(() => music.unduck(), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.kaboomCallerId, gameState.phase, play, music, queueBanner, currentUserId, gameState.opponents]);

  // Dania Kaboom — deeper boom + red flash
  useEffect(() => {
    if (daniaKaboom) play('daniaKaboom');
  }, [daniaKaboom, play]);

  useEffect(() => { if (drawnCard) play('cardDraw'); }, [drawnCard, play]);

  // Match window sounds
  useEffect(() => {
    const isOpen = !!matchWindow;
    if (isOpen && !prevMatchWindowRef.current) {
      play('matchWindowOpen');
    }
    if (!isOpen && prevMatchWindowRef.current) {
      play('matchWindowClose');
    }
    prevMatchWindowRef.current = isOpen;
  }, [matchWindow, play]);

  // Match window final-second ticks
  useEffect(() => {
    if (!matchWindow) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - matchWindow.startTime;
      const remaining = matchWindow.duration - elapsed;
      if (remaining <= 1000 && remaining > 0) {
        play('timerTick');
      }
    }, 250);
    return () => clearInterval(interval);
  }, [matchWindow, play]);

  // Socket listeners for action banners
  useEffect(() => {
    if (!socket) return;

    const resolvePlayerName = (playerId: string): string => {
      if (playerId === currentUserId) return 'You';
      return gameState.opponents.find((o) => o.id === playerId)?.displayName ?? 'Someone';
    };

    const onMatchSuccess = (data: { matcherId: string; slotIndex: number }) => {
      const name = resolvePlayerName(data.matcherId);
      play('matchSuccess');
      queueBanner({
        playerName: name,
        actionText: 'MATCHED',
        detailText: 'Card matched',
        accentColor: '#f5c518',
      });
    };

    const onMatchFail = (data: { playerId: string }) => {
      const name = resolvePlayerName(data.playerId);
      play('matchFail');
      queueBanner({
        playerName: name,
        actionText: 'WRONG MATCH',
        detailText: 'Penalty card',
        accentColor: '#e94560',
      });
    };

    const onActionAnnounce = (data: { type: string; playerId: string; playerName: string; targetPlayerName?: string }) => {
      const name = data.playerId === currentUserId ? 'You' : data.playerName;
      switch (data.type) {
        case 'peek':
          play('peek10');
          queueBanner({ playerName: name, actionText: 'PEEKED', detailText: 'at a card', accentColor: '#1de9b6' });
          break;
        case 'blindTrade':
          play('jackTrade');
          queueBanner({ playerName: name, actionText: 'BLIND TRADE', detailText: data.targetPlayerName ? `with ${data.targetPlayerName}` : '', accentColor: '#2196f3' });
          break;
        case 'queenPeek':
          play('queenPeek');
          queueBanner({ playerName: name, actionText: 'PEEKED', detailText: 'Queen ability', accentColor: '#9c27b0' });
          break;
        case 'queenPeekTrade':
          play('queenTrade');
          queueBanner({ playerName: name, actionText: 'PEEK & TRADE', detailText: data.targetPlayerName ? `with ${data.targetPlayerName}` : '', accentColor: '#9c27b0' });
          break;
        case 'queenTrade':
          play('queenTrade');
          queueBanner({ playerName: name, actionText: 'TRADED', detailText: 'Queen ability', accentColor: '#9c27b0' });
          break;
      }
    };

    socket.on('game:matchSuccess', onMatchSuccess);
    socket.on('game:matchFail', onMatchFail);
    socket.on('game:actionAnnounce', onActionAnnounce);

    return () => {
      socket.off('game:matchSuccess', onMatchSuccess);
      socket.off('game:matchFail', onMatchFail);
      socket.off('game:actionAnnounce', onActionAnnounce);
    };
  }, [socket, currentUserId, gameState.opponents, play, queueBanner]);

  useEffect(() => {
    if (error) { const t = setTimeout(clearError, 5000); return () => clearTimeout(t); }
  }, [error, clearError]);

  const handleSwap = (i: number) => { play('cardSwap'); swapCard(i); };
  const handleDiscard = () => { play('cardPlace'); discardCard(); };
  const handleMatchTap = (i: number) => { matchAttempt(i); };

  // ─── Inline peek/trade state ───
  const [tradeMySlot, setTradeMySlot] = useState<number | null>(null);
  const [tradeArc, setTradeArc] = useState<{ mySlot: number; oppId: string; oppSlot: number; isQueen: boolean } | null>(null);
  const [queenTradePhase, setQueenTradePhase] = useState(false);

  const isPeekMode = !!specialPrompt && isMyTurn && specialPrompt.ability === 'peek';
  const isQueenPeek = !!specialPrompt && isMyTurn && specialPrompt.ability === 'peekAndTrade';
  const isTradeMode = (!!specialPrompt && isMyTurn && specialPrompt.ability === 'blindTrade') || queenTradePhase;
  const isSelectingTradeTarget = isTradeMode && tradeMySlot !== null;

  const handlePeekTap = (playerId: string, slotIndex: number) => {
    const isQueen = specialPrompt?.ability === 'peekAndTrade';
    play(isQueen ? 'queenPeek' : 'peek10');
    useSpecial('peek', playerId, slotIndex);
    if (isQueen) {
      setTimeout(() => {
        setQueenTradePhase(true);
        play('buttonClick');
      }, 2000);
    }
  };

  const handleTradeSelectMyCard = (slotIndex: number) => {
    play('buttonClick');
    setTradeMySlot(slotIndex);
  };

  const handleTradeSelectOppCard = (playerId: string, slotIndex: number) => {
    if (tradeMySlot === null) return;
    setTradeArc({ mySlot: tradeMySlot, oppId: playerId, oppSlot: slotIndex, isQueen: queenTradePhase });
  };

  const handleTradeArcComplete = useCallback(() => {
    if (!tradeArc) return;
    tradeSelect(tradeArc.mySlot, tradeArc.oppId, tradeArc.oppSlot);
    setTradeArc(null);
    setTradeMySlot(null);
    setQueenTradePhase(false);
  }, [tradeArc, tradeSelect]);

  const handleSkipTrade = useCallback(() => {
    play('buttonClick');
    if (queenTradePhase) {
      setQueenTradePhase(false);
      setTradeMySlot(null);
      skipSpecial();
    } else {
      skipSpecial();
      setTradeMySlot(null);
    }
  }, [play, queenTradePhase, skipSpecial]);

  useEffect(() => {
    if (!specialPrompt && !queenTradePhase) {
      setTradeMySlot(null);
      setTradeArc(null);
    }
  }, [specialPrompt, queenTradePhase]);

  const handleDealComplete = useCallback(() => {
    if (peekCards.length > 0) {
      setEntryPhase('peeking');
    } else {
      setEntryPhase('starting');
    }
  }, [peekCards.length]);

  const handlePeekDone = useCallback(() => {
    peekDone();
    setEntryPhase('starting');
  }, [peekDone]);

  const handleGameStartBannerDone = useCallback(() => {
    setEntryPhase('playing');
    music.swell();
  }, [music]);

  const { cards, opponentPositions, showOpponentCards, tier } = layout;
  const canDraw = isMyTurn && !drawnCard && (gameState.phase === 'PLAYER_TURN' || gameState.phase === 'KABOOM_FINAL');
  const showKaboomBtn = isMyTurn && !drawnCard && gameState.phase === 'PLAYER_TURN' && !gameState.kaboomCallerId;
  const isMobile = tier === 'phone-portrait' || tier === 'phone-landscape';
  const totalPlayers = gameState.opponents.length + 1;

  // Match window state
  const isMatchWindowOpen = !!matchWindow;
  const isDiscarder = isMatchWindowOpen && gameState.activePlayerId === currentUserId;
  const canMatch = isMatchWindowOpen && !isDiscarder;
  const isKaboomLocked = !!gameState.kaboomCallerId && gameState.you.calledKaboom;

  // ─── Deal animation phase ───
  if (entryPhase === 'dealing') {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden relative" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a3a2a 0%, #0d1117 70%)' }}>
        <DealAnimation
          playerCount={totalPlayers}
          cardsPerPlayer={4}
          onComplete={handleDealComplete}
          playSound={play}
        />
      </div>
    );
  }

  // ─── Sneak peek phase ───
  if (entryPhase === 'peeking' && peekCards.length > 0) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden relative" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a3a2a 0%, #0d1117 70%)' }}>
        <SneakPeek
          bottomCards={peekCards}
          onDone={handlePeekDone}
          playSound={play}
        />
      </div>
    );
  }

  if (entryPhase === 'peeking') {
    setEntryPhase('starting');
  }

  // Dim class for elements that should dim during match window
  const dimClass = isMatchWindowOpen ? 'match-dimmed' : 'match-undimmed';

  // ─── Main game table ───
  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a3a2a 0%, #0d1117 70%)' }}>
      {entryPhase === 'starting' && (
        <GameStartBanner onComplete={handleGameStartBannerDone} />
      )}

      {!peekReveal && <style>{`.game-table-content { filter: none; }`}</style>}

      {/* ─── Floating buttons — dim during match ─── */}
      <div className={dimClass}>
        {onQuit && (
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="absolute top-3 left-3 z-20 text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
        <button
          onClick={music.toggle}
          className="absolute top-3 right-3 z-20 text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          title={music.muted ? 'Unmute music' : 'Mute music'}
        >
          {music.muted ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
        {!isMobile && (
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="absolute top-3 right-12 z-20 text-gray-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Oval table area ─── */}
      <div className="absolute inset-0 mx-auto game-table-content" style={{ maxWidth: 1200, overflow: 'visible' }}>
        <div
          className="absolute rounded-[50%] border border-white/5 pointer-events-none"
          style={{
            left: '10%', right: '10%', top: '8%', bottom: '8%',
            background: 'radial-gradient(ellipse, rgba(26,58,42,0.3) 0%, transparent 70%)',
          }}
        />

        {/* Opponents on the oval — dim during match */}
        {gameState.opponents.map((opp, idx) => {
          const pos = opponentPositions[idx];
          if (!pos) return null;
          return (
            <div
              key={opp.id}
              className={`absolute transition-all duration-200 ${dimClass}`}
              style={{
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: `translate(-50%, -50%) rotate(${pos.angle}deg)`,
                transformOrigin: 'center center',
                overflow: 'visible',
              }}
            >
              <PlayerHand
                player={opp}
                isCurrentPlayer={false}
                isActive={gameState.activePlayerId === opp.id}
                cardWidth={cards.oppW}
                cardHeight={cards.oppH}
                compact={!showOpponentCards}
                peekMode={(isPeekMode || isQueenPeek) && !queenTradePhase ? true : isSelectingTradeTarget}
                onCardClick={
                  tradeArc ? undefined
                  : (isPeekMode || isQueenPeek) && !queenTradePhase ? (si) => handlePeekTap(opp.id, si)
                  : isSelectingTradeTarget ? (si) => handleTradeSelectOppCard(opp.id, si)
                  : undefined
                }
                kaboomLocked={!!gameState.kaboomCallerId && opp.calledKaboom}
                isDania={opp.displayName === 'Dania'}
              />
            </div>
          );
        })}

        {/* Center: deck + discard — always visible, internal dimming handled by CenterArea */}
        <div className="absolute left-1/2 transition-all duration-200" style={{ top: '45%', transform: 'translate(-50%, -50%)' }}>
          <CenterArea
            discardTop={gameState.discardTop}
            drawPileCount={gameState.drawPileCount}
            onDrawDeck={() => { play('cardDraw'); drawFromDeck(); }}
            onDrawDiscard={() => { play('cardDraw'); drawFromDiscard(); }}
            canDraw={canDraw && entryPhase === 'playing'}
            cardWidth={cards.centerW}
            cardHeight={cards.centerH}
            matchActive={isMatchWindowOpen}
            matchDuration={matchWindow?.duration}
            matchStartTime={matchWindow?.startTime}
          />
        </div>

        {/* Local player: bottom center — stays bright during match */}
        <div
          className="absolute left-1/2 transition-all duration-200"
          style={{ bottom: isMobile ? '1%' : '3%', transform: 'translateX(-50%)' }}
        >
          {/* Drawn card hovering above the grid */}
          {drawnCard && isMyTurn && (
            <div className="flex justify-center mb-2">
              <DrawnCardInline
                card={drawnCard}
                cardWidth={cards.localW}
                cardHeight={cards.localH}
                onSwap={handleSwap}
                onDiscard={handleDiscard}
                onUseSpecial={
                  (['10', 'J', 'Q'] as string[]).includes(drawnCard.rank)
                    ? () => { play('cardFlip'); discardUseSpecial(); }
                    : undefined
                }
              />
            </div>
          )}

          <PlayerHand
            player={gameState.you}
            isCurrentPlayer={true}
            isActive={isMyTurn}
            cardWidth={cards.localW}
            cardHeight={cards.localH}
            onCardClick={
              tradeArc ? undefined
              : drawnCard ? handleSwap
              : (isPeekMode || isQueenPeek) && !queenTradePhase ? (si) => handlePeekTap(gameState.you.id, si)
              : isTradeMode && !isSelectingTradeTarget ? handleTradeSelectMyCard
              : canMatch ? handleMatchTap
              : undefined
            }
            highlightedSlots={drawnCard ? Array.from({ length: gameState.you.cards.length }, (_, i) => i) : []}
            matchMode={canMatch}
            peekMode={(isPeekMode || isQueenPeek) && !queenTradePhase ? true : isTradeMode && !isSelectingTradeTarget}
            selectedSlot={tradeMySlot}
            kaboomLocked={isKaboomLocked}
            isMobile={isMobile}
          />
          {showKaboomBtn && !isMobile && entryPhase === 'playing' && (
            <div className={`flex justify-center mt-2 ${dimClass}`}>
              <button onClick={callKaboom} className="btn-kaboom text-base px-6 py-2">KABOOM!</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Kaboom button — dim during match */}
      {showKaboomBtn && isMobile && entryPhase === 'playing' && (
        <button onClick={callKaboom} className={`fixed bottom-3 right-3 z-30 btn-kaboom text-sm px-5 py-3 rounded-xl ${dimClass}`}>
          KABOOM!
        </button>
      )}

      {/* Action banner — unified announcements for all game events */}
      <ActionBanner bannerQueue={bannerQueue} onDequeue={dequeueBanner} />

      {/* Sidebar */}
      {showSidebar && !isMobile && (
        <div className="fixed top-0 right-0 h-full w-72 bg-kaboom-mid/95 backdrop-blur border-l border-gray-700/50 z-30 p-4 overflow-y-auto animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-kaboom-gold">Game Info</h3>
            <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            <div className="text-xs text-gray-400">Turn Order</div>
            {gameState.turnOrder.map((pid) => {
              const p = pid === currentUserId ? gameState.you : gameState.opponents.find((o) => o.id === pid);
              if (!p) return null;
              const isActive = gameState.activePlayerId === pid;
              return (
                <div key={pid} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isActive ? 'bg-kaboom-accent/10 border border-kaboom-accent/30' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-kaboom-accent' : 'bg-gray-600'}`} />
                  <span className={isActive ? 'text-white font-medium' : 'text-gray-400'}>
                    {p.displayName}{pid === currentUserId ? ' (You)' : ''}
                  </span>
                  <span className="ml-auto text-gray-500">{p.cardCount} cards</span>
                </div>
              );
            })}
          </div>
          {gameState.kaboomCallerId && (
            <div className="mt-4 p-2 bg-kaboom-gold/10 border border-kaboom-gold/30 rounded-lg text-xs text-kaboom-gold">
              KABOOM called!
            </div>
          )}
        </div>
      )}

      {/* ─── Overlays ─── */}
      {showQuitConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-kaboom-mid border border-gray-700 rounded-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-2">Quit Game?</h3>
            <p className="text-gray-400 text-sm mb-6">You'll leave the current game.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitConfirm(false)}
                className="flex-1 py-2.5 bg-kaboom-dark border border-gray-700 hover:border-gray-500 text-white font-medium rounded-xl transition-all">Cancel</button>
              <button onClick={() => { setShowQuitConfirm(false); onQuit?.(); }}
                className="flex-1 py-2.5 bg-kaboom-accent hover:bg-red-500 text-white font-bold rounded-xl transition-all">Quit</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-20 left-4 bg-red-900/90 border border-red-600 rounded-lg px-3 py-1.5 text-xs z-50 animate-fade-in max-w-[70vw]">
          {error}
        </div>
      )}

      {/* Dania Kaboom red screen flash */}
      {daniaKaboom && (
        <div className="fixed inset-0 z-[60] pointer-events-none" style={{ animation: 'daniaFlash 2s ease-out forwards' }}>
          <style>{`
            @keyframes daniaFlash {
              0% { background: rgba(233, 69, 96, 0); }
              10% { background: rgba(233, 69, 96, 0.4); }
              30% { background: rgba(233, 69, 96, 0.15); }
              100% { background: rgba(233, 69, 96, 0); }
            }
          `}</style>
        </div>
      )}

      {peekReveal && (
        <PeekAnimation
          card={peekReveal.card}
          sourcePlayerId={peekReveal.playerId}
          sourceSlotIndex={peekReveal.slotIndex}
          localPlayerId={currentUserId}
          opponentIds={gameState.opponents.map((o) => o.id)}
          onComplete={() => {}}
          playSound={play}
        />
      )}

      {tradeArc && (
        <TradeArcAnimation
          targetPlayerId={tradeArc.oppId}
          opponentIds={gameState.opponents.map((o) => o.id)}
          isQueen={tradeArc.isQueen}
          onComplete={handleTradeArcComplete}
          playSound={play}
        />
      )}

      {((isPeekMode || isQueenPeek) && !peekReveal && !queenTradePhase) && (
        <button
          onClick={() => { play('buttonClick'); skipSpecial(); }}
          className="fixed bottom-4 right-4 z-30 px-3 py-1.5 bg-black/30 backdrop-blur text-gray-500 hover:text-white text-[11px] rounded-lg border border-gray-700/20 transition-all"
        >
          Skip
        </button>
      )}

      {isTradeMode && !tradeArc && (
        <button
          onClick={handleSkipTrade}
          className="fixed bottom-4 right-4 z-30 px-3 py-1.5 bg-black/30 backdrop-blur text-gray-500 hover:text-white text-[11px] rounded-lg border border-gray-700/20 transition-all"
        >
          {queenTradePhase ? 'Skip Trade' : 'Skip'}
        </button>
      )}

      {isSelectingTradeTarget && !tradeArc && (
        <button
          onClick={() => setTradeMySlot(null)}
          className="fixed bottom-4 left-4 z-30 px-3 py-1.5 bg-black/30 backdrop-blur text-gray-500 hover:text-white text-[11px] rounded-lg border border-gray-700/20 transition-all"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
