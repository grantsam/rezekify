/**
 * Authenticated API Client for rezekify backend services.
 */

import {
  Account,
  AccountUpdateRequest,
  Transaction,
  TransactionUpdateRequest,
  PaginatedTransactionsResponse,
  TransactionFilterParams,
  Vault,
  VaultUpdateRequest,
  VaultDepositRequest,
  VaultPayBillRequest,
  VaultPayBillResponse,
  VaultDistributeRequest,
  VaultDistributeResponse,
  Category,
  CategoryCreateRequest,
  CategoryUpdateRequest,
  SettingsResponse,
  AIKeyValidateRequest,
  AIKeyValidateResponse,
  AISettingsUpdateRequest,
  AISettingsResponse,
  TelegramUnlinkResponse,
  TelegramPairingCodeResponse,
  UserProfileResponse,
  UserProfileUpdateRequest,
  VoiceChatResponse,
  ChatMessageItem,
  EnrichedChatResponse,
  CashflowSummaryResponse,
} from '../types/api';

const TOKEN_KEY = 'rezekify_auth_token';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('auth_token');
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('auth_token');
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAuthToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const promise = (async () => {
    const refreshController = new AbortController();
    const refreshTimeout = setTimeout(() => refreshController.abort(), 15_000);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal: refreshController.signal,
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      if (data && data.access_token) {
        setAuthToken(data.access_token);
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(refreshTimeout);
      refreshPromise = null;
    }
  })();

  refreshPromise = promise;
  return promise;
}

export const executeTokenRefresh = refreshAuthToken;

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // 90s timeout controller for LLM OCR and long requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  // Link caller signal if provided
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    let response = await fetch(`${baseUrl}${cleanEndpoint}`, {
      method: options.method,
      credentials: 'include',
      ...options,
      headers,
      signal: controller.signal,
    });

    const unrefreshableEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
    const isUnrefreshableAuth = unrefreshableEndpoints.some((ep) => cleanEndpoint === ep || cleanEndpoint === ep.slice(1));

    if (response.status === 401) {
      if (isUnrefreshableAuth) {
        clearAuthToken();
        const errorData = await response.json().catch(() => ({}));
        let message = `Request failed with status ${response.status}`;
        if (typeof errorData?.detail === 'string') {
          message = errorData.detail;
        } else if (Array.isArray(errorData?.detail)) {
          message = errorData.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
        }
        throw new Error(message);
      }

      const newToken = await executeTokenRefresh();
      if (newToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(`${baseUrl}${cleanEndpoint}`, {
          method: options.method,
          credentials: 'include',
          ...options,
          headers: retryHeaders,
          signal: controller.signal,
        });
      } else {
        clearAuthToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let message = `Request failed with status ${response.status}`;
      if (typeof errorData?.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData?.detail)) {
        message = errorData.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
      }
      throw new Error(message);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function updateTransaction(
  id: string,
  data: TransactionUpdateRequest
): Promise<Transaction> {
  return apiFetch<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTransaction(id: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>(`/transactions/${id}`, {
    method: 'DELETE',
  });
}

export async function getTransactions(
  params?: TransactionFilterParams
): Promise<PaginatedTransactionsResponse> {
  const query = new URLSearchParams();
  if (params?.account_id) query.append('account_id', params.account_id);
  if (params?.category_id) query.append('category_id', params.category_id);
  if (params?.search) query.append('search', params.search);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);
  if (params?.page !== undefined) query.append('page', String(params.page));
  if (params?.page_size !== undefined) query.append('page_size', String(params.page_size));

  const qs = query.toString();
  return apiFetch<PaginatedTransactionsResponse>(`/transactions${qs ? `?${qs}` : ''}`);
}

export async function downloadTransactionsCSV(params?: TransactionFilterParams): Promise<void> {
  const query = new URLSearchParams();
  if (params?.account_id) query.append('account_id', params.account_id);
  if (params?.category_id) query.append('category_id', params.category_id);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);

  const qs = query.toString();
  const endpoint = `/transactions/export${qs ? `?${qs}` : ''}`;
  const baseUrl = API_BASE_URL;

  let headers: Record<string, string> = { ...getAuthHeader() };

  let response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    const newToken = await executeTokenRefresh();
    if (newToken) {
      headers = { ...headers, Authorization: `Bearer ${newToken}` };
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
    }
  }

  if (!response.ok) {
    throw new Error(`Gagal mengunduh CSV: status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'rezekify_transaksi.csv';
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  // ponytail: Browser-based anchor click for CSV download; upgrade to StreamSaver.js if files exceed browser memory limits.
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export const exportTransactionsCsv = downloadTransactionsCSV;

export async function getVaults(): Promise<Vault[]> {
  return apiFetch<Vault[]>('/vaults');
}

export async function toggleVaultLock(id: string): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}/toggle-lock`, {
    method: 'PATCH',
  });
}

