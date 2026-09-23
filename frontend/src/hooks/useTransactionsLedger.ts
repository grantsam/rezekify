import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction, TransactionFilterParams, PaginatedTransactionsResponse } from '../types/api';
import { getTransactions, apiFetch } from '../services/apiClient';

export interface UseTransactionsLedgerOptions {
  initialFilters?: TransactionFilterParams;
  autoFetch?: boolean;
}

/**
 * Encapsulates transactions ledger data, pagination, filtering, and deletion.
 * ponytail: Client-side debounce is managed by TransactionsTable; upgrade hook to manage URL query sync if ledger URLs need shareable filter links.
 */
export function useTransactionsLedger(options: UseTransactionsLedgerOptions = {}) {
  const { initialFilters = { page: 1, page_size: 20 }, autoFetch = true } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilterParams>(initialFilters);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    total_pages: number;
  }>({
    total: 0,
    page: initialFilters.page ?? 1,
    total_pages: 1,
  });

  const filtersRef = useRef<TransactionFilterParams>(filters);
  filtersRef.current = filters;

  const loadTransactions = useCallback(async (customFilters?: TransactionFilterParams) => {
    try {
      setIsLoading(true);
      setError(null);
      const activeFilters = customFilters ?? filtersRef.current;
      const res = await getTransactions(activeFilters);

      if (Array.isArray(res)) {
        setTransactions(res);
        setPagination({
          total: res.length,
          page: 1,
          total_pages: 1,
        });
      } else if (res && Array.isArray((res as PaginatedTransactionsResponse).items)) {
        const paginated = res as PaginatedTransactionsResponse;
        setTransactions(paginated.items);
        setPagination({
          total: paginated.total,
          page: paginated.page,
          total_pages: paginated.total_pages,
        });
      } else {
        setTransactions([]);
        setPagination({
          total: 0,
          page: 1,
          total_pages: 1,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat transaksi.');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleParamsChange = useCallback(
    (newParams: TransactionFilterParams) => {
      setFilters(newParams);
      loadTransactions(newParams);
    },
    [loadTransactions]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setFilters((prev) => {
        const updated = { ...prev, page: newPage };
        loadTransactions(updated);
        return updated;
      });
    },
    [loadTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setIsDeleting(true);
        setError(null);
        await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
        await loadTransactions();
        return true;
      } catch (err: any) {
        setError(err?.message || 'Gagal menghapus transaksi.');
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [loadTransactions]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      loadTransactions();
    }
  }, [autoFetch, loadTransactions]);

  return {
    transactions,
    isLoading,
    isDeleting,
    error,
    setError,
    clearError,
    filters,
    pagination,
    loadTransactions,
    handleParamsChange,
    handlePageChange,
    deleteTransaction,
  };
}
