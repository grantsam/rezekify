import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LedgerView } from '../components/LedgerView';
import * as apiClient from '../services/apiClient';

describe('LedgerView CSV Export Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    transactions: [],
    accounts: [],
    categories: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    onParamsChange: vi.fn(),
    onPageChange: vi.fn(),
    onDeleteTransaction: vi.fn(),
    onEditTransaction: vi.fn(),
    onOpenManualModal: vi.fn(),
    onOpenSimulateModal: vi.fn(),
    onOpenCategoryModal: vi.fn(),
  };

  it('renders "Unduh CSV" button on toolbar', () => {
    render(<LedgerView {...defaultProps} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('triggers downloadTransactionsCSV with activeFilters on click', async () => {
    const downloadSpy = vi.spyOn(apiClient, 'downloadTransactionsCSV').mockResolvedValue(undefined);
    const mockFilters = { account_id: 'acc-1', search: 'makan' };

    render(<LedgerView {...defaultProps} activeFilters={mockFilters} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(mockFilters);
    });
  });

  it('disables button and displays loading state during export execution', async () => {
    let resolveExport: () => void = () => {};
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve;
    });
    vi.spyOn(apiClient, 'downloadTransactionsCSV').mockReturnValue(exportPromise);

    render(<LedgerView {...defaultProps} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportBtn).toBeDisabled();
    });

    resolveExport();

    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });
  });

  it('invokes custom onExportCSV prop if supplied', async () => {
    const customExportMock = vi.fn().mockResolvedValue(undefined);
    render(<LedgerView {...defaultProps} onExportCSV={customExportMock} />);

    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(customExportMock).toHaveBeenCalledTimes(1);
    });
  });

  it('renders "+ Catat Manual" button and triggers callback', () => {
    const handleManual = vi.fn();
    render(<LedgerView {...defaultProps} onOpenManualModal={handleManual} />);

    const manualBtn = screen.getByRole('button', { name: /\+ Catat Manual/i });
    expect(manualBtn).toBeInTheDocument();
    expect(manualBtn).toHaveClass('bg-emerald-500');

    fireEvent.click(manualBtn);
    expect(handleManual).toHaveBeenCalledTimes(1);
  });

  it('does not render redundant "Simulasi Belanja" button', () => {
    render(<LedgerView {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Simulasi Belanja/i })).not.toBeInTheDocument();
  });
});
