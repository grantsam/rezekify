import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountModal } from '../components/AccountModal';
import { Account } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('AccountModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AccountModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all form fields when isOpen is true', () => {
    render(<AccountModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText(/Tambah Akun Baru/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Rekening/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipe Akun/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Saldo Awal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simpan Akun/i })).toBeInTheDocument();
  });

  it('submits account creation successfully with selected account type and balance', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      id: 'acc-new-1',
      name: 'Bank Mandiri',
      account_type: 'BANK',
      current_balance: 500000,
      is_active: true,
    });
    const handleSuccess = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(<AccountModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nama Rekening/i), {
      target: { value: 'Bank Mandiri' },
    });

    // Switch account type to BANK (or click button)
    const bankButton = screen.getByRole('button', { name: /Bank/i });
    fireEvent.click(bankButton);

    fireEvent.change(screen.getByLabelText(/Saldo Awal/i), {
      target: { value: '500000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Akun/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/accounts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Bank Mandiri',
            account_type: 'BANK',
            initial_balance: 500000,
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays error alert when account creation fails', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Nama akun sudah ada'));
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(<AccountModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nama Rekening/i), {
      target: { value: 'BCA' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Akun/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nama akun sudah ada/i)).toBeInTheDocument();
    });

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('shows loading indicator and disables submit button during request', async () => {
    let resolvePromise: (val: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    vi.spyOn(apiClient, 'apiFetch').mockReturnValue(promise as any);

    render(<AccountModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nama Rekening/i), {
      target: { value: 'Dana Dompet' },
    });
    const submitBtn = screen.getByRole('button', { name: /Simpan Akun/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('submit-loading-spinner')).toBeInTheDocument();

    resolvePromise!({ id: 'acc-new' });
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('renders accessible dialog and closes on Escape key', () => {
    const handleClose = vi.fn();
    render(<AccountModal isOpen={true} onClose={handleClose} onSuccess={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'account-modal-title');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('pre-populates fields and disables balance in edit mode', () => {
    const mockAccount: Account = {
      id: 'acc-edit-1',
      name: 'BCA Prioritas',
      account_type: 'BANK',
      current_balance: 15000000,
      is_active: true,
    };

    render(
      <AccountModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        accountToEdit={mockAccount}
      />
    );

    expect(screen.getByText(/Edit Rekening/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Rekening/i)).toHaveValue('BCA Prioritas');
    expect(screen.getByLabelText(/Saldo Saat Ini/i)).toBeDisabled();
    expect(screen.getByDisplayValue(/15\.000\.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simpan Perubahan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nonaktifkan Rekening/i })).toBeInTheDocument();
  });

  it('submits form in edit mode calling updateAccount and invoking onSuccess', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateAccount').mockResolvedValue({
      id: 'acc-edit-1',
      name: 'BCA Platinum',
      account_type: 'BANK',
      current_balance: 15000000,
      is_active: true,
    });
    const handleSuccess = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    const mockAccount: Account = {
      id: 'acc-edit-1',
      name: 'BCA Prioritas',
      account_type: 'BANK',
      current_balance: 15000000,
      is_active: true,
    };

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        accountToEdit={mockAccount}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nama Rekening/i), {
      target: { value: 'BCA Platinum' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('acc-edit-1', {
        name: 'BCA Platinum',
        account_type: 'BANK',
      });
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('triggers confirmation and deactivates account via deactivateAccount', async () => {
    const deactivateSpy = vi.spyOn(apiClient, 'deactivateAccount').mockResolvedValue({
      detail: 'Rekening berhasil dinonaktifkan.',
    });
    const handleSuccess = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    const mockAccount: Account = {
      id: 'acc-edit-1',
      name: 'BCA Prioritas',
      account_type: 'BANK',
      current_balance: 15000000,
      is_active: true,
    };

    render(
      <AccountModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        accountToEdit={mockAccount}
      />
    );

    const deactivateBtn = screen.getByRole('button', { name: /Nonaktifkan Rekening/i });
    fireEvent.click(deactivateBtn);

    expect(screen.getByText(/Konfirmasi Penonaktifan Rekening/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Ya, Nonaktifkan/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deactivateSpy).toHaveBeenCalledWith('acc-edit-1');
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
