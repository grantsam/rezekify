import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import {
  DashboardSummaryResponse,
  Transaction,
  Account,
  ChatResponse,
  ReceiptUploadResponse,
} from '../types/api';
import { OmniInputHero } from '../components/OmniInputHero';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';
import { RunwayMetricCard } from '../components/RunwayMetricCard';
import { ExpenseCharts } from '../components/ExpenseCharts';
import { TransactionsTable } from '../components/TransactionsTable';
import { ManualTransactionModal } from '../components/ManualTransactionModal';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [aiMessage, setAiMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumData, txData, accData] = await Promise.all([
        apiFetch<DashboardSummaryResponse>('/dashboard/summary').catch(() => null),
        apiFetch<Transaction[]>('/transactions').catch(() => []),
        apiFetch<Account[]>('/accounts').catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setTransactions(txData || []);
      setAccounts(accData || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAiSubmit = async (payload: { text: string; file: File | null }) => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      if (payload.file) {
        const formData = new FormData();
        formData.append('file', payload.file);
        if (payload.text.trim()) {
          formData.append('message', payload.text.trim());
        }
        const res = await apiFetch<ReceiptUploadResponse>('/dashboard/ai-receipt', {
          method: 'POST',
          body: formData,
        });
        const isError = res.transaction_id == null;
        setAiMessage({
          text: res.reply || (isError ? 'Gagal mencatat struk belanja.' : 'Struk berhasil dicatat ke dalam ledger!'),
          isError,
        });
      } else {
        const res = await apiFetch<ChatResponse>('/dashboard/ai-chat', {
          method: 'POST',
          body: JSON.stringify({ message: payload.text.trim() }),
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                loadData();
                setRefreshTrigger((prev) => prev + 1);
              }}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors disabled:opacity-40"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>Catat Manual</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
          isLoading={isDeleting}
        />
      </main>

      <ManualTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        onSuccess={() => {
          loadData();
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
};
