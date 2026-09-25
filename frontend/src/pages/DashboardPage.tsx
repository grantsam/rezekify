import React, { useState } from 'react';
import { apiFetch, submitVoice } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { ChatResponse } from '../types/api';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useTransactionsLedger } from '../hooks/useTransactionsLedger';
import { useDashboardData } from '../hooks/useDashboardData';
import { AppLayout } from '../components/AppLayout';
import { QuickCaptureBar } from '../components/QuickCaptureBar';
import { OverviewView } from '../components/OverviewView';
import { LedgerView } from '../components/LedgerView';
import { VaultsView } from '../components/VaultsView';
const ManualTransactionModal = React.lazy(() => import('../components/ManualTransactionModal').then(m => ({ default: m.ManualTransactionModal })));
const AccountModal = React.lazy(() => import('../components/AccountModal').then(m => ({ default: m.AccountModal })));
const VaultModal = React.lazy(() => import('../components/VaultModal').then(m => ({ default: m.VaultModal })));
const SimulatePurchaseModal = React.lazy(() => import('../components/SimulatePurchaseModal').then(m => ({ default: m.SimulatePurchaseModal })));
const EditTransactionModal = React.lazy(() => import('../components/EditTransactionModal').then(m => ({ default: m.EditTransactionModal })));
const EditVaultModal = React.lazy(() => import('../components/EditVaultModal').then(m => ({ default: m.EditVaultModal })));
const SettingsModal = React.lazy(() => import('../components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CategoryManagerModal = React.lazy(() => import('../components/CategoryManagerModal').then(m => ({ default: m.CategoryManagerModal })));

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

  const modals = useDashboardModals();
  const ledger = useTransactionsLedger();
  const dashboard = useDashboardData();

  const [activeView, setActiveView] = useState<'overview' | 'ledger' | 'vaults' | 'settings'>('overview');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);

  const activeTxError = txErrorMessage || ledger.error;

  const handleDismissTxError = () => {
    setTxErrorMessage(null);
    ledger.clearError();
  };

  const refreshAllData = async () => {
    await Promise.all([dashboard.refreshAll(), ledger.loadTransactions()]);
  };

  const handleAiSubmit = async (
    input: string | { text: string; file: File | null },
    fileArg?: File | null
  ) => {
    let text = '';
    let file: File | null = null;
    if (typeof input === 'object' && input !== null) {
      text = input.text || '';
      file = input.file || null;
    } else {
      text = input || '';
      file = fileArg ?? null;
    }

    setIsAiLoading(true);
    setAiMessage(null);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (text.trim()) {
          formData.append('message', text.trim());
        }
        const res = await apiFetch<ChatResponse>('/dashboard/ai-receipt', {
          method: 'POST',
          body: formData,
        });
        const isError = !res.reply || res.reply.startsWith('❌') || res.reply.includes('Gagal');
        setAiMessage({
          text: res.reply || (isError ? 'Gagal mencatat struk belanja.' : 'Struk berhasil dicatat ke dalam ledger!'),
          isError,
        });
      } else {
        const res = await apiFetch<ChatResponse>('/dashboard/ai-chat', {
          method: 'POST',
          body: JSON.stringify({ message: text.trim() }),
        });
        setAiMessage({ text: res.reply || 'Berhasil dicatat ke dalam ledger!' });
      }

      await refreshAllData();
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses input AI. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVoiceSubmit = async (blob: Blob, caption?: string) => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const res = await submitVoice(blob, caption);
      const isError = !res.reply || res.reply.startsWith('❌') || res.reply.includes('Gagal');
      setAiMessage({
        text: res.reply || (isError ? 'Gagal memproses pesan suara.' : 'Pesan suara berhasil dicatat ke dalam ledger!'),
        isError,
      });
      await refreshAllData();
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses pesan suara. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
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
    <AppLayout
      activeView={activeView}
      onViewChange={(view) => {
        if (view === 'settings') {
          modals.openSettingsModal();
        } else {
          setActiveView(view);
        }
      }}
      accounts={dashboard.accounts}
      transactionCount={ledger.pagination.total}
      user={user}
      onLogout={logout}
      onOpenCreateAccount={modals.openCreateAccount}
      onOpenSettings={modals.openSettingsModal}
      onQuickCapturePress={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <h1 className="sr-only">Dashboard Keuangan Rezekify</h1>

        {/* Precision 44px Command Bar */}
        <QuickCaptureBar
          onSubmit={handleAiSubmit}
          onVoiceSubmit={handleVoiceSubmit}
          isLoading={isAiLoading}
          toastMessage={aiMessage}
          onDismissToast={() => setAiMessage(null)}
        />

        {/* In-surface Transaction Error Banner */}
        {activeTxError && (
          <div
            role="alert"
            className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-sm"
          >
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-zinc-400">
                Gagal Menghapus Transaksi
              </p>
              <p className="text-zinc-200 text-xs md:text-sm">{activeTxError}</p>
            </div>
            <button
              type="button"
              onClick={handleDismissTxError}
              aria-label="Tutup pesan kesalahan transaksi"
              className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-lg bg-transparent"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Active Dedicated View */}
        {activeView === 'overview' && (
          <OverviewView
            summary={dashboard.summary}
            vaults={dashboard.vaults}
            accounts={dashboard.accounts}
            isLoading={dashboard.isLoading}
            refreshTrigger={dashboard.refreshTrigger}
            onNavigateToVaults={() => setActiveView('vaults')}
            onOpenCreateAccount={modals.openCreateAccount}
            onOpenSimulateModal={modals.openSimulateModal}
          />
        )}

        {activeView === 'ledger' && (
          <LedgerView
            transactions={ledger.transactions}
            accounts={dashboard.accounts}
            categories={dashboard.categories}
            total={ledger.pagination.total}
            page={ledger.pagination.page}
            pageSize={ledger.filters.page_size ?? 20}
            totalPages={ledger.pagination.total_pages}
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
            isLoading={dashboard.isLoading}
            errorMessage={dashboard.vaultErrorMessage}
            onDismissError={dashboard.clearVaultError}
            onToggleLock={dashboard.handleToggleVaultLock}
            onEditVault={modals.openEditVault}
            onDeleteVault={dashboard.handleDeleteVault}
            onOpenCreateVault={modals.openVaultModal}
          />
        )}
      </main>

      {/* Domain Modals */}
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
      </React.Suspense>
    </AppLayout>
  );
};
