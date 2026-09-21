import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  Receipt,
  Calculator,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  DashboardSummaryResponse,
  Transaction,
  Account,
  Category,
  ChatResponse,
  ReceiptUploadResponse,
} from '../types/api';
import { OmniInputHero } from '../components/OmniInputHero';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';
import { RunwayMetricCard } from '../components/RunwayMetricCard';
import { ExpenseCharts } from '../components/ExpenseCharts';
import { TransactionsTable } from '../components/TransactionsTable';
import { ManualTransactionModal } from '../components/ManualTransactionModal';
import { AccountModal } from '../components/AccountModal';
import { VaultModal } from '../components/VaultModal';
import { SimulatePurchaseModal } from '../components/SimulatePurchaseModal';
import { EditTransactionModal } from '../components/EditTransactionModal';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [aiMessage, setAiMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumData, txData, accData, catData] = await Promise.all([
        apiFetch<DashboardSummaryResponse>('/dashboard/summary').catch(() => null),
        apiFetch<Transaction[]>('/transactions').catch(() => []),
        apiFetch<Account[]>('/accounts').catch(() => []),
        apiFetch<Category[]>('/categories').catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setTransactions(txData || []);
      setAccounts(accData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerRefresh = useCallback(() => {
    loadData();
    setRefreshTrigger((prev) => prev + 1);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        const res = await apiFetch<ReceiptUploadResponse>('/dashboard/ai-receipt', {
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

      await loadData();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses input AI. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      setIsDeleting(true);
      await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
      await loadData();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getUserInitials = (name?: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <span className="font-extrabold text-white text-base">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">Rezekify</span>
              <span className="hidden sm:inline-block ml-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                Deterministic Runway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => {
                loadData();
                setRefreshTrigger((prev) => prev + 1);
              }}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors disabled:opacity-40 shrink-0"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Rekening</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Tagihan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(true)}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              <span>Simulasi Belanja</span>
            </button>

            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Transaksi Manual</span>
            </button>

            {user && (
              <div className="flex items-center gap-2 pl-1 sm:pl-2 shrink-0 border-l border-slate-800">
                <div
                  className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center"
                  title={user.full_name}
                >
                  {getUserInitials(user.full_name)}
                </div>
                <span className="text-xs font-medium text-slate-200 hidden lg:inline max-w-[120px] truncate">
                  {user.full_name}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={logout}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
              title="Keluar (Logout)"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!isLoading && accounts.length === 0 && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-indigo-950/40">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <Wallet className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                  👋 Selamat datang di Rezekify! Anda belum memiliki rekening atau dompet. Tambahkan rekening pertama Anda (Bank / e-Wallet) agar pengeluaran dapat dicatat secara seimbang.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-indigo-600/30 active:scale-95 shrink-0 flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>Tambah Rekening Pertama</span>
            </button>
          </div>
        )}

        <OmniInputHero onSubmit={handleAiSubmit} isLoading={isAiLoading} />

        {aiMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-sm transition-all ${
              aiMessage.isError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {aiMessage.isError ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-slate-400">
                  {aiMessage.isError ? 'Gagal Memproses' : 'Hasil Konfirmasi AI'}
                </p>
                <p className="text-slate-200 whitespace-pre-line text-xs md:text-sm">{aiMessage.text}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800/40"
            >
              Tutup
            </button>
          </div>
        )}

        {summary?.upcoming_bills && <UpcomingBillsCard bills={summary.upcoming_bills} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <RunwayMetricCard summary={summary} />
          </div>
          <div className="lg:col-span-7">
            <ExpenseCharts refreshTrigger={refreshTrigger} />
          </div>
        </div>

        <TransactionsTable
          transactions={transactions}
          onDelete={handleDeleteTransaction}
          onEdit={(tx) => {
            setSelectedTxForEdit(tx);
            setIsEditModalOpen(true);
          }}
          isLoading={isDeleting}
        />
      </main>

      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTxForEdit(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedTxForEdit(null);
          triggerRefresh();
        }}
        transaction={selectedTxForEdit}
        accounts={accounts}
        categories={categories}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSuccess={() => {
          loadData();
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        onSuccess={() => {
          loadData();
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      <SimulatePurchaseModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
      />

      <ManualTransactionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        accounts={accounts}
        onSuccess={() => {
          loadData();
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
};
