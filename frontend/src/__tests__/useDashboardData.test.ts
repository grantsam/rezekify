import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboardData } from '../hooks/useDashboardData';
import * as apiClient from '../services/apiClient';
import { DashboardSummaryResponse, Account, Vault, Category } from '../types/api';

describe('useDashboardData', () => {
  const mockSummary: DashboardSummaryResponse = {
    total_liquid_cash: 2500000,
    vault_locked_cash: 500000,
    operational_free_cash: 2000000,
    days_remaining: 20,
    daily_safe_runway: 100000,
    health_status: 'HEALTHY',
    upcoming_bills: [],
  };

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 2000000, is_active: true },
  ];

  const mockVaults: Vault[] = [
    {
      id: 'v-1',
      name: 'Darurat',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 5000000,
      is_locked: false,
    },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Makan', category_type: 'EXPENSE' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads summary, accounts, vaults, and categories on mount', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return mockVaults;
      if (endpoint === '/categories') return mockCategories;
      return null;
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary).toEqual(mockSummary);
      expect(result.current.accounts).toEqual(mockAccounts);
      expect(result.current.vaults).toEqual(mockVaults);
      expect(result.current.categories).toEqual(mockCategories);
    });
  });

  it('triggers refreshAll and updates refreshKey counter', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return mockVaults;
      if (endpoint === '/categories') return mockCategories;
      return null;
    });

    const { result } = renderHook(() => useDashboardData({ autoFetch: false }));

    expect(result.current.refreshKey).toBe(0);

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.refreshKey).toBe(1);
    expect(result.current.summary).toEqual(mockSummary);
  });

  it('handles toggle vault lock successfully and refreshes data', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return mockVaults;
      if (endpoint === '/categories') return mockCategories;
      return null;
    });

    const toggleSpy = vi.spyOn(apiClient, 'toggleVaultLock').mockResolvedValue({
      ...mockVaults[0],
      is_locked: true,
    });

    const { result } = renderHook(() => useDashboardData({ autoFetch: false }));

    await act(async () => {
      await result.current.handleToggleVaultLock('v-1');
    });

    expect(toggleSpy).toHaveBeenCalledWith('v-1');
    expect(result.current.vaultError).toBeNull();
  });

  it('captures vault lock failure in vaultError state', async () => {
    vi.spyOn(apiClient, 'toggleVaultLock').mockRejectedValue(new Error('Koneksi lock gagal'));

    const { result } = renderHook(() => useDashboardData({ autoFetch: false }));

    await act(async () => {
      await result.current.handleToggleVaultLock('v-1');
    });

    expect(result.current.vaultError).toBe('Koneksi lock gagal');

    act(() => {
      result.current.clearVaultError();
    });
    expect(result.current.vaultError).toBeNull();
  });

  it('handles delete vault successfully and handles error when delete fails', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return mockVaults;
      if (endpoint === '/categories') return mockCategories;
      return null;
    });

    const deleteSpy = vi.spyOn(apiClient, 'deleteVault').mockResolvedValue({ detail: 'Deleted' });

    const { result } = renderHook(() => useDashboardData({ autoFetch: false }));

    await act(async () => {
      await result.current.handleDeleteVault('v-1');
    });

    expect(deleteSpy).toHaveBeenCalledWith('v-1');
    expect(result.current.vaultError).toBeNull();

    // Now test failure
    vi.spyOn(apiClient, 'deleteVault').mockRejectedValue(new Error('Gagal delete vault'));

    await act(async () => {
      await result.current.handleDeleteVault('v-1');
    });

    expect(result.current.vaultError).toBe('Gagal delete vault');
  });
});
