import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.tsx';
import LoginPage from './pages/LoginPage.tsx';
import LobbyPage from './pages/LobbyPage.tsx';
import GamePage from './pages/GamePage.tsx';
import LeaderboardPage from './pages/LeaderboardPage.tsx';
import SpecialsTestPage from './pages/SpecialsTestPage.tsx';

const IS_DEV = import.meta.env.DEV;

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center landing-bg">
        <div className="text-2xl font-bold text-kaboom-gold animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/lobby" /> : <LoginPage />}
      />
      <Route
        path="/lobby"
        element={user ? <LobbyPage /> : <Navigate to="/login" />}
      />
      <Route
        path="/game"
        element={user ? <GamePage /> : <Navigate to="/login" />}
      />
      <Route
        path="/leaderboard"
        element={user ? <LeaderboardPage /> : <Navigate to="/login" />}
      />
      {IS_DEV && <Route path="/test/specials" element={<SpecialsTestPage />} />}
      <Route path="*" element={<Navigate to={user ? '/lobby' : '/login'} />} />
    </Routes>
  );
}

export default App;
