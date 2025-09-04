import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) setAuthToken(token);
  }, [token]);

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
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('token');
  };

  const value = useMemo(() => ({ user, token, login, logout, setUser }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
