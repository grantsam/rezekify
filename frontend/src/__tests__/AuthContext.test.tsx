import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as apiClient from '../services/apiClient';

describe('AuthContext and useAuth hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('throws an error when useAuth is used outside AuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    consoleErrorSpy.mockRestore();
  });

  it('initializes in unauthenticated state when no token is present', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(apiFetchSpy).not.toHaveBeenCalled();
  });

  it('bootstraps user session when a valid token exists in storage', async () => {
    apiClient.setAuthToken('existing-jwt-token');

    const mockProfile = {
      id: 'usr-123',
      email: 'alex@example.com',
      full_name: 'Alex Johnson',
      telegram_chat_id: 998877,
    };

    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint) => {
      if (endpoint === '/auth/me') {
        return mockProfile as any;
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('existing-jwt-token');
    expect(result.current.user).toEqual(mockProfile);
  });

  it('clears token and resets state if session bootstrap fails with 401/error', async () => {
    apiClient.setAuthToken('expired-jwt-token');

    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Unauthorized'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(apiClient.getAuthToken()).toBeNull();
  });

  it('logs in successfully, saves token, and fetches user profile', async () => {
    const mockProfile = {
      id: 'usr-456',
      email: 'siti@example.com',
      full_name: 'Siti Rahma',
      telegram_chat_id: null,
    };

    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint) => {
      if (endpoint === '/auth/login') {
        return { access_token: 'new-login-token' } as any;
      }
      if (endpoint === '/auth/me') {
        return mockProfile as any;
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('siti@example.com', 'secretpass');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('new-login-token');
    expect(result.current.user).toEqual(mockProfile);
    expect(apiClient.getAuthToken()).toBe('new-login-token');
  });

  it('propagates login failure without persisting invalid token', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Invalid email or password'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.login('wrong@example.com', 'badpass');
      })
    ).rejects.toThrow('Invalid email or password');

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(apiClient.getAuthToken()).toBeNull();
  });

  it('registers successfully, saves token, and sets user profile', async () => {
    const mockUser = {
      id: 'usr-789',
      email: 'budi@example.com',
      full_name: 'Budi Santoso',
      telegram_chat_id: null,
    };

    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint) => {
      if (endpoint === '/auth/register') {
        return {
          access_token: 'new-register-token',
          token_type: 'bearer',
          user: mockUser,
        } as any;
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.register('budi@example.com', 'mypassword', 'Budi Santoso');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('new-register-token');
    expect(result.current.user).toEqual(mockUser);
    expect(apiClient.getAuthToken()).toBe('new-register-token');
  });

  it('logs out and clears all auth state and stored token', async () => {
    apiClient.setAuthToken('active-token');

    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      id: 'usr-111',
      email: 'test@example.com',
      full_name: 'Test User',
      telegram_chat_id: null,
    } as any);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(apiClient.getAuthToken()).toBeNull();
  });
});
