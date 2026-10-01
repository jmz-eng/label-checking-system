import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { message } from 'antd';
import { fetchMe, login as loginApi } from '../api/auth';
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../api/http';
import { fetchMyMenus } from '../api/menus';
import type { AppMenu, UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  menus: AppMenu[];
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menus, setMenus] = useState<AppMenu[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [profile, menuData] = await Promise.all([fetchMe(), fetchMyMenus()]);
      setUser(profile);
      setMenus(menuData);
    } catch {
      clearStoredToken();
      setUser(null);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setMenus([]);
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginApi({ username, password });
    setStoredToken(response.token);
    try {
      const menuData = await fetchMyMenus();
      setUser(response.user);
      setMenus(menuData);
      message.success('登录成功');
    } catch (error) {
      clearStoredToken();
      setUser(null);
      setMenus([]);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setMenus([]);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      return user.permissions.includes('*') || user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, menus, loading, login, logout, hasPermission }),
    [user, menus, loading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
}
