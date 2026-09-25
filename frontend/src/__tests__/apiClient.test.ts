import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAuthHeader,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  apiFetch,
  updateAccount,
  deactivateAccount,
  getTransactions,
  updateTransaction,
  getVaults,
  toggleVaultLock,
  updateVault,
  deleteVault,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
  updateUserProfile,
  submitVoice,
} from '../services/apiClient';
import {
  Account,
  AccountUpdateRequest,
  Transaction,
  TransactionUpdateRequest,
  Vault,
  VaultUpdateRequest,
  Category,
  CategoryCreateRequest,
  CategoryUpdateRequest,
} from '../types/api';

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

  it('apiFetch attaches an AbortSignal and cleans up timeout on success', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await apiFetch('/timeout-check');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/timeout-check',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('apiFetch cleans up timeout on failure in finally block', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await expect(apiFetch('/fail-check')).rejects.toThrow('Network failure');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('apiFetch aborts controller signal when 90s timeout expires', async () => {
    vi.useFakeTimers();
    try {
      let fetchSignal: AbortSignal | undefined;
      global.fetch = vi.fn().mockImplementation((_url, init) => {
        fetchSignal = init?.signal;
        return new Promise((_resolve, reject) => {
          fetchSignal?.addEventListener('abort', () => {
            reject(new DOMException('Timeout aborted', 'AbortError'));
          });
        });
      });

      const fetchPromise = apiFetch('/slow-endpoint');
      expect(fetchSignal?.aborted).toBe(false);

      vi.advanceTimersByTime(90_000);
      expect(fetchSignal?.aborted).toBe(true);

      await expect(fetchPromise).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('apiFetch links caller abort signal', async () => {
    const callerController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      receivedSignal = init?.signal;
      return new Promise((_resolve, reject) => {
        if (receivedSignal) {
          receivedSignal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    const fetchPromise = apiFetch('/caller-signal-check', { signal: callerController.signal });
    expect(receivedSignal?.aborted).toBe(false);
    callerController.abort();
    expect(receivedSignal?.aborted).toBe(true);
    await expect(fetchPromise).rejects.toThrow();
  });

  it('apiFetch immediately aborts if caller signal is already aborted', async () => {
    const callerController = new AbortController();
    callerController.abort();

    let receivedSignal: AbortSignal | undefined;
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      receivedSignal = init?.signal;
      if (receivedSignal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await expect(
      apiFetch('/pre-aborted-check', { signal: callerController.signal })
    ).rejects.toThrow();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('apiFetch handles 401: clears token and redirects to / if not on /', async () => {
    setAuthToken('expired-token');
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      pathname: '/dashboard',
      href: 'http://localhost/dashboard',
    } as any;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });

    await expect(apiFetch('/protected')).rejects.toThrow('Unauthorized');
    expect(getAuthToken()).toBeNull();
    expect(window.location.href).toBe('/');

    (window as any).location = originalLocation;
  });

  it('apiFetch handles 401: clears token but does not redirect for auth endpoints', async () => {
    setAuthToken('expired-token');
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      pathname: '/dashboard',
      href: 'http://localhost/dashboard',
    } as any;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' }),
    });

    await expect(apiFetch('/auth/login')).rejects.toThrow('Invalid credentials');
    expect(getAuthToken()).toBeNull();
    expect(window.location.href).toBe('http://localhost/dashboard');

    (window as any).location = originalLocation;
  });

  it('apiFetch handles 401: clears token but does not redirect if already on /', async () => {
    setAuthToken('expired-token');
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      pathname: '/',
      href: 'http://localhost/',
    } as any;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });

    await expect(apiFetch('/protected')).rejects.toThrow('Unauthorized');
    expect(getAuthToken()).toBeNull();
    expect(window.location.href).toBe('http://localhost/');

    (window as any).location = originalLocation;
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

  it('getTransactions sends GET /transactions with serialized query parameters', async () => {
    setAuthToken('auth-token-123');
    const mockResponse = {
      items: [
        {
          id: 'tx-1',
          description: 'Belanja Buku',
          source_channel: 'WEB_MANUAL',
          transaction_date: '2026-09-21T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await getTransactions({
      account_id: 'acc-123',
      category_id: 'cat-456',
      search: 'Buku',
      start_date: '2026-09-01T00:00:00Z',
      end_date: '2026-09-30T23:59:59Z',
      page: 1,
      page_size: 10,
    });

    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/transactions?account_id=acc-123&category_id=cat-456&search=Buku&start_date=2026-09-01T00%3A00%3A00Z&end_date=2026-09-30T23%3A59%3A59Z&page=1&page_size=10',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer auth-token-123',
        }),
      })
    );
  });

  it('getTransactions handles empty/optional params', async () => {
    setAuthToken('auth-token-123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 1 }),
    });

    await getTransactions();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/transactions',
      expect.anything()
    );
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

  it('getVaults calls GET /vaults and returns vaults list', async () => {
    setAuthToken('auth-token-123');
    const mockVaults: Vault[] = [
      {
        id: 'vault-1',
        name: 'Dana Darurat',
        vault_type: 'SAVINGS',
        target_amount: 10000000,
        allocated_amount: 5000000,
        target_date: '2026-12-31',
        is_locked: false,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVaults,
    });

    const res = await getVaults();
    expect(res).toEqual(mockVaults);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer auth-token-123',
        }),
      })
    );
  });

  it('toggleVaultLock sends PATCH /vaults/:id/toggle-lock', async () => {
    setAuthToken('auth-token-123');
    const mockVault: Vault = {
      id: 'vault-1',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 5000000,
      is_locked: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVault,
    });

    const res = await toggleVaultLock('vault-1');
    expect(res).toEqual(mockVault);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults/vault-1/toggle-lock',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer auth-token-123',
        }),
      })
    );
  });

  it('updateVault sends PUT /vaults/:id with payload', async () => {
    setAuthToken('auth-token-123');
    const mockVault: Vault = {
      id: 'vault-1',
      name: 'Dana Darurat Update',
      vault_type: 'SAVINGS',
      target_amount: 15000000,
      allocated_amount: 6000000,
      is_locked: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVault,
    });

    const payload: VaultUpdateRequest = {
      name: 'Dana Darurat Update',
      target_amount: 15000000,
      allocated_amount: 6000000,
    };

    const res = await updateVault('vault-1', payload);
    expect(res).toEqual(mockVault);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults/vault-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer auth-token-123',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('deleteVault sends DELETE /vaults/:id', async () => {
    setAuthToken('auth-token-123');
    const mockResult = { detail: 'Vault deleted successfully' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResult,
    });

    const res = await deleteVault('vault-1');
    expect(res).toEqual(mockResult);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults/vault-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
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
        available_models: { GEMINI: ['gemini-2.5-flash'], GROQ: ['llama-3.3-70b-versatile'] },
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
      model: 'llama-3.3-70b-versatile',
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
      model: 'llama-3.3-70b-versatile',
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
          model: 'llama-3.3-70b-versatile',
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

  it('updateUserProfile calls PUT /settings/profile', async () => {
    const mockProfile = {
      id: 'user-123',
      email: 'test@rezekify.local',
      full_name: 'Tester',
      monthly_cycle_day: 15,
      safe_runway_threshold: 40000,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProfile,
    });

    const res = await updateUserProfile({
      monthly_cycle_day: 15,
      safe_runway_threshold: 40000,
    });
    expect(res).toEqual(mockProfile);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/profile',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          monthly_cycle_day: 15,
          safe_runway_threshold: 40000,
        }),
      })
    );
  });
});

