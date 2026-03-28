import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { GameProvider } from './contexts/GameContext.tsx';
import { MusicProvider } from './contexts/MusicContext.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <MusicProvider>
            <App />
          </MusicProvider>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
