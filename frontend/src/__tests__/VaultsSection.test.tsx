import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaultsSection } from '../components/VaultsSection';
import { Vault } from '../types/api';

describe('VaultsSection Component', () => {
  const mockVaults: Vault[] = [
    {
      id: 'v-1',
      name: 'Listrik & WiFi',
      vault_type: 'FIXED_BILL',
      target_amount: 800000,
      allocated_amount: 800000,
      target_date: '2026-10-05',
      is_locked: true,
    },
    {
      id: 'v-2',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 5000000,
      target_date: '2026-12-31',
      is_locked: false,
    },
    {
      id: 'v-3',
      name: 'DP Rumah',
      vault_type: 'SAVINGS',
      target_amount: 50000000,
      allocated_amount: 15000000,
      target_date: '2027-06-30',
      is_locked: false,
    },
  ];

  it('displays loading skeleton when isLoading is true', () => {
    render(
      <VaultsSection
        vaults={[]}
        isLoading={true}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={vi.fn()}
      />
    );

    expect(screen.getByTestId('vaults-loading-skeleton')).toBeInTheDocument();
  });

  it('displays empty state card with "+ Buat Vault Pertama" CTA button when vaults is empty, and clicking it calls onOpenCreate', () => {
    const handleOpenCreate = vi.fn();

    render(
      <VaultsSection
        vaults={[]}
        isLoading={false}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={handleOpenCreate}
      />
    );

    expect(screen.getByText(/Belum ada komitmen atau vault aktif/i)).toBeInTheDocument();
    const ctaButton = screen.getByRole('button', { name: /\+ Buat Vault Pertama/i });
    expect(ctaButton).toBeInTheDocument();

    fireEvent.click(ctaButton);
    expect(handleOpenCreate).toHaveBeenCalledTimes(1);
  });

  it('renders VaultCard for each vault in the list', () => {
    render(
      <VaultsSection
        vaults={mockVaults}
        isLoading={false}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={vi.fn()}
      />
    );

    expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();
    expect(screen.getByText('DP Rumah')).toBeInTheDocument();
  });

  it('filter tabs: "Semua", "Tagihan Tetap", "Tabungan" filter the displayed vaults', () => {
    render(
      <VaultsSection
        vaults={mockVaults}
        isLoading={false}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={vi.fn()}
      />
    );

    // Initial state: "Semua" tab is active (3 items)
    expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();
    expect(screen.getByText('DP Rumah')).toBeInTheDocument();

    // Switch to "Tagihan Tetap" tab
    const billsTab = screen.getByRole('button', { name: /Tagihan Tetap/i });
    fireEvent.click(billsTab);

    expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
    expect(screen.queryByText('Dana Darurat')).not.toBeInTheDocument();
    expect(screen.queryByText('DP Rumah')).not.toBeInTheDocument();

    // Switch to "Tabungan" tab
    const savingsTab = screen.getByRole('button', { name: /Tabungan/i });
    fireEvent.click(savingsTab);

    expect(screen.queryByText('Listrik & WiFi')).not.toBeInTheDocument();
    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();
    expect(screen.getByText('DP Rumah')).toBeInTheDocument();
  });

  it('calls onOpenCreate when header "+ Tambah Vault" button is clicked', () => {
    const handleOpenCreate = vi.fn();

    render(
      <VaultsSection
        vaults={mockVaults}
        isLoading={false}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={handleOpenCreate}
      />
    );

    const addButton = screen.getByRole('button', { name: /\+ Tambah Vault/i });
    fireEvent.click(addButton);

    expect(handleOpenCreate).toHaveBeenCalledTimes(1);
  });

  it('renders dismissible error alert banner when errorMessage is provided and handles dismissal', () => {
    const handleDismiss = vi.fn();
    render(
      <VaultsSection
        vaults={mockVaults}
        isLoading={false}
        errorMessage="Gagal menghapus vault"
        onDismissError={handleDismiss}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenCreate={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Gagal menghapus vault')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /tutup pesan kesalahan/i });
    expect(dismissBtn).toBeInTheDocument();
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
