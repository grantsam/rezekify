import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { Account, Transaction, Vault } from '../types/api';

describe('useDashboardModals', () => {
  const dummyAccount: Account = {
    id: 'acc-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 1000000,
    is_active: true,
  };

  const dummyVault: Vault = {
    id: 'v-1',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 5000000,
    allocated_amount: 2000000,
    is_locked: false,
  };

  const dummyTx: Transaction = {
    id: 'tx-1',
    description: 'Makan Siang',
    source_channel: 'WEB_MANUAL',
    transaction_date: '2026-09-24T12:00:00Z',
    ledger_entries: [],
  };

  it('initializes with all modals closed and selected entities null', () => {
    const { result } = renderHook(() => useDashboardModals());

    expect(result.current.isAccountModalOpen).toBe(false);
    expect(result.current.selectedAccountForEdit).toBeNull();
    expect(result.current.isVaultModalOpen).toBe(false);
    expect(result.current.isEditVaultModalOpen).toBe(false);
    expect(result.current.selectedVaultForEdit).toBeNull();
    expect(result.current.isManualModalOpen).toBe(false);
    expect(result.current.isEditTxModalOpen).toBe(false);
    expect(result.current.isEditModalOpen).toBe(false);
    expect(result.current.selectedTxForEdit).toBeNull();
    expect(result.current.isSimulateModalOpen).toBe(false);
    expect(result.current.isSettingsModalOpen).toBe(false);
    expect(result.current.isCategoryModalOpen).toBe(false);
  });

  it('manages account modal lifecycle for create and edit', () => {
    const { result } = renderHook(() => useDashboardModals());

    act(() => {
      result.current.openCreateAccount();
    });
    expect(result.current.isAccountModalOpen).toBe(true);
    expect(result.current.selectedAccountForEdit).toBeNull();

    act(() => {
      result.current.closeAccountModal();
    });
    expect(result.current.isAccountModalOpen).toBe(false);

    act(() => {
      result.current.openEditAccount(dummyAccount);
    });
    expect(result.current.isAccountModalOpen).toBe(true);
    expect(result.current.selectedAccountForEdit).toEqual(dummyAccount);

    act(() => {
      result.current.closeAccountModal();
    });
    expect(result.current.isAccountModalOpen).toBe(false);
    expect(result.current.selectedAccountForEdit).toBeNull();
  });

  it('manages vault modal and edit vault modal lifecycle', () => {
    const { result } = renderHook(() => useDashboardModals());

    act(() => {
      result.current.openVaultModal();
    });
    expect(result.current.isVaultModalOpen).toBe(true);

    act(() => {
      result.current.closeVaultModal();
    });
    expect(result.current.isVaultModalOpen).toBe(false);

    act(() => {
      result.current.openEditVault(dummyVault);
    });
    expect(result.current.isEditVaultModalOpen).toBe(true);
    expect(result.current.selectedVaultForEdit).toEqual(dummyVault);

    act(() => {
      result.current.closeEditVaultModal();
    });
    expect(result.current.isEditVaultModalOpen).toBe(false);
    expect(result.current.selectedVaultForEdit).toBeNull();
  });

  it('manages transaction modal and edit transaction modal lifecycle', () => {
    const { result } = renderHook(() => useDashboardModals());

    act(() => {
      result.current.openManualModal();
    });
    expect(result.current.isManualModalOpen).toBe(true);

    act(() => {
      result.current.closeManualModal();
    });
    expect(result.current.isManualModalOpen).toBe(false);

    act(() => {
      result.current.openEditTx(dummyTx);
    });
    expect(result.current.isEditTxModalOpen).toBe(true);
    expect(result.current.isEditModalOpen).toBe(true);
    expect(result.current.selectedTxForEdit).toEqual(dummyTx);

    act(() => {
      result.current.closeEditTxModal();
    });
    expect(result.current.isEditTxModalOpen).toBe(false);
    expect(result.current.isEditModalOpen).toBe(false);
    expect(result.current.selectedTxForEdit).toBeNull();
  });

  it('manages simulate, settings, and category modal lifecycle', () => {
    const { result } = renderHook(() => useDashboardModals());

    act(() => {
      result.current.openSimulateModal();
    });
    expect(result.current.isSimulateModalOpen).toBe(true);
    act(() => {
      result.current.closeSimulateModal();
    });
    expect(result.current.isSimulateModalOpen).toBe(false);

    act(() => {
      result.current.openSettingsModal();
    });
    expect(result.current.isSettingsModalOpen).toBe(true);
    act(() => {
      result.current.closeSettingsModal();
    });
    expect(result.current.isSettingsModalOpen).toBe(false);

    act(() => {
      result.current.openCategoryModal();
    });
    expect(result.current.isCategoryModalOpen).toBe(true);
    act(() => {
      result.current.closeCategoryModal();
    });
    expect(result.current.isCategoryModalOpen).toBe(false);
  });
});
