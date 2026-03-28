import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { hasFirebaseConfig } from '../config/firebase.ts';

export default function LoginPage() {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle, devLogin } = useAuth();
  const [mode, setMode] = useState<'guest' | 'email' | 'signup'>('guest');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    devLogin(displayName.trim());
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
    }
  };

  return (
    <div className="min-h-screen landing-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight mb-3">
            <span className="text-kaboom-accent">K</span>
            <span className="text-kaboom-gold">A</span>
            <span className="text-white">B</span>
            <span className="text-kaboom-accent">O</span>
            <span className="text-kaboom-gold">O</span>
            <span className="text-white">M</span>
          </h1>
          <div className="h-1 w-20 mx-auto bg-gradient-to-r from-kaboom-accent via-kaboom-gold to-kaboom-accent rounded-full mb-3" />
          <p className="text-gray-400 text-base">
            The explosive card game of memory, strategy & quick reflexes
          </p>
        </div>

        {/* Login card */}
        <div className="bg-kaboom-mid/80 backdrop-blur border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-900/30 border border-red-600/50 rounded-xl p-3 mb-6 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Guest login — always available */}
          {mode === 'guest' && (
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Your Name</label>
                <input
                  type="text"
                  placeholder="What should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-kaboom-dark/80 rounded-xl border border-gray-700 focus:border-kaboom-gold focus:ring-1 focus:ring-kaboom-gold/30 focus:outline-none text-white placeholder-gray-500"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-kaboom-accent hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-kaboom-accent/20"
              >
                Play as Guest
              </button>
            </form>
          )}

          {/* Email login */}
          {(mode === 'email' || mode === 'signup') && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Display Name</label>
                  <input
                    type="text"
                    placeholder="What should we call you?"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-kaboom-dark/80 rounded-xl border border-gray-700 focus:border-kaboom-gold focus:ring-1 focus:ring-kaboom-gold/30 focus:outline-none text-white placeholder-gray-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-kaboom-dark/80 rounded-xl border border-gray-700 focus:border-kaboom-gold focus:ring-1 focus:ring-kaboom-gold/30 focus:outline-none text-white placeholder-gray-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-kaboom-dark/80 rounded-xl border border-gray-700 focus:border-kaboom-gold focus:ring-1 focus:ring-kaboom-gold/30 focus:outline-none text-white placeholder-gray-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-kaboom-accent hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-kaboom-accent/20"
              >
                {mode === 'signup' ? 'Sign Up' : 'Log In'}
              </button>
            </form>
          )}

          {/* Divider + options */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-700" />
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          <div className="space-y-3">
            {/* Google login — only if Firebase is configured */}
            {hasFirebaseConfig && (
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-gray-500 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            )}

            {/* Toggle between guest and email modes */}
            {mode === 'guest' && hasFirebaseConfig && (
              <button
                onClick={() => setMode('email')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-gray-500 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                Log in with Email
              </button>
            )}

            {mode === 'email' && (
              <p className="text-center text-gray-400 text-sm">
                Don't have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-kaboom-gold hover:underline font-medium">
                  Sign Up
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p className="text-center text-gray-400 text-sm">
                Already have an account?{' '}
                <button onClick={() => setMode('email')} className="text-kaboom-gold hover:underline font-medium">
                  Log In
                </button>
              </p>
            )}

            {(mode === 'email' || mode === 'signup') && (
              <p className="text-center text-gray-400 text-sm">
                <button onClick={() => setMode('guest')} className="text-gray-400 hover:text-white hover:underline">
                  Play as Guest instead
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
