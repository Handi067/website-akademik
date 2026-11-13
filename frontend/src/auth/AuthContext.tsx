import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, SESSION_EXPIRED, tokens } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from stored tokens.
  useEffect(() => {
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    get<User>('/auth/profile')
      .then((r) => setUser(r.data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await post<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', { username, password });
    tokens.set(r.data.accessToken, r.data.refreshToken);
    setUser(r.data.user);
  }, []);

  const logout = useCallback(() => {
    post('/auth/logout').catch(() => undefined);
    tokens.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
