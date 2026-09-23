import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LedgerView } from '../components/LedgerView';
import { VaultsView } from '../components/VaultsView';
import { Transaction, Account, Category, Vault } from '../types/api';

describe('Dedicated Ledger & Vaults Views', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Soto Lamongan',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-24T12:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT', amount: 25000 },
        { id: 'le-2', entry_type: 'CREDIT', amount: 25000 },
      ],
    },
  ];

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA', account_type: 'BANK', current_balance: 1000000, is_active: true },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Kuliner', category_type: 'EXPENSE' },
  ];

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

  describe('LedgerView', () => {
    it('renders title, subtitle, action buttons and embeds TransactionsTable', () => {
      const handleOpenManual = vi.fn();
      const handleOpenSimulate = vi.fn();
      const handleOpenCategory = vi.fn();

      render(
        <LedgerView
          transactions={mockTransactions}
          accounts={mockAccounts}
          categories={mockCategories}
          total={1}
          page={1}
          pageSize={20}
          totalPages={1}
          onParamsChange={vi.fn()}
          onPageChange={vi.fn()}
          onDeleteTransaction={vi.fn()}
          onEditTransaction={vi.fn()}
          onOpenManualModal={handleOpenManual}
          onOpenSimulateModal={handleOpenSimulate}
          onOpenCategoryModal={handleOpenCategory}
        />
      );

      expect(screen.getByText('Buku Besar (Ledger)')).toBeInTheDocument();
      expect(screen.getAllByText('Makan Soto Lamongan')[0]).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /\+ Catat Manual/i }));
      expect(handleOpenManual).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Simulasi Belanja/i }));
      expect(handleOpenSimulate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /\+ Kategori/i }));
      expect(handleOpenCategory).toHaveBeenCalledTimes(1);
    });
  });

  describe('VaultsView', () => {
    it('renders title, filters tabs, and renders vault cards', () => {
      const handleOpenCreateVault = vi.fn();

      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={handleOpenCreateVault}
        />
      );

      expect(screen.getByText('Komitmen & Vaults')).toBeInTheDocument();
      expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
      expect(screen.getByText('Liburan Akhir Tahun')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /\+ Tambah Vault/i }));
      expect(handleOpenCreateVault).toHaveBeenCalledTimes(1);
    });

    it('filters vaults by tab: Semua, Tagihan Tetap, Tabungan', () => {
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Tagihan Tetap/i }));
      expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
      expect(screen.queryByText('Liburan Akhir Tahun')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Tabungan/i }));
      expect(screen.getByText('Liburan Akhir Tahun')).toBeInTheDocument();
      expect(screen.queryByText('Listrik & WiFi')).not.toBeInTheDocument();
    });

    it('guards locked vaults by disabling delete button (Review Focus 4)', () => {
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /Hapus vault/i });
      // First vault is locked: delete button must be disabled
      expect(deleteButtons[0]).toBeDisabled();
      // Second vault is unlocked: delete button must be enabled
      expect(deleteButtons[1]).not.toBeDisabled();
    });

    it('renders dismissible error banner when errorMessage is provided', () => {
      const handleDismiss = vi.fn();
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage="Gagal menghapus vault dari server."
          onDismissError={handleDismiss}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      expect(screen.getByText('Gagal menghapus vault dari server.')).toBeInTheDocument();
      const dismissBtn = screen.getByRole('button', { name: /Tutup pesan kesalahan/i });
      fireEvent.click(dismissBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
