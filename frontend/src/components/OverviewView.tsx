import React from 'react';
import { Button, Chip, Card, CardBody, Progress } from '@heroui/react';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Lock,
  Unlock,
  Calculator,
  Wallet,
  Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSummaryResponse, Vault, Account, Transaction } from '../types/api';
import { formatRupiah } from '../utils/formatters';
import { ExpenseCharts } from './ExpenseCharts';
import { UpcomingBillsCard } from './UpcomingBillsCard';
import { RecentTransactionsCard } from './RecentTransactionsCard';
import { AISpotlightHero } from './AISpotlightHero';
import { QuickCaptureBar } from './QuickCaptureBar';
import * as apiClient from '../services/apiClient';

export interface OverviewViewProps {
  summary: DashboardSummaryResponse | null;
  vaults: Vault[];
  accounts: Account[];
  transactions?: Transaction[];
  isLoading: boolean;
  refreshTrigger: number;
  onNavigateToLedger?: () => void;
  onNavigateToVaults: () => void;
  onOpenCreateAccount: () => void;
  onOpenSimulateModal: () => void;
  onOpenChat?: (prompt?: string) => void;
  onDepositVault?: (vault: Vault) => void;
  onPayBillVault?: (vault: Vault) => void;
  onRefreshData?: () => Promise<void> | void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  vaults,
  accounts,
  transactions,
  isLoading,
  refreshTrigger,
  onNavigateToLedger,
  onNavigateToVaults,
  onOpenCreateAccount,
  onOpenSimulateModal,
  onOpenChat,
  onDepositVault,
  onPayBillVault,
  onRefreshData,
}) => {
  const [isQuickCaptureLoading, setIsQuickCaptureLoading] = React.useState<boolean>(false);
  const [quickCaptureToast, setQuickCaptureToast] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const handleQuickCaptureSubmit = async (
    input: string | { text: string; file: File | null },
    fileArg?: File | null
  ) => {
    const textStr = typeof input === 'string' ? input.trim() : (input.text || '').trim();
    const fileObj = typeof input === 'string' ? fileArg : input.file;
    if (!textStr && !fileObj) return;

    setIsQuickCaptureLoading(true);
    try {
      let res;
      if (fileObj) {
        res = await apiClient.submitChatReceipt(fileObj, textStr || undefined);
      } else {
        res = await apiClient.submitChatMessage(textStr);
      }
      setQuickCaptureToast({
        text: res.reply || 'Transaksi berhasil dicatat!',
        isError: false,
      });
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setQuickCaptureToast({
        text: err?.message || 'Gagal mencatat transaksi.',
        isError: true,
      });
    } finally {
      setIsQuickCaptureLoading(false);
    }
  };

  const handleQuickCaptureVoiceSubmit = async (blob: Blob, caption?: string) => {
    setIsQuickCaptureLoading(true);
    try {
      const res = await apiClient.submitChatVoice(blob, caption);
      setQuickCaptureToast({
        text: res.reply || 'Pesan suara berhasil diproses!',
        isError: false,
      });
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setQuickCaptureToast({
        text: err?.message || 'Gagal memproses pesan suara.',
        isError: true,
      });
    } finally {
      setIsQuickCaptureLoading(false);
    }
  };

  const activeAccounts = accounts.filter((acc) => acc.is_active !== false);

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          label: 'Aman Terkendali',
          color: 'success' as const,
          chipClass: 'bg-emerald-500/15 text-[#0F766E] dark:text-[#10B981] border border-[#10B981]/30 font-extrabold',
          titleColor: 'text-emerald-600 dark:text-emerald-400',
          progressColor: 'success' as const,
        };
      case 'WARNING':
        return {
          label: 'Waspada',
          color: 'warning' as const,
          chipClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-extrabold',
          titleColor: 'text-amber-600 dark:text-amber-400',
          progressColor: 'warning' as const,
        };
      case 'CRITICAL':
        return {
          label: 'Hemat Ketat',
          color: 'danger' as const,
          chipClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-extrabold',
          titleColor: 'text-rose-600 dark:text-rose-400',
          progressColor: 'danger' as const,
        };
      default:
        return {
          label: status || 'UNKNOWN',
          color: 'default' as const,
          chipClass: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700',
          titleColor: 'text-zinc-500 dark:text-zinc-400',
          progressColor: 'default' as const,
        };
    }
  };

  const statusConfig = getStatusConfig(summary?.health_status);
  const dailyRunway = summary?.daily_safe_runway ?? 0;
  const todaySpent = summary?.today_spent ?? 0;
  const remainingBudget = dailyRunway - todaySpent;
  const isOverspent = remainingBudget < 0;

  const spentPercentage = dailyRunway > 0 ? Math.min(100, Math.max(0, Math.round((todaySpent / dailyRunway) * 100))) : (todaySpent > 0 ? 100 : 0);

  return (
    <div className="space-y-6 text-left pb-8">
      {/* 1. ONBOARDING BANNER (JIKA REKENING KOSONG) */}
      {!isLoading && activeAccounts.length === 0 && (
        <Card className="bg-white/80 dark:bg-[#141417]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] shadow-lg shadow-black/5">
          <CardBody className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl shrink-0">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Mulai Hitung Batas Belanja Harian
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mt-1">
                  Tambahkan rekening atau dompet pertama Anda (BCA, GoPay, atau Tunai) untuk mengaktifkan telemetri runway otomatis dan kalkulasi belanja harian bebas risiko.
                </p>
              </div>
            </div>
            <Button
              onPress={onOpenCreateAccount}
              startContent={<Building2 className="w-4 h-4" />}
              className="font-extrabold text-xs py-2.5 px-5 min-h-[42px] rounded-2xl shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-900/25 transition-all"
            >
              + Tambah Rekening Pertama
            </Button>
          </CardBody>
        </Card>
      )}

      {/* QUICK CAPTURE COMMAND BAR (CENTER OF GRAVITY) */}
      <div className="w-full">
        <QuickCaptureBar
          onSubmit={handleQuickCaptureSubmit}
          onVoiceSubmit={handleQuickCaptureVoiceSubmit}
          isLoading={isQuickCaptureLoading}
          toastMessage={quickCaptureToast}
          onDismissToast={() => setQuickCaptureToast(null)}
        />
      </div>

      <AISpotlightHero onOpenChat={onOpenChat ?? (() => {})} />

      {/* 2. TIER 1: HERO TELEMETRY (JATAH BELANJA HARI INI) */}
      <Card className="bg-white/80 dark:bg-[#141417]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] shadow-lg shadow-black/5 overflow-hidden relative">
        <CardBody className="p-6 sm:p-8 relative z-10 flex flex-col gap-6">
          {/* Top Bar: Title & Health Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-zinc-800/80 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusConfig.titleColor} block mb-1`}>
                STATUS KEUANGAN HARI INI
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Jatah Belanja Hari Ini
              </h2>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color={statusConfig.color}
              className={`text-xs px-3 py-1 rounded-full ${statusConfig.chipClass}`}
            >
              {statusConfig.label}
            </Chip>
          </div>

          {/* Core Daily Safe Runway Number */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl md:text-5xl font-mono font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {formatRupiah(dailyRunway)}
                </span>
                <span className="text-slate-500 dark:text-zinc-400 text-sm sm:text-base font-bold">/ hari</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1.5 font-medium">
                Batas belanja aman harian agar cadangan operasional bertahan hingga akhir siklus.
              </p>
            </div>
          </div>

          {/* Sub-bar: Pengeluaran Hari Ini, Sisa Jatah, Progress Bar */}
          <div className="bg-slate-50/90 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3.5 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-zinc-400 font-bold">Pengeluaran Hari Ini:</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold tabular-nums">
                  {formatRupiah(todaySpent)}
                </span>
              </div>

              <div>
                {isOverspent ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Jatah hari ini terlampaui ({formatRupiah(Math.abs(remainingBudget))})
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                      · Sisa siklus disesuaikan otomatis
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-zinc-400 font-bold">Sisa Jatah Hari Ini:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black font-mono tabular-nums">
                      {formatRupiah(remainingBudget)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Spending Progress Bar */}
            <Progress
              size="sm"
              radius="full"
              value={spentPercentage}
              color={isOverspent ? 'warning' : statusConfig.progressColor}
              aria-label="Progres Pengeluaran Hari Ini"
              className="h-2.5"
            />

            {/* Bottom Meta in Sub-bar: Saldo Bebas Pakai & Sisa Hari */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 text-xs">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Saldo Bebas Pakai:</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold tabular-nums">
                  {formatRupiah(summary?.operational_free_cash ?? 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-slate-700 dark:text-zinc-300 font-bold">
                  {summary?.days_remaining ?? 0} hari lagi menuju siklus baru
                </span>
              </div>
            </div>

            {/* Mathematical Reconciliation Strip */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="font-medium text-slate-600 dark:text-zinc-300">Total Kas:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatRupiah(summary?.total_liquid_cash ?? 0)}
                  </span>
                  <span className="text-slate-400 dark:text-zinc-500 font-mono font-bold">−</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Terkunci di Pos/Tagihan:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    {formatRupiah(summary?.vault_locked_cash ?? 0)}
                  </span>
                  <span className="text-slate-400 dark:text-zinc-500 font-mono font-bold">=</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Bebas Pakai:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatRupiah(summary?.operational_free_cash ?? 0)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                  ÷ {summary?.days_remaining ?? 0} hari = <strong className="font-mono text-slate-700 dark:text-zinc-200">{formatRupiah(dailyRunway)}/hari</strong>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 3. TIER 2: BENTO GRID ANALITIK & TRANSAKSI TERAKHIR (SPAN 7:5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 w-full flex flex-col h-full">
          <ExpenseCharts refreshTrigger={refreshTrigger} />
        </div>

        <div className="lg:col-span-5 w-full flex flex-col h-full">
          <RecentTransactionsCard
            transactions={transactions ?? []}
            isLoading={isLoading}
            onViewAll={onNavigateToLedger}
          />
        </div>
      </div>

      {/* 5. TIER 4: BENTO GRID TAGIHAN & VAULTS PRIORITAS (SIMETRIS 50:50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Col 1: Upcoming Bills Card */}
        <div className="w-full flex flex-col h-full">
          <UpcomingBillsCard
            bills={summary?.upcoming_bills}
            isLoading={isLoading}
            vaults={vaults}
            onDepositVault={onDepositVault}
            onPayBillVault={onPayBillVault}
          />
        </div>

        {/* Col 2: Komitmen & Vaults Prioritas */}
        <div className="w-full flex flex-col h-full">
          <Card className="w-full h-full bg-white/80 dark:bg-[#141417]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] shadow-lg shadow-black/5 flex flex-col justify-between">
            <CardBody className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60 dark:border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Komitmen & Vaults Prioritas</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={onOpenSimulateModal}
                    startContent={<Calculator className="w-3.5 h-3.5 text-emerald-500" />}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold min-h-[32px] rounded-xl text-xs"
                  >
                    Simulasi Belanja
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={onNavigateToVaults}
                    aria-label="Lihat Semua Vault"
                    endContent={<ArrowRight className="w-3.5 h-3.5" />}
                    className="text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-emerald-500 bg-transparent p-1 min-h-[32px] rounded-xl"
                  >
                    Lihat Semua Vault
                  </Button>
                </div>
              </div>

              {vaults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 font-medium my-auto">
                  Belum ada pos komitmen atau vault aktif.
                </div>
              ) : (
                <div className="space-y-3 my-auto">
                  {vaults.slice(0, 3).map((vault) => {
                    const pct =
                      vault.target_amount > 0
                        ? Math.min(100, Math.round((vault.allocated_amount / vault.target_amount) * 100))
                        : 100;
                    return (
                      <div
                        key={vault.id}
                        className="bg-slate-50/90 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[180px]">
                            {vault.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {vault.is_locked ? (
                              <Lock className="w-3 h-3 text-slate-400" />
                            ) : (
                              <Unlock className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="text-[10px] font-mono font-bold text-emerald-400">{pct}%</span>
                          </div>
                        </div>

                        <div
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progres ${vault.name}`}
                          className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden my-1.5"
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-[#0F766E] to-[#10B981] rounded-full"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono font-bold tabular-nums">
                          <span className="text-slate-900 dark:text-white">{formatRupiah(vault.allocated_amount)}</span>
                          <span className="text-slate-400 dark:text-zinc-500">/ {formatRupiah(vault.target_amount)}</span>
                        </div>

                        {(onDepositVault || onPayBillVault) && (
                          <div className="pt-2">
                            {vault.vault_type === 'FIXED_BILL' ? (
                              <button
                                type="button"
                                onClick={() => onPayBillVault?.(vault)}
                                className="w-full py-1.5 px-3 rounded-xl text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                              >
                                Bayar Tagihan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onDepositVault?.(vault)}
                                className="w-full py-1.5 px-3 rounded-xl text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                              >
                                + Nabung
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
