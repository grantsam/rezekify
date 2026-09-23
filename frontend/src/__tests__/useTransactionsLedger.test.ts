import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTransactionsLedger } from '../hooks/useTransactionsLedger';
import * as apiClient from '../services/apiClient';
import { PaginatedTransactionsResponse, Transaction } from '../types/api';

describe('useTransactionsLedger', () => {
  const dummyTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Siang',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-24T12:00:00Z',
      ledger_entries: [],
    },
    {
      id: 'tx-2',
      description: 'Beli Kopi',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-24T15:00:00Z',
      ledger_entries: [],
    },
  ];

  const dummyPaginatedRes: PaginatedTransactionsResponse = {
    items: dummyTransactions,
    total: 2,
    page: 1,
    page_size: 20,
    total_pages: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads transactions on mount when autoFetch is true (default)', async () => {
    vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyPaginatedRes);

    const { result } = renderHook(() => useTransactionsLedger());

    await waitFor(() => {
      expect(result.current.transactions).toEqual(dummyTransactions);
      expect(result.current.pagination.total).toBe(2);
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getTransactions).toHaveBeenCalledTimes(1);
  });

  it('handles array transaction response (legacy fallback)', async () => {
    vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyTransactions as any);

    const { result } = renderHook(() => useTransactionsLedger());

    await waitFor(() => {
      expect(result.current.transactions).toEqual(dummyTransactions);
      expect(result.current.pagination.total).toBe(2);
      expect(result.current.pagination.page).toBe(1);
    });
  });

  it('handles pagination changes via handlePageChange', async () => {
    const getTransactionsSpy = vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyPaginatedRes);

    const { result } = renderHook(() => useTransactionsLedger({ autoFetch: false }));

    act(() => {
      result.current.handlePageChange(2);
    });

    await waitFor(() => {
      expect(getTransactionsSpy).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
      expect(result.current.filters.page).toBe(2);
    });
  });

  it('handles filter param updates via handleParamsChange', async () => {
    const getTransactionsSpy = vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyPaginatedRes);

    const { result } = renderHook(() => useTransactionsLedger({ autoFetch: false }));

    act(() => {
      result.current.handleParamsChange({ page: 1, page_size: 10, search: 'kopi' });
    });

    await waitFor(() => {
      expect(getTransactionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, page_size: 10, search: 'kopi' })
      );
      expect(result.current.filters.search).toBe('kopi');
      expect(result.current.filters.page_size).toBe(10);
    });
  });

  it('deletes transaction successfully and reloads list', async () => {
    vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyPaginatedRes);
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({ detail: 'Deleted' });

    const { result } = renderHook(() => useTransactionsLedger({ autoFetch: false }));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.deleteTransaction('tx-1');
    });

    expect(success).toBe(true);
    expect(apiFetchSpy).toHaveBeenCalledWith('/transactions/tx-1', { method: 'DELETE' });
    expect(result.current.error).toBeNull();
    expect(result.current.isDeleting).toBe(false);
  });

  it('sets error state when deleteTransaction fails', async () => {
    vi.spyOn(apiClient, 'getTransactions').mockResolvedValue(dummyPaginatedRes);
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Network error on delete'));

    const { result } = renderHook(() => useTransactionsLedger({ autoFetch: false }));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.deleteTransaction('tx-1');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Network error on delete');
    expect(result.current.isDeleting).toBe(false);

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error gracefully', async () => {
    vi.spyOn(apiClient, 'getTransactions').mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useTransactionsLedger());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch');
      expect(result.current.transactions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
