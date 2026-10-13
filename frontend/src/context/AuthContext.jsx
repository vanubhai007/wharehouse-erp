import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('hrw_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hrw_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.data.data);
        localStorage.setItem('hrw_user', JSON.stringify(res.data.data));
      })
      .catch(() => {
        localStorage.removeItem('hrw_token');
        localStorage.removeItem('hrw_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: u, token } = res.data.data;
    localStorage.setItem('hrw_token', token);
    localStorage.setItem('hrw_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const bootstrapRegister = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    const { user: u, token } = res.data.data;
    localStorage.setItem('hrw_token', token);
    localStorage.setItem('hrw_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('hrw_token');
    localStorage.removeItem('hrw_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, bootstrapRegister }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
