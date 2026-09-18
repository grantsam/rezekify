import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthHeader, setAuthToken, clearAuthToken, getAuthToken, apiFetch } from '../services/apiClient';

describe('apiClient authentication headers and utilities', () => {
  beforeEach(() => {
    clearAuthToken();
    vi.restoreAllMocks();
  });

  it('injects Bearer token when token is set', () => {
    setAuthToken('sample-jwt-token');
    expect(getAuthToken()).toBe('sample-jwt-token');
    const header = getAuthHeader();
    expect(header).toEqual({ Authorization: 'Bearer sample-jwt-token' });
  });

  it('returns empty headers when unauthenticated', () => {
    const header = getAuthHeader();
    expect(header).toEqual({});
  });

  it('clears token cleanly', () => {
    setAuthToken('token-to-clear');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
    expect(getAuthHeader()).toEqual({});
  });

  it('apiFetch makes authenticated requests with JSON headers', async () => {
    setAuthToken('auth-token-123');
    const mockResponse = { success: true };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const data = await apiFetch('/test-endpoint');
    expect(data).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/test-endpoint',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer auth-token-123',
        }),
      })
    );
  });

  it('apiFetch throws error with detail message on failed request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' }),
    });

    await expect(apiFetch('/protected-endpoint')).rejects.toThrow('Invalid credentials');
  });

  it('apiFetch throws default error message when response has no detail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Parsing failed');
      },
    });

    await expect(apiFetch('/broken-endpoint')).rejects.toThrow('Request failed with status 500');
  });
});
