import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAuthHeader,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  apiFetch,
  updateTransaction,
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
} from '../services/apiClient';
import { Transaction, TransactionUpdateRequest } from '../types/api';

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

  it('apiFetch omits Content-Type header when body is FormData', async () => {
    setAuthToken('form-token');
    const formData = new FormData();
    formData.append('key', 'value');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await apiFetch('/upload', { method: 'POST', body: formData });
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['Authorization']).toBe('Bearer form-token');
  });

  it('apiFetch normalizes endpoints missing leading slash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await apiFetch('no-leading-slash');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/no-leading-slash', expect.anything());
  });

  it('updateTransaction sends PUT request with correct URL, auth headers, and body', async () => {
    setAuthToken('auth-token-123');
    const mockTx: Transaction = {
      id: 'tx-123',
      description: 'Updated lunch',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-22T12:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTx,
    });

    const payload: TransactionUpdateRequest = {
      amount: 75000,
      description: 'Updated lunch',
      account_id: 'acc-1',
      category_id: 'cat-1',
      transaction_date: '2026-09-22T12:00:00Z',
    };

    const res = await updateTransaction('tx-123', payload);
    expect(res).toEqual(mockTx);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/transactions/tx-123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer auth-token-123',
        }),
      })
    );
  });
});

describe('Settings and BYOK API Client functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getSettings calls GET /settings', async () => {
    const mockSettings = {
      telegram: { is_connected: true, telegram_chat_id: 12345, bot_username: 'RezekifyBot' },
      ai: {
        is_custom_ai_enabled: false,
        provider: 'SYSTEM',
        model: 'gemini-2.5-flash',
        has_api_key: false,
        available_models: { GEMINI: ['gemini-2.5-flash'], GROQ: ['llama-3.3-70b'] },
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });

    const res = await getSettings();
    expect(res).toEqual(mockSettings);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings',
      expect.objectContaining({ method: undefined })
    );
  });

  it('validateAIKey calls POST /settings/ai/validate', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, message: 'Valid' }),
    });

    const res = await validateAIKey({
      provider: 'GEMINI',
      api_key: 'test-key-12345',
      model: 'gemini-2.5-flash',
    });
    expect(res.valid).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/ai/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'GEMINI',
          api_key: 'test-key-12345',
          model: 'gemini-2.5-flash',
        }),
      })
    );
  });

  it('updateAISettings calls PUT /settings/ai', async () => {
    const mockUpdated = {
      is_custom_ai_enabled: true,
      provider: 'GROQ',
      model: 'llama-3.3-70b',
      has_api_key: true,
      key_hint: '...70b',
      available_models: { GEMINI: [], GROQ: [] },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdated,
    });

    const res = await updateAISettings({
      is_custom_ai_enabled: true,
      provider: 'GROQ',
      model: 'llama-3.3-70b',
      api_key: 'groq-key-99',
    });
    expect(res).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/ai',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          is_custom_ai_enabled: true,
          provider: 'GROQ',
          model: 'llama-3.3-70b',
          api_key: 'groq-key-99',
        }),
      })
    );
  });

  it('unlinkTelegram calls POST /settings/telegram/unlink', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Unlinked' }),
    });

    const res = await unlinkTelegram();
    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/telegram/unlink',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getTelegramPairingCode calls POST /auth/telegram-pairing-code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairing_code: 'DK-4444' }),
    });

    const res = await getTelegramPairingCode();
    expect(res.pairing_code).toBe('DK-4444');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/telegram-pairing-code',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
