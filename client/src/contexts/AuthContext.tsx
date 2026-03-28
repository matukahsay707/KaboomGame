import { createContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, hasFirebaseConfig } from '../config/firebase.ts';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  devLogin: (displayName: string) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestUser, setGuestUser] = useState<{ uid: string; displayName: string } | null>(null);

  // Restore guest user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('kaboom_dev_user');
    if (stored) {
      try {
        setGuestUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('kaboom_dev_user');
      }
    }

    if (hasFirebaseConfig && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setFirebaseUser(user);
        setLoading(false);
      });
      return unsubscribe;
    }

    setLoading(false);
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (!auth) throw new Error('Firebase not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  };

  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) throw new Error('Firebase not configured');
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    // Clear guest user
    if (guestUser) {
      setGuestUser(null);
      localStorage.removeItem('kaboom_dev_user');
    }
    // Also sign out of Firebase if signed in
    if (firebaseUser && auth) {
      await signOut(auth);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (guestUser) return guestUser.uid;
    if (firebaseUser) return firebaseUser.getIdToken();
    return null;
  };

  const devLogin = (displayName: string) => {
    const uid = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newGuestUser = { uid, displayName };
    setGuestUser(newGuestUser);
    localStorage.setItem('kaboom_dev_user', JSON.stringify(newGuestUser));
  };

  // Guest user takes priority (if they chose "Play as Guest"), then Firebase user
  const effectiveUser: User | null = guestUser
    ? ({ uid: guestUser.uid, displayName: guestUser.displayName, email: null } as unknown as User)
    : firebaseUser;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        loading,
        loginWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        logout,
        getIdToken,
        devLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
