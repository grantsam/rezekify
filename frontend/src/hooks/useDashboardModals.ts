import { useState, useCallback } from 'react';
import { Account, Transaction, Vault } from '../types/api';

/**
 * Encapsulates modal open/close states and selected entity states for DashboardPage.
 * ponytail: Separate state atoms are kept here; upgrade to global URL search-param routing if modals need deep-linking.
 */
export function useDashboardModals() {
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<Account | null>(null);

  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [isEditVaultModalOpen, setIsEditVaultModalOpen] = useState<boolean>(false);
  const [selectedVaultForEdit, setSelectedVaultForEdit] = useState<Vault | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState<boolean>(false);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);

  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  const openCreateAccount = useCallback(() => {
    setSelectedAccountForEdit(null);
    setIsAccountModalOpen(true);
  }, []);

  const openEditAccount = useCallback((account: Account) => {
    setSelectedAccountForEdit(account);
    setIsAccountModalOpen(true);
  }, []);

  const closeAccountModal = useCallback(() => {
    setIsAccountModalOpen(false);
    setSelectedAccountForEdit(null);
  }, []);

  const openVaultModal = useCallback(() => {
    setIsVaultModalOpen(true);
  }, []);

  const closeVaultModal = useCallback(() => {
    setIsVaultModalOpen(false);
  }, []);

  const openEditVault = useCallback((vault: Vault) => {
    setSelectedVaultForEdit(vault);
    setIsEditVaultModalOpen(true);
  }, []);

  const closeEditVaultModal = useCallback(() => {
    setIsEditVaultModalOpen(false);
    setSelectedVaultForEdit(null);
  }, []);

  const openManualModal = useCallback(() => {
    setIsManualModalOpen(true);
  }, []);

  const closeManualModal = useCallback(() => {
    setIsManualModalOpen(false);
  }, []);

  const openEditTx = useCallback((tx: Transaction) => {
    setSelectedTxForEdit(tx);
    setIsEditTxModalOpen(true);
  }, []);

  const closeEditTxModal = useCallback(() => {
    setIsEditTxModalOpen(false);
    setSelectedTxForEdit(null);
  }, []);

  const openSimulateModal = useCallback(() => {
    setIsSimulateModalOpen(true);
  }, []);

  const closeSimulateModal = useCallback(() => {
    setIsSimulateModalOpen(false);
  }, []);

  const openSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  const openCategoryModal = useCallback(() => {
    setIsCategoryModalOpen(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setIsCategoryModalOpen(false);
  }, []);

  return {
    isAccountModalOpen,
    selectedAccountForEdit,
    openCreateAccount,
    openEditAccount,
    closeAccountModal,

    isVaultModalOpen,
    openVaultModal,
    closeVaultModal,

    isEditVaultModalOpen,
    selectedVaultForEdit,
    openEditVault,
    closeEditVaultModal,

    isManualModalOpen,
    openManualModal,
    closeManualModal,

    isEditTxModalOpen,
    isEditModalOpen: isEditTxModalOpen,
    selectedTxForEdit,
    openEditTx,
    closeEditTxModal,
    closeEditModal: closeEditTxModal,

    isSimulateModalOpen,
    openSimulateModal,
    closeSimulateModal,

    isSettingsModalOpen,
    openSettingsModal,
    closeSettingsModal,

    isCategoryModalOpen,
    openCategoryModal,
    closeCategoryModal,
  };
}
