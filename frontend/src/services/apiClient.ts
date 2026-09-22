/**
 * Authenticated API Client for rezekify backend services.
 */

import {
  Transaction,
  TransactionUpdateRequest,
  Vault,
  VaultUpdateRequest,
  SettingsResponse,
  AIKeyValidateRequest,
  AIKeyValidateResponse,
  AISettingsUpdateRequest,
  AISettingsResponse,
  TelegramUnlinkResponse,
  TelegramPairingCodeResponse,
} from '../types/api';

const TOKEN_KEY = 'rezekify_auth_token';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  const response = await fetch(`${baseUrl}${cleanEndpoint}`, {
    method: options.method,
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
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

export async function toggleVaultLock(id: string): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}/toggle-lock`, {
    method: 'PATCH',
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

export const apiClient = {
  updateTransaction,
  toggleVaultLock,
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
  apiFetch,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  getAuthHeader,
};

export async function updateVault(id: string, data: VaultUpdateRequest): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
