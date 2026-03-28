import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';
import { useGameState } from '../hooks/useGameState.tsx';
import { useMusic } from '../contexts/MusicContext.tsx';
import HeroSection from '../components/landing/HeroSection.tsx';
import MultiplayerPanel from '../components/landing/MultiplayerPanel.tsx';
import BotsPanel from '../components/landing/BotsPanel.tsx';
import PlayOnlinePanel from '../components/landing/PlayOnlinePanel.tsx';
import MatchmakingScreen from '../components/landing/MatchmakingScreen.tsx';
import WaitingRoom from '../components/lobby/WaitingRoom.tsx';
import Tutorial from '../components/landing/Tutorial.tsx';

type View = 'hero' | 'online' | 'friends' | 'bots';

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const {
    roomState, gameState, createRoom, joinRoom, leaveRoom, startGame, startBotGame,
    joinMatchmaking, cancelMatchmaking, matchmakingStatus,
    error, clearError,
  } = useGameState();
  const music = useMusic();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('hero');
  const [showTutorial, setShowTutorial] = useState(false);

  // Redirect to game if game started
  useEffect(() => {
    if (gameState && gameState.phase !== 'WAITING') {
      navigate('/game');
    }
  }, [gameState, navigate]);

  // If in a room, show waiting room
  if (roomState && !(gameState && gameState.phase !== 'WAITING')) {
    return (
      <div className="min-h-screen landing-bg">
        <WaitingRoom
          roomState={roomState}
          currentUserId={user?.uid ?? ''}
          onStartGame={startGame}
          onLeaveRoom={leaveRoom}
        />
      </div>
    );
  }

  // Matchmaking search screen
  if (matchmakingStatus) {
    return (
      <MatchmakingScreen
        currentCount={matchmakingStatus.currentCount}
        targetCount={matchmakingStatus.targetCount}
        onCancel={cancelMatchmaking}
        onFillWithBots={() => {
          cancelMatchmaking();
          const botCount = matchmakingStatus.targetCount - 1;
          startBotGame('medium', botCount);
        }}
      />
    );
  }

  const displayName = user?.displayName ?? 'Player';

  return (
    <div className="min-h-screen landing-bg relative">
      {/* Top bar */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4">
        <button
          onClick={() => setView('hero')}
          className="text-lg font-black tracking-tight"
        >
          <span className="text-kaboom-accent">K</span>
          <span className="text-kaboom-gold text-sm">ABOOM</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={music.toggle}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
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
          <span className="text-gray-500 text-sm hidden sm:inline">{displayName}</span>
          <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="min-h-screen flex items-center justify-center pt-16 pb-8">
        {view === 'hero' && (
          <HeroSection
            onPlayOnline={() => setView('online')}
            onPlayFriends={() => setView('friends')}
            onPlayBots={() => setView('bots')}
          />
        )}
        {view === 'online' && (
          <PlayOnlinePanel
            onFindGame={(count) => joinMatchmaking(count)}
            onBack={() => setView('hero')}
          />
        )}
        {view === 'friends' && (
          <MultiplayerPanel
            username={displayName}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onBack={() => setView('hero')}
            error={error}
            onClearError={clearError}
          />
        )}
        {view === 'bots' && (
          <BotsPanel
            onStartBotGame={(difficulty) => startBotGame(difficulty, 3)}
            onBack={() => setView('hero')}
          />
        )}
      </div>

      {/* Fixed bottom-left How to Play button — hidden when tutorial is open */}
      {!showTutorial && (
        <button
          onClick={() => setShowTutorial(true)}
          className="fixed bottom-5 left-5 z-30 flex items-center gap-1.5 text-gray-400 hover:text-kaboom-gold transition-colors text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
            <rect x="4" y="2" width="12" height="18" rx="2" />
            <path d="M8 6h4M8 10h4M8 14h2" strokeLinecap="round" />
          </svg>
          How to Play
        </button>
      )}

      {/* Tutorial overlay */}
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
}
