import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, getAuthToken, setAuthToken, clearAuthToken } from '../services/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id?: number | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await apiFetch<UserProfile>('/auth/me');
        if (isMounted) {
          setUser(userProfile);
          setToken(storedToken);
        }
      } catch {
        clearAuthToken();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.access_token);
      const userProfile = await apiFetch<UserProfile>('/auth/me');
      setUser(userProfile);
      setToken(res.access_token);
    } catch (err) {
      clearAuthToken();
      setUser(null);
      setToken(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{
        access_token: string;
        token_type?: string;
        user?: UserProfile;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      setAuthToken(res.access_token);
      let userProfile = res.user;
      if (!userProfile) {
        userProfile = await apiFetch<UserProfile>('/auth/me');
      }
      setUser(userProfile);
      setToken(res.access_token);
    } catch (err) {
      clearAuthToken();
      setUser(null);
      setToken(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with local eviction even if network fails
    } finally {
      clearAuthToken();
      setUser(null);
      setToken(null);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
