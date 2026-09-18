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

    expect(screen.getByText(/Catat Transaksi Manual/i)).toBeInTheDocument();
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
          body: JSON.stringify({
            transaction_type: 'EXPENSE',
            amount: 50000,
            description: 'Kopi Kenangan',
            account_id: 'acc-1',
            source_channel: 'WEB_MANUAL',
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
