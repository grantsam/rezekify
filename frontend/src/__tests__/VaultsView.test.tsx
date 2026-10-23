import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaultsView } from '../components/VaultsView';
import { Vault } from '../types/api';

describe('VaultsView Component', () => {
  const mockVaults: Vault[] = [
    {
      id: 'v-1',
      name: 'Listrik & WiFi',
      vault_type: 'FIXED_BILL',
      target_amount: 500000,
      allocated_amount: 500000,
      target_date: '2026-09-30',
      is_locked: true,
    },
    {
      id: 'v-2',
      name: 'Liburan Akhir Tahun',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 2500000,
      is_locked: false,
    },
  ];

  const defaultProps = {
    vaults: mockVaults,
    isLoading: false,
    errorMessage: null,
    onDismissError: vi.fn(),
    onToggleLock: vi.fn(),
    onEditVault: vi.fn(),
    onDeleteVault: vi.fn(),
    onOpenCreateVault: vi.fn(),
  };

  it('renders "+ Tambah Vault" button with modern emerald token styling', () => {
    const handleOpenCreateVault = vi.fn();
    render(<VaultsView {...defaultProps} onOpenCreateVault={handleOpenCreateVault} />);

    const createBtn = screen.getByRole('button', { name: /\+ Tambah Vault/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveClass('bg-emerald-500');
    expect(createBtn).not.toHaveClass('bg-gradient-to-r');

    fireEvent.click(createBtn);
    expect(handleOpenCreateVault).toHaveBeenCalledTimes(1);
  });

  it('applies emerald active styling to the selected tab and updates on click', () => {
    render(<VaultsView {...defaultProps} />);

    const allTab = screen.getByRole('button', { name: /Semua/i });
    const billsTab = screen.getByRole('button', { name: /Tagihan Tetap/i });
    const savingsTab = screen.getByRole('button', { name: /Tabungan/i });

    // Initial state: 'ALL' tab active
    expect(allTab).toHaveClass('bg-emerald-500');
    expect(allTab).toHaveClass('text-white');
    expect(billsTab).not.toHaveClass('bg-emerald-500');
    expect(billsTab).toHaveClass('hover:text-emerald-500');

    // Switch to Tagihan Tetap
    fireEvent.click(billsTab);
    expect(billsTab).toHaveClass('bg-emerald-500');
    expect(allTab).not.toHaveClass('bg-emerald-500');
    expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
    expect(screen.queryByText('Liburan Akhir Tahun')).not.toBeInTheDocument();

    // Switch to Tabungan
    fireEvent.click(savingsTab);
    expect(savingsTab).toHaveClass('bg-emerald-500');
    expect(billsTab).not.toHaveClass('bg-emerald-500');
    expect(screen.getByText('Liburan Akhir Tahun')).toBeInTheDocument();
    expect(screen.queryByText('Listrik & WiFi')).not.toBeInTheDocument();
  });

  it('renders empty state with styled "Buat Vault Pertama" button when vaults is empty', () => {
    const handleOpenCreateVault = vi.fn();
    render(
      <VaultsView
        {...defaultProps}
        vaults={[]}
        onOpenCreateVault={handleOpenCreateVault}
      />
    );

    expect(screen.getByText('Belum ada komitmen atau vault aktif')).toBeInTheDocument();
    const firstVaultBtn = screen.getByRole('button', { name: /Buat Vault Pertama/i });
    expect(firstVaultBtn).toBeInTheDocument();
    expect(firstVaultBtn).toHaveClass('bg-emerald-500');
    expect(firstVaultBtn).not.toHaveClass('bg-gradient-to-r');

    fireEvent.click(firstVaultBtn);
    expect(handleOpenCreateVault).toHaveBeenCalledTimes(1);
  });

  it('renders error alert banner and calls onDismissError on dismiss', () => {
    const handleDismiss = vi.fn();
    render(
      <VaultsView
        {...defaultProps}
        errorMessage="Koneksi terputus saat sinkronisasi"
        onDismissError={handleDismiss}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Koneksi terputus saat sinkronisasi')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Tutup pesan kesalahan/i });
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
