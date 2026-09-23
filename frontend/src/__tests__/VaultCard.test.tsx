import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaultCard } from '../components/VaultCard';
import { Vault } from '../types/api';

describe('VaultCard Component', () => {
  const sampleSavingsVault: Vault = {
    id: 'vault-sav-1',
    name: 'Dana Darurat 3 Bulan',
    vault_type: 'SAVINGS',
    target_amount: 15000000,
    allocated_amount: 7500000,
    target_date: '2026-12-31',
    is_locked: false,
  };

  const sampleFixedBillVault: Vault = {
    id: 'vault-bill-1',
    name: 'Sewa Apartemen',
    vault_type: 'FIXED_BILL',
    target_amount: 3000000,
    allocated_amount: 3000000,
    target_date: '2026-10-01',
    is_locked: true,
  };

  it('renders vault name, type badge, formatted allocated and target amounts, progress percentage, and target date', () => {
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Dana Darurat 3 Bulan')).toBeInTheDocument();
    expect(screen.getByText('Tabungan')).toBeInTheDocument();
    // Currency formatted with id-ID: Rp 7.500.000 and Rp 15.000.000
    expect(screen.getByText(/Rp\s*7\.500\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*15\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/2026-12-31|31 Des 2026|Desember 2026/i)).toBeInTheDocument();
  });

  it('renders Tagihan Tetap type badge and locked indicator when vault is locked and is FIXED_BILL', () => {
    render(
      <VaultCard
        vault={sampleFixedBillVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Sewa Apartemen')).toBeInTheDocument();
    expect(screen.getByText('Tagihan Tetap')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    // Should have a locked badge or indication
    expect(screen.getByText(/Terkunci/i)).toBeInTheDocument();
  });

  it('calls onToggleLock with vault id when lock/unlock button is clicked', () => {
    const handleToggleLock = vi.fn();
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={handleToggleLock}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /kunci|kunci vault|kunci dana/i });
    fireEvent.click(toggleButton);

    expect(handleToggleLock).toHaveBeenCalledWith('vault-sav-1');
  });

  it('calls onEdit with vault object when edit button is clicked', () => {
    const handleEdit = vi.fn();
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={handleEdit}
        onDelete={vi.fn()}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit|ubah vault/i });
    fireEvent.click(editButton);

    expect(handleEdit).toHaveBeenCalledWith(sampleSavingsVault);
  });

  it('calls onDelete with vault id when delete button is clicked on an unlocked vault', () => {
    const handleDelete = vi.fn();
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={handleDelete}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /hapus vault/i });
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('vault-sav-1');
  });

  it('disables delete button when vault is locked and prevents onDelete call', () => {
    const handleDelete = vi.fn();
    render(
      <VaultCard
        vault={sampleFixedBillVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={handleDelete}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /hapus vault/i });
    expect(deleteButton).toBeDisabled();
    fireEvent.click(deleteButton);

    expect(handleDelete).not.toHaveBeenCalled();
  });

  it('clamps progress bar to 100% when allocated exceeds target', () => {
    const overAllocatedVault: Vault = {
      id: 'vault-over',
      name: 'Surplus Fund',
      vault_type: 'SAVINGS',
      target_amount: 1000000,
      allocated_amount: 1500000,
      is_locked: false,
    };

    render(
      <VaultCard
        vault={overAllocatedVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays loading states when isTogglingLock or isDeleting is true', () => {
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        isTogglingLock={true}
        isDeleting={true}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /kunci|kunci vault/i });
    expect(toggleButton).toBeDisabled();
  });

  it('renders progress bar with correct aria attributes', () => {
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});