describe('Categories API Client functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAuthToken('cat-auth-token');
  });

  it('getCategories calls GET /categories', async () => {
    const mockCategories: Category[] = [
      { id: 'cat-1', name: 'Makanan', category_type: 'EXPENSE', icon: 'utensils', color: '#ef4444' },
      { id: 'cat-2', name: 'Gaji', category_type: 'INCOME', icon: 'briefcase', color: '#10b981' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCategories,
    });

    const res = await getCategories();
    expect(res).toEqual(mockCategories);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/categories',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cat-auth-token',
        }),
      })
    );
  });

  it('createCategory calls POST /categories with payload', async () => {
    const payload: CategoryCreateRequest = {
      name: 'Transportasi',
      category_type: 'EXPENSE',
      icon: 'car',
      color: '#3b82f6',
    };
    const mockCreated: Category = {
      id: 'cat-3',
      ...payload,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCreated,
    });

    const res = await createCategory(payload);
    expect(res).toEqual(mockCreated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/categories',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer cat-auth-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('updateCategory calls PUT /categories/:id with payload', async () => {
    const payload: CategoryUpdateRequest = {
      name: 'Transportasi Umum',
      color: '#06b6d4',
    };
    const mockUpdated: Category = {
      id: 'cat-3',
      name: 'Transportasi Umum',
      category_type: 'EXPENSE',
      icon: 'car',
      color: '#06b6d4',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdated,
    });

    const res = await updateCategory('cat-3', payload);
    expect(res).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/categories/cat-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer cat-auth-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('deleteCategory calls DELETE /categories/:id', async () => {
    const mockResponse = { detail: 'Category deleted.' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await deleteCategory('cat-3');
    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/categories/cat-3',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer cat-auth-token',
        }),
      })
    );
  });
});

describe('Accounts API Client functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAuthToken('acc-auth-token');
  });

  it('updateAccount calls PUT /accounts/:id with payload', async () => {
    const payload: AccountUpdateRequest = {
      name: 'Bank Jago Bisnis',
      account_type: 'BANK',
    };
    const mockUpdated: Account = {
      id: 'acc-1',
      name: 'Bank Jago Bisnis',
      account_type: 'BANK',
      current_balance: 1500000,
      is_active: true,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdated,
    });

    const res = await updateAccount('acc-1', payload);
    expect(res).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/accounts/acc-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer acc-auth-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('deactivateAccount calls DELETE /accounts/:id', async () => {
    const mockResponse = { detail: 'Rekening berhasil dinonaktifkan.' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await deactivateAccount('acc-1');
    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/accounts/acc-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer acc-auth-token',
        }),
      })
    );
  });
});

describe('submitVoice API Client function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAuthToken('voice-auth-token');
  });

  it('submits voice note blob via FormData to /dashboard/ai-voice', async () => {
    const mockBlob = new Blob(['voice-data'], { type: 'audio/webm' });
    const mockResponse = {
      reply: 'Tercatat: Rp 25.000 via BCA',
      transcription: 'beli kopi 25rb',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await submitVoice(mockBlob, 'struk kopi');
    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/dashboard/ai-voice',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer voice-auth-token',
        }),
      })
    );

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(Blob);
    expect(body.get('message')).toBe('struk kopi');
  });

  it('submits voice note blob without caption', async () => {
    const mockBlob = new Blob(['voice-data'], { type: 'audio/webm' });
    const mockResponse = {
      reply: 'Tercatat!',
      transcription: 'beli bensin 50rb',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await submitVoice(mockBlob);
    expect(res).toEqual(mockResponse);

    const callArgs = (global.fetch as any).mock.calls[0];
    const body = callArgs[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(Blob);
    expect(body.get('message')).toBeNull();
  });
});