export async function updateVault(
  id: string,
  data: VaultUpdateRequest
): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteVault(id: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>(`/vaults/${id}`, {
    method: 'DELETE',
  });
}

// ponytail: direct payload pass-through without zod validation; add schema parser when client-side form validation layer is centralized.
export async function depositVault(
  id: string,
  data: VaultDepositRequest
): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}/deposit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function payBillVault(
  id: string,
  data: VaultPayBillRequest
): Promise<VaultPayBillResponse> {
  return apiFetch<VaultPayBillResponse>(`/vaults/${id}/pay-bill`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ponytail: direct payload pass-through without zod validation; add schema parser when client-side form validation layer is centralized.
export async function distributeToVaults(
  data: VaultDistributeRequest
): Promise<VaultDistributeResponse> {
  return apiFetch<VaultDistributeResponse>('/vaults/distribute', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export async function createCategory(data: CategoryCreateRequest): Promise<Category> {
  return apiFetch<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: CategoryUpdateRequest): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function getSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>('/settings');
}

export async function validateAIKey(payload: AIKeyValidateRequest): Promise<AIKeyValidateResponse> {
  return apiFetch<AIKeyValidateResponse>('/settings/ai/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAISettings(payload: AISettingsUpdateRequest): Promise<AISettingsResponse> {
  return apiFetch<AISettingsResponse>('/settings/ai', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function unlinkTelegram(): Promise<TelegramUnlinkResponse> {
  return apiFetch<TelegramUnlinkResponse>('/settings/telegram/unlink', {
    method: 'POST',
  });
}

export async function getTelegramPairingCode(): Promise<TelegramPairingCodeResponse> {
  return apiFetch<TelegramPairingCodeResponse>('/auth/telegram-pairing-code', {
    method: 'POST',
  });
}

export async function updateUserProfile(payload: UserProfileUpdateRequest): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>('/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function submitVoice(audioBlob: Blob, caption?: string): Promise<VoiceChatResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice-note.webm');
  if (caption) {
    formData.append('message', caption);
  }
  return apiFetch<VoiceChatResponse>('/dashboard/ai-voice', {
    method: 'POST',
    body: formData,
  });
}

export async function updateAccount(id: string, data: AccountUpdateRequest): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deactivateAccount(id: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>(`/accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function getChatMessages(
  limit: number = 50,
  offset: number = 0
): Promise<ChatMessageItem[]> {
  const query = new URLSearchParams();
  query.append('limit', String(limit));
  query.append('offset', String(offset));
  return apiFetch<ChatMessageItem[]>(`/dashboard/ai-chat/messages?${query.toString()}`);
}

export async function clearChatMessages(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/dashboard/ai-chat/messages', {
    method: 'DELETE',
  });
}

export async function submitChatMessage(message: string): Promise<EnrichedChatResponse> {
  return apiFetch<EnrichedChatResponse>('/dashboard/ai-chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function submitChatReceipt(file: File, message?: string): Promise<EnrichedChatResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (message) {
    formData.append('message', message);
  }
  return apiFetch<EnrichedChatResponse>('/dashboard/ai-receipt', {
    method: 'POST',
    body: formData,
  });
}

export async function submitChatVoice(blob: Blob, caption?: string): Promise<EnrichedChatResponse> {
  const formData = new FormData();
  formData.append('file', blob, 'voice-note.webm');
  if (caption) {
    formData.append('message', caption);
  }
  return apiFetch<EnrichedChatResponse>('/dashboard/ai-voice', {
    method: 'POST',
    body: formData,
  });
}

export async function getCashflowSummary(): Promise<CashflowSummaryResponse> {
  return apiFetch<CashflowSummaryResponse>('/analytics/cashflow-summary');
}

export const apiClient = {
  updateAccount,
  deactivateAccount,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  getVaults,
  toggleVaultLock,
  updateVault,
  deleteVault,
  depositVault,
  payBillVault,
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
  getChatMessages,
  clearChatMessages,
  submitChatMessage,
  submitChatReceipt,
  submitChatVoice,
  getCashflowSummary,
  apiFetch,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  getAuthHeader,
  refreshAuthToken,
  executeTokenRefresh,
};

export default apiClient;
