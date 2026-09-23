import { useState, useCallback, useEffect } from 'react';
import { DashboardSummaryResponse, Account, Vault, Category } from '../types/api';
import { apiFetch, toggleVaultLock, deleteVault } from '../services/apiClient';

export interface UseDashboardDataOptions {
  autoFetch?: boolean;
}

/**
 * Encapsulates core dashboard domain data: summary metrics, accounts, vaults, categories,
 * and vault mutations.
 * ponytail: Refresh trigger is kept as a local numeric counter; upgrade to React Query or SWR if background polling is required.
 */
export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { autoFetch = true } = options;

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [sumData, accData, catData, vaultData] = await Promise.all([
        apiFetch<DashboardSummaryResponse>('/dashboard/summary').catch(() => null),
        apiFetch<Account[]>('/accounts').catch(() => []),
        apiFetch<Category[]>('/categories').catch(() => []),
        apiFetch<Vault[]>('/vaults').catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setAccounts(Array.isArray(accData) ? accData : []);
      setCategories(Array.isArray(catData) ? catData : []);
      setVaults(Array.isArray(vaultData) ? vaultData : []);
    } catch (err: any) {
      console.error('Failed to load dashboard data', err);
      setError(err?.message || 'Gagal memuat data dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadData();
    setRefreshKey((k) => k + 1);
  }, [loadData]);

  const handleToggleVaultLock = useCallback(
    async (id: string) => {
      try {
        setVaultError(null);
        await toggleVaultLock(id);
        await refreshAll();
      } catch (err: any) {
        setVaultError(err?.message || 'Gagal mengubah status kunci vault.');
      }
    },
    [refreshAll]
  );

  const handleDeleteVault = useCallback(
    async (id: string) => {
      try {
        setVaultError(null);
        await deleteVault(id);
        await refreshAll();
      } catch (err: any) {
        setVaultError(err?.message || 'Gagal menghapus vault.');
      }
    },
    [refreshAll]
  );

  useEffect(() => {
    if (autoFetch) {
      loadData();
    }
  }, [autoFetch, loadData]);

  return {
    summary,
    accounts,
    vaults,
    categories,
    isLoading,
    error,
    vaultError,
    vaultErrorMessage: vaultError,
    setVaultError,
    clearVaultError: () => setVaultError(null),
    loadData,
    refreshAll,
    refreshKey,
    refreshTrigger: refreshKey,
    handleToggleVaultLock,
    handleDeleteVault,
  };
}
