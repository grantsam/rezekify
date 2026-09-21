import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { Account, Category, Transaction } from '../types/api';
import { apiClient } from '../services/apiClient';

describe('EditTransactionModal Component', () => {
  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'Dompet Tunai', account_type: 'CASH', current_balance: 500000, is_active: true },
    { id: 'acc-2', name: 'Bank BCA', account_type: 'BANK', current_balance: 2000000, is_active: true },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Makanan & Minuman' },
    { id: 'cat-2', name: 'Transportasi' },
  ];

  const mockTx: Transaction = {
    id: 'tx-edit-1',
    description: 'Beli Makan Siang',
    source_channel: 'WEB_MANUAL',
    transaction_date: '2026-09-22T12:00:00.000Z',
    ledger_entries: [
      { id: 'le-1', entry_type: 'DEBIT', amount: 45000, category_id: 'cat-1' },
      { id: 'le-2', entry_type: 'CREDIT', amount: 45000, account_id: 'acc-1' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pre-populated values when open', () => {
    render(
      <EditTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Transaksi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beli Makan Siang')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Dompet Tunai/)).toBeInTheDocument();
  });

  it('submits form, calls apiClient.updateTransaction, and invokes onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    const updateSpy = vi.spyOn(apiClient, 'updateTransaction').mockResolvedValue(mockTx);

    render(
      <EditTransactionModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        categories={mockCategories}
        onSuccess={handleSuccess}
      />
    );

    const amountInput = screen.getByLabelText(/Nominal Transaksi/i);
    const descInput = screen.getByLabelText(/Keterangan Transaksi/i);

    fireEvent.change(amountInput, { target: { value: '60000' } });
    fireEvent.change(descInput, { target: { value: 'Beli Makan Siang Spesial' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'tx-edit-1',
        expect.objectContaining({
          amount: 60000,
          description: 'Beli Makan Siang Spesial',
          account_id: 'acc-1',
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays error when amount is invalid or zero', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateTransaction').mockResolvedValue(mockTx);

    render(
      <EditTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        onSuccess={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText(/Nominal Transaksi/i);
    fireEvent.change(amountInput, { target: { value: '0' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Nominal harus berupa angka positif/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('displays error banner when apiClient.updateTransaction fails', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(apiClient, 'updateTransaction').mockRejectedValue(
      new Error('Saldo rekening tidak mencukupi untuk update.')
    );

    render(
      <EditTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        onSuccess={handleSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Saldo rekening tidak mencukupi untuk update./i)).toBeInTheDocument();
    expect(handleSuccess).not.toHaveBeenCalled();
  });
});
