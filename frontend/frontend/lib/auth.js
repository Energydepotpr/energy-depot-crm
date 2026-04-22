'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize from cache immediately — no spinner on reload
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('crm_user');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Only show loading spinner if there's no cached user
    const cached = localStorage.getItem('crm_user');
    return !cached;
  });

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      api.me()
        .then(u => {
          setUser(u);
          localStorage.setItem('crm_user', JSON.stringify(u));
        })
        .catch(() => {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      localStorage.removeItem('crm_user');
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
