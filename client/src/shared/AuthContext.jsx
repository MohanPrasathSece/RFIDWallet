import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [initializing, setInitializing] = useState(true);

  // Ensure axios has the token on mount and when token changes
  useEffect(() => {
    if (token) setAuthToken(token);
  }, [token]);

  // On first load, if we have a token but no user, fetch current user
  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (token && !user) {
          try {
            const { data } = await api.get('/auth/me');
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          } catch (e) {
            if (e?.response?.status === 401) {
              logout();
            }
          }
        }
      } finally {
        setInitializing(false);
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (identifier, password, as) => {
    // For students, backend uses `identifier` (email or rollNo)
    // For admins, backend expects `email`. Send both to be safe.
    const payload = { identifier, email: identifier, password, as };
    const { data } = await api.post('/auth/login', payload);
    // Set header immediately to avoid race before useEffect applies token
    setAuthToken(data.token);
    setToken(data.token);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = useMemo(() => ({ user, token, initializing, login, logout, setUser }), [user, token, initializing]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
