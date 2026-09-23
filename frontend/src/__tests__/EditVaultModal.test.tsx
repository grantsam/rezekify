import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditVaultModal } from '../components/EditVaultModal';
import { Vault } from '../types/api';
import { apiClient } from '../services/apiClient';

describe('EditVaultModal Component', () => {
  const sampleVault: Vault = {
    id: 'vault-edit-1',
    name: 'Tabungan Liburan',
    vault_type: 'SAVINGS',
    target_amount: 10000000,
    allocated_amount: 4000000,
    target_date: '2026-11-20',
    is_locked: false,
  };

  const sampleLockedVault: Vault = {
    id: 'vault-locked-1',
    name: 'Cicilan Motor',
    vault_type: 'FIXED_BILL',
    target_amount: 2500000,
    allocated_amount: 2500000,
    target_date: '2026-10-15',
    is_locked: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false or vault is null', () => {
    const { container: c1 } = render(
      <EditVaultModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} vault={sampleVault} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <EditVaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} vault={null} />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders pre-populated values when open and vault is provided', () => {
    render(
      <EditVaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} vault={sampleVault} />
    );

    expect(screen.getByText(/Edit Komitmen Vault/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i)).toHaveValue('Tabungan Liburan');
    expect(screen.getByLabelText(/Target Biaya/i)).toHaveValue(10000000);
    expect(screen.getByLabelText(/Alokasi Terkunci/i)).toHaveValue(4000000);
    expect(screen.getByLabelText(/Tanggal Jatuh Tempo/i)).toHaveValue('2026-11-20');
  });

  it('validates that target amount must be greater than 0', async () => {
    render(
      <EditVaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} vault={sampleVault} />
    );

    const targetInput = screen.getByLabelText(/Target Biaya/i);
    fireEvent.change(targetInput, { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    expect(await screen.findByText(/Target biaya harus lebih besar dari 0/i)).toBeInTheDocument();
  });

  it('validates that name cannot be empty', async () => {
    render(
      <EditVaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} vault={sampleVault} />
    );

    const nameInput = screen.getByLabelText(/Nama Tagihan \/ Komitmen/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    expect(await screen.findByText(/Nama tagihan \/ komitmen wajib diisi/i)).toBeInTheDocument();
  });

  it('validates that locked vault allocated amount cannot be reduced below current allocated amount', async () => {
    render(
      <EditVaultModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} vault={sampleLockedVault} />
    );

    const allocatedInput = screen.getByLabelText(/Alokasi Terkunci/i);
    fireEvent.change(allocatedInput, { target: { value: '2000000' } });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    expect(
      await screen.findByText(/Alokasi dana pada vault terkunci tidak boleh dikurangi/i)
    ).toBeInTheDocument();
  });

  it('submits form with updated values, calls apiClient.updateVault, and triggers onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    const updateSpy = vi.spyOn(apiClient, 'updateVault').mockResolvedValue({
      ...sampleVault,
      name: 'Liburan Akhir Tahun',
      target_amount: 12000000,
      allocated_amount: 5000000,
    });

    render(
      <EditVaultModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        vault={sampleVault}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nama Tagihan \/ Komitmen/i), {
      target: { value: 'Liburan Akhir Tahun' },
    });
    fireEvent.change(screen.getByLabelText(/Target Biaya/i), {
      target: { value: '12000000' },
    });
    fireEvent.change(screen.getByLabelText(/Alokasi Terkunci/i), {
      target: { value: '5000000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('vault-edit-1', {
        name: 'Liburan Akhir Tahun',
        target_amount: 12000000,
        allocated_amount: 5000000,
        target_date: '2026-11-20',
      });
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
