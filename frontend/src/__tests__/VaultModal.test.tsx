import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultModal } from '../components/VaultModal';
import * as apiClient from '../services/apiClient';

describe('VaultModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <VaultModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all form fields when isOpen is true', () => {
    render(<VaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText(/Tambah Komitmen & Vault/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipe Pos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tagihan Tetap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tabungan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Biaya/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alokasi Terkunci/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tanggal Jatuh Tempo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simpan Komitmen/i })).toBeInTheDocument();
  });

  it('submits vault creation with default FIXED_BILL and allocated_amount defaulting to target_amount', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      id: 'v-1',
      name: 'Sewa Kos',
      vault_type: 'FIXED_BILL',
      target_amount: 1500000,
      allocated_amount: 1500000,
      target_date: '2026-10-01',
      is_locked: false,
    });
    const handleSuccess = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(<VaultModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Sewa Kos' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '1500000' },
    });
    // allocated_amount is intentionally left blank to verify default behavior
    fireEvent.change(screen.getByLabelText(/Tanggal Jatuh Tempo/i), {
      target: { value: '2026-10-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Komitmen/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/vaults',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Sewa Kos',
            vault_type: 'FIXED_BILL',
            target_amount: 1500000,
            allocated_amount: 1500000,
            target_date: '2026-10-01',
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('submits vault creation with SAVINGS and custom allocated_amount and null target_date', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      id: 'v-2',
      name: 'Tabungan Darurat',
      vault_type: 'SAVINGS',
      target_amount: 5000000,
      allocated_amount: 1000000,
      target_date: null,
      is_locked: false,
    });
    const handleSuccess = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(<VaultModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Tabungan Darurat' },
    });

    // Select Tabungan / SAVINGS
    fireEvent.click(screen.getByRole('button', { name: /Tabungan/i }));

    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '5000000' },
    });
    fireEvent.change(screen.getByLabelText(/Alokasi Terkunci/i), {
      target: { value: '1000000' },
    });
    // Leave target_date empty

    fireEvent.click(screen.getByRole('button', { name: /Simpan Komitmen/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/vaults',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Tabungan Darurat',
            vault_type: 'SAVINGS',
            target_amount: 5000000,
            allocated_amount: 1000000,
            target_date: null,
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays validation error if name is empty or target amount is invalid', async () => {
    render(<VaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Simpan Komitmen/i });

    // Empty name
    fireEvent.click(submitBtn);
    expect(screen.getByText(/Nama tagihan \/ komitmen wajib diisi/i)).toBeInTheDocument();

    // Fill name, but target amount is 0
    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Internet WiFi' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '0' },
    });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Target biaya harus lebih besar dari 0/i)).toBeInTheDocument();
  });

  it('displays error alert when vault creation API call fails', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Nama vault sudah digunakan'));
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(<VaultModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Sewa Kantor' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '2000000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Komitmen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nama vault sudah digunakan/i)).toBeInTheDocument();
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

    render(<VaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Listrik Token' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '300000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Simpan Komitmen/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('submit-loading-spinner')).toBeInTheDocument();

    resolvePromise!({ id: 'v-new' });
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('validates that allocated amount is not negative', () => {
    render(<VaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Pajak Motor' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText(/Alokasi Terkunci/i), {
      target: { value: '-1000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Komitmen/i }));
    expect(screen.getByText(/Alokasi terkunci tidak boleh negatif/i)).toBeInTheDocument();
  });

  it('calls onClose when close button or cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(<VaultModal isOpen={true} onClose={handleClose} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByLabelText(/Tutup modal/i));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Batal/i }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('renders accessible dialog and closes on Escape key', () => {
    const handleClose = vi.fn();
    render(<VaultModal isOpen={true} onClose={handleClose} onSuccess={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'vault-modal-title');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
