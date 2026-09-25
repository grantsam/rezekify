import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManualTransactionModal } from '../components/ManualTransactionModal';
import { Account } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('ManualTransactionModal Component', () => {
  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 1000000, is_active: true },
    { id: 'acc-2', name: 'GoPay', account_type: 'EWALLET', current_balance: 150000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ManualTransactionModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} accounts={mockAccounts} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders form inputs when isOpen is true', () => {
    render(
      <ManualTransactionModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} accounts={mockAccounts} />
    );

    expect(screen.getByText(/Tambah Transaksi Manual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nominal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deskripsi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pilih Akun/i)).toBeInTheDocument();
  });

  it('submits manual expense successfully', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({ id: 'tx-new' });
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <ManualTransactionModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} accounts={mockAccounts} />
    );

    fireEvent.change(screen.getByLabelText(/Nominal/i), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText(/Deskripsi/i), { target: { value: 'Kopi Kenangan' } });
    fireEvent.change(screen.getByLabelText(/Pilih Akun/i), { target: { value: 'acc-1' } });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Transaksi/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          method: 'POST',
        })
      );
      const callArgs = apiFetchSpy.mock.calls[0][1] as any;
      const parsedBody = JSON.parse(callArgs.body);
      expect(parsedBody).toMatchObject({
        transaction_type: 'EXPENSE',
        amount: 50000,
        description: 'Kopi Kenangan',
        account_id: 'acc-1',
        source_channel: 'WEB_MANUAL',
      });
      expect(parsedBody.transaction_date).toBeDefined();
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('renders accessible dialog and closes on Escape key', () => {
    const handleClose = vi.fn();
    render(
      <ManualTransactionModal isOpen={true} onClose={handleClose} onSuccess={vi.fn()} accounts={mockAccounts} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'manual-modal-title');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders in edit mode and submits via apiClient.updateTransaction', async () => {
    const mockTx = {
      id: 'tx-manual-edit-1',
      description: 'Makan Bakso',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-20T10:00:00.000Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'CREDIT' as const, amount: 30000, account_id: 'acc-1' },
      ],
    };
    const updateSpy = vi.spyOn(apiClient, 'updateTransaction').mockResolvedValue(mockTx as any);
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <ManualTransactionModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        accounts={mockAccounts}
        transaction={mockTx as any}
      />
    );

    expect(screen.getByText('Edit Transaksi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Makan Bakso')).toBeInTheDocument();

    const descInput = screen.getByLabelText(/Keterangan Transaksi/i);
    fireEvent.change(descInput, { target: { value: 'Makan Bakso Urat' } });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'tx-manual-edit-1',
        expect.objectContaining({
          description: 'Makan Bakso Urat',
          amount: 30000,
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('enforces WCAG AA minimum 38px touch targets and ARIA radio semantics on transaction type buttons', () => {
    render(
      <ManualTransactionModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} accounts={mockAccounts} />
    );

    const expenseBtn = screen.getByRole('radio', { name: 'Pengeluaran' });
    const incomeBtn = screen.getByRole('radio', { name: 'Pemasukan' });
    const transferBtn = screen.getByRole('radio', { name: 'Transfer' });

    expect(expenseBtn).toHaveClass('min-h-[38px]');
    expect(incomeBtn).toHaveClass('min-h-[38px]');
    expect(transferBtn).toHaveClass('min-h-[38px]');

    expect(expenseBtn).toHaveAttribute('aria-checked', 'true');
    expect(incomeBtn).toHaveAttribute('aria-checked', 'false');
    expect(transferBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('allows changing account and category via HeroUI Select dropdowns', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({ id: 'tx-new-2' });
    const handleSuccess = vi.fn();
    const mockCategories = [
      { id: 'cat-makan', name: 'Makanan & Minuman', category_type: 'EXPENSE' as const },
    ];

    render(
      <ManualTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nominal/i), { target: { value: '25000' } });
    fireEvent.change(screen.getByLabelText(/Deskripsi/i), { target: { value: 'Beli Jus' } });

    // Open Account dropdown and select GoPay (acc-2)
    const accountSelect = screen.getByRole('combobox', { name: /Pilih Akun/i });
    fireEvent.click(accountSelect);
    const gopayOption = screen.getByRole('option', { name: /GoPay/i });
    fireEvent.click(gopayOption);

    // Open Category dropdown and select Makanan & Minuman
    const categorySelect = screen.getByRole('combobox', { name: /Kategori/i });
    fireEvent.click(categorySelect);
    const catOption = screen.getByRole('option', { name: /Makanan & Minuman/i });
    fireEvent.click(catOption);

    fireEvent.click(screen.getByRole('button', { name: /Simpan Transaksi/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          method: 'POST',
        })
      );
      const callArgs = apiFetchSpy.mock.calls[0][1] as any;
      const parsedBody = JSON.parse(callArgs.body);
      expect(parsedBody).toMatchObject({
        transaction_type: 'EXPENSE',
        amount: 25000,
        description: 'Beli Jus',
        account_id: 'acc-2',
        category_id: 'cat-makan',
      });
    });
  });
});
