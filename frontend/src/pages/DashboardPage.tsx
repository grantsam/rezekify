import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useTransactionsLedger } from '../hooks/useTransactionsLedger';
import { useDashboardData } from '../hooks/useDashboardData';
import { AppLayout } from '../components/AppLayout';
import { OverviewView } from '../components/OverviewView';
import { LedgerView } from '../components/LedgerView';
import { VaultsView } from '../components/VaultsView';
import { AIChatView } from '../components/AIChatView';

const ManualTransactionModal = React.lazy(() => import('../components/ManualTransactionModal').then(m => ({ default: m.ManualTransactionModal })));
const AccountModal = React.lazy(() => import('../components/AccountModal').then(m => ({ default: m.AccountModal })));
const VaultModal = React.lazy(() => import('../components/VaultModal').then(m => ({ default: m.VaultModal })));
const SimulatePurchaseModal = React.lazy(() => import('../components/SimulatePurchaseModal').then(m => ({ default: m.SimulatePurchaseModal })));
const EditTransactionModal = React.lazy(() => import('../components/EditTransactionModal').then(m => ({ default: m.EditTransactionModal })));
const EditVaultModal = React.lazy(() => import('../components/EditVaultModal').then(m => ({ default: m.EditVaultModal })));
const DepositVaultModal = React.lazy(() => import('../components/DepositVaultModal').then(m => ({ default: m.DepositVaultModal })));
const PayBillModal = React.lazy(() => import('../components/PayBillModal').then(m => ({ default: m.PayBillModal })));
const SettingsModal = React.lazy(() => import('../components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CategoryManagerModal = React.lazy(() => import('../components/CategoryManagerModal').then(m => ({ default: m.CategoryManagerModal })));
const ProfileModal = React.lazy(() => import('../components/ProfileModal').then(m => ({ default: m.ProfileModal })));
const LumpSumAllocationModal = React.lazy(() => import('../components/LumpSumAllocationModal').then(m => ({ default: m.LumpSumAllocationModal })));

type ActiveViewType = 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const modals = useDashboardModals();
  const ledger = useTransactionsLedger();
  const dashboard = useDashboardData();

  const rawView = searchParams.get('view');
  // ponytail: url view router; upgrade to react-router nested routes if views require individual code-splitting or deep sub-paths.
  const activeView: ActiveViewType =
    rawView === 'ledger' || rawView === 'vaults' || rawView === 'chat'
      ? rawView
      : 'overview';

  const handleViewChange = (newView: ActiveViewType) => {
    if (newView === 'settings') {
      modals.openSettingsModal();
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newView === 'overview') {
        next.delete('view');
      } else {
        next.set('view', newView);
      }
      return next;
    }, { replace: true });
  };

  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isLumpSumModalOpen, setIsLumpSumModalOpen] = useState<boolean>(false);

  // Inisialisasi state mode gelap berdasarkan kelas elemen root <html>
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  const handleToggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const activeTxError = txErrorMessage || ledger.error;

  const handleDismissTxError = () => {
    setTxErrorMessage(null);
    ledger.clearError();
  };

  const refreshAllData = async () => {
    await Promise.all([dashboard.refreshAll(), ledger.loadTransactions()]);
  };

  const handleDeleteTransaction = async (id: string) => {
    setTxErrorMessage(null);
    ledger.clearError();
    try {
      const success = await ledger.deleteTransaction(id);
      if (success) {
        await dashboard.refreshAll();
      }
    } catch (err: any) {
      setTxErrorMessage(err?.message || 'Gagal menghapus transaksi.');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">
      <AppLayout
        activeView={activeView}
        onViewChange={handleViewChange}
        accounts={dashboard.accounts}
        transactionCount={ledger.pagination.total}
        upcomingBills={dashboard.summary?.upcoming_bills}
        user={user}
        onLogout={logout}
        onOpenCreateAccount={modals.openCreateAccount}
        onOpenSettings={modals.openSettingsModal}
        onQuickCapturePress={() => {
          setChatPrompt('');
          handleViewChange('chat');
        }}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => setIsProfileOpen(true)}
      >
        <main
          className={
            activeView === 'chat'
              ? 'p-0 max-w-none w-full h-full flex flex-col'
              : 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10'
          }
        >
          <h1 className="sr-only">Dashboard Keuangan Rezekify</h1>

          {activeTxError && (
            <div
              role="alert"
              className={`p-4 rounded-2xl border bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 backdrop-blur-xl flex items-start justify-between gap-3 text-sm shadow-lg ${
                activeView === 'chat' ? 'm-4' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-xs uppercase tracking-wider mb-0.5 text-rose-700 dark:text-rose-400">
                    Gagal Menghapus Transaksi
                  </p>
                  <p className="text-slate-800 dark:text-rose-200 text-xs md:text-sm font-medium">
                    {activeTxError}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="light"
                onPress={handleDismissTxError}
                aria-label="Tutup pesan kesalahan transaksi"
                className="text-slate-500 hover:text-rose-600 dark:text-rose-300 dark:hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-xl bg-transparent"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ACTIVE DEDICATED VIEW */}
          {activeView === 'overview' && (
            <OverviewView
              summary={dashboard.summary}
              vaults={dashboard.vaults}
              accounts={dashboard.accounts}
              transactions={ledger.transactions}
              isLoading={dashboard.isLoading}
              refreshTrigger={dashboard.refreshTrigger}
              onNavigateToLedger={() => handleViewChange('ledger')}
              onNavigateToVaults={() => handleViewChange('vaults')}
              onOpenCreateAccount={modals.openCreateAccount}
              onOpenSimulateModal={modals.openSimulateModal}
              onOpenManualModal={modals.onOpenManualModal}
              onOpenLumpSumModal={() => setIsLumpSumModalOpen(true)}
              onOpenChat={(prompt) => {
                if (prompt) setChatPrompt(prompt);
                handleViewChange('chat');
              }}
              onDepositVault={modals.openDepositModal}
              onPayBillVault={modals.openPayBillModal}
              onRefreshData={refreshAllData}
            />
          )}

          {activeView === 'chat' && (
            <AIChatView
              initialTelemetry={
                dashboard.summary
                  ? {
                      operational_free_cash: dashboard.summary.operational_free_cash,
                      daily_safe_runway: dashboard.summary.daily_safe_runway,
                      days_remaining: dashboard.summary.days_remaining,
                      health_status: dashboard.summary.health_status,
                    }
                  : null
              }
              initialPrompt={chatPrompt}
              onNavigateToLedger={() => handleViewChange('ledger')}
              onDataMutated={refreshAllData}
            />
          )}

          {activeView === 'ledger' && (
            <LedgerView
              transactions={ledger.transactions}
              accounts={dashboard.accounts}
              categories={dashboard.categories}
              vaults={dashboard.vaults}
              total={ledger.pagination.total}
              page={ledger.pagination.page}
              pageSize={ledger.filters.page_size ?? 20}
              totalPages={ledger.pagination.total_pages}
              activeFilters={ledger.filters}
              onParamsChange={ledger.handleParamsChange}
              onPageChange={ledger.handlePageChange}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={modals.openEditTx}
              onOpenManualModal={modals.openManualModal}
              onOpenSimulateModal={modals.openSimulateModal}
              onOpenCategoryModal={modals.openCategoryModal}
              isLoading={ledger.isDeleting}
            />
          )}

          {activeView === 'vaults' && (
            <VaultsView
              vaults={dashboard.vaults}
              accounts={dashboard.accounts}
              isLoading={dashboard.isLoading}
              errorMessage={dashboard.vaultErrorMessage}
              onDismissError={dashboard.clearVaultError}
              onToggleLock={dashboard.handleToggleVaultLock}
              onEditVault={modals.openEditVault}
              onDeleteVault={dashboard.handleDeleteVault}
              onOpenCreateVault={modals.openVaultModal}
              onDepositVault={modals.openDepositModal}
              onPayBillVault={modals.openPayBillModal}
              onDataMutated={refreshAllData}
            />
          )}
        </main>

        {/* DOMAIN MODALS */}
        <React.Suspense fallback={null}>
          {modals.isEditTxModalOpen && (
            <EditTransactionModal
              isOpen={modals.isEditTxModalOpen}
              onClose={modals.closeEditTxModal}
              onSuccess={() => {
                modals.closeEditTxModal();
                refreshAllData();
              }}
              transaction={modals.selectedTxForEdit}
              accounts={dashboard.accounts}
              categories={dashboard.categories}
              vaults={dashboard.vaults}
            />
          )}

          {modals.isAccountModalOpen && (
            <AccountModal
              isOpen={modals.isAccountModalOpen}
              onClose={modals.closeAccountModal}
              accountToEdit={modals.selectedAccountForEdit}
              onSuccess={() => {
                refreshAllData();
              }}
            />
          )}

          {modals.isVaultModalOpen && (
            <VaultModal
              isOpen={modals.isVaultModalOpen}
              onClose={modals.closeVaultModal}
              onSuccess={() => {
                refreshAllData();
              }}
            />
          )}

          {modals.isEditVaultModalOpen && modals.selectedVaultForEdit && (
            <EditVaultModal
              isOpen={modals.isEditVaultModalOpen}
              onClose={modals.closeEditVaultModal}
              onSuccess={() => {
                modals.closeEditVaultModal();
                refreshAllData();
              }}
              vault={modals.selectedVaultForEdit}
            />
          )}

          {modals.isDepositModalOpen && (
            <DepositVaultModal
              isOpen={modals.isDepositModalOpen}
              onClose={modals.closeDepositModal}
              onSuccess={async () => {
                modals.closeDepositModal();
                await refreshAllData();
              }}
              vault={modals.selectedVaultForDeposit}
              accounts={dashboard.accounts}
            />
          )}

          {modals.isPayBillModalOpen && (
            <PayBillModal
              isOpen={modals.isPayBillModalOpen}
              onClose={modals.closePayBillModal}
              onSuccess={async () => {
                modals.closePayBillModal();
                await refreshAllData();
              }}
              vault={modals.selectedVaultForPayBill}
              accounts={dashboard.accounts}
            />
          )}

          {modals.isSimulateModalOpen && (
            <SimulatePurchaseModal
              isOpen={modals.isSimulateModalOpen}
              onClose={modals.closeSimulateModal}
            />
          )}

          {modals.isManualModalOpen && (
            <ManualTransactionModal
              isOpen={modals.isManualModalOpen}
              onClose={modals.closeManualModal}
              accounts={dashboard.accounts}
              categories={dashboard.categories}
              vaults={dashboard.vaults}
              onSuccess={() => {
                refreshAllData();
              }}
            />
          )}

          {modals.isSettingsModalOpen && (
            <SettingsModal
              isOpen={modals.isSettingsModalOpen}
              onClose={modals.closeSettingsModal}
              onSettingsUpdated={() => {
                refreshAllData();
              }}
            />
          )}

          {modals.isCategoryModalOpen && (
            <CategoryManagerModal
              isOpen={modals.isCategoryModalOpen}
              onClose={modals.closeCategoryModal}
              onSuccess={() => {
                refreshAllData();
              }}
              categories={dashboard.categories}
            />
          )}

          {isProfileOpen && (
            <ProfileModal
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              user={user}
              onUpdateProfile={async () => {
                await refreshAllData();
              }}
            />
          )}

          {isLumpSumModalOpen && (
            <LumpSumAllocationModal
              isOpen={isLumpSumModalOpen}
              onClose={() => setIsLumpSumModalOpen(false)}
              onSuccess={async () => {
                setIsLumpSumModalOpen(false);
                await refreshAllData();
              }}
              vaults={dashboard.vaults}
              accounts={dashboard.accounts}
            />
          )}
        </React.Suspense>
      </AppLayout>
    </div>
  );
};