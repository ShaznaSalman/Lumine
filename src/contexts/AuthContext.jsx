import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const AuthContext = createContext();

const usernameFromEmail = (email) => email?.split('@')[0] ?? '';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const login = (username, password) => {
    const email = `${username}@lumine.app`;
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginGuest = () => {
    setCurrentUser({ uid: null, displayName: 'Guest', isGuest: true });
    setIsGuest(true);
    setLoading(false);
    return Promise.resolve();
  };

  const logout = () => {
    if (isGuest || currentUser?.isGuest) {
      setCurrentUser(null);
      setIsGuest(false);
      return Promise.resolve();
    }
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isGuest) {
        setCurrentUser(user ? { ...user, displayName: usernameFromEmail(user.email) } : null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isGuest]);

  return (
    <AuthContext.Provider value={{ currentUser, login, loginGuest, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
