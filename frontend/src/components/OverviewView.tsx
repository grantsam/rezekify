import React from 'react';
import { Button, Chip, Card, CardBody, Progress } from '@heroui/react';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Compass,
  ArrowRight,
  Lock,
  Unlock,
  Calculator,
  Wallet,
  Calendar,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardSummaryResponse, Vault, Account, Transaction } from '../types/api';
import { formatRupiah } from '../utils/formatters';
import { generateSurvivalGuidance, SurvivalGuidance } from '../utils/survivalGuidance';
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
  const [isSimulationOpen, setIsSimulationOpen] = React.useState<boolean>(false);
  const [simulationNominal, setSimulationNominal] = React.useState<number>(0);
  const [simulationInputValue, setSimulationInputValue] = React.useState<string>('');
  const [quickCaptureDraft, setQuickCaptureDraft] = React.useState<string | undefined>(undefined);

  // ponytail: deterministic client-side simulation; upgrade to multi-cycle forecasting if cycle transitions require rolling bills
  const simulationResults = React.useMemo(() => {
    const operationalFree = Math.max(0, summary?.operational_free_cash ?? 0);
    const daysRemaining = Math.max(1, summary?.days_remaining ?? 1);
    const currentDailyRunway = summary?.daily_safe_runway ?? 0;
    const safeThreshold = summary?.safe_runway_threshold ?? 30000;

    const planned = Math.max(0, simulationNominal);
    const isDeficit = planned > operationalFree;
    const projectedFree = Math.max(0, operationalFree - planned);
    const projectedDailyRunway = Math.floor(projectedFree / daysRemaining);
    const dailyDrop = Math.max(0, currentDailyRunway - projectedDailyRunway);

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    let statusCopy = `Belanja aman. Jatah harian Anda masih di atas batas aman operasional (${formatRupiah(safeThreshold)}/hari).`;

    if (isDeficit || projectedDailyRunway <= 0) {
      status = 'CRITICAL';
      statusCopy = 'Peringatan Defisit: Nominal melebihi saldo bebas pakai saat ini!';
    } else if (projectedDailyRunway < safeThreshold) {
      status = 'WARNING';
      statusCopy = `Waspada: Jatah belanja harian turun di bawah batas aman (${formatRupiah(safeThreshold)}/hari).`;
    }

    return {
      operationalFree,
      daysRemaining,
      currentDailyRunway,
      safeThreshold,
      planned,
      isDeficit,
      projectedFree,
      projectedFreeCash: projectedFree,
      projectedDailyRunway,
      dailyDrop,
      status,
      statusCopy,
    };
  }, [summary, simulationNominal]);

  // ponytail: Client fallback computes guidance when backend field is absent; upgrade path is consuming backend guidance directly
  const survivalGuidance: SurvivalGuidance = React.useMemo(() => {
    if (summary?.survival_guidance) {
      return summary.survival_guidance;
    }
    return generateSurvivalGuidance(
      summary?.operational_free_cash ?? 0,
      summary?.daily_safe_runway ?? 0,
      summary?.days_remaining ?? 1,
      summary?.safe_runway_threshold ?? 30000
    );
  }, [summary]);

  const guidanceTheme = React.useMemo(() => {
    switch (survivalGuidance.tone) {
      case 'CRITICAL':
        return {
          containerClass: 'bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/25 text-rose-900 dark:text-rose-100',
          badgeClass: 'text-rose-700 dark:text-rose-300',
          icon: <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
        };
      case 'WARNING':
        return {
          containerClass: 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/25 text-amber-900 dark:text-amber-100',
          badgeClass: 'text-amber-700 dark:text-amber-300',
          icon: <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
        };
      case 'HEALTHY':
      default:
        return {
          containerClass: 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/25 text-emerald-900 dark:text-emerald-100',
          badgeClass: 'text-emerald-700 dark:text-emerald-300',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
        };
    }
  }, [survivalGuidance.tone]);

  const handleNominalInputChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setSimulationNominal(0);
      setSimulationInputValue('');
      return;
    }
    const parsed = parseInt(cleaned, 10);
    setSimulationNominal(parsed);
    setSimulationInputValue(new Intl.NumberFormat('id-ID').format(parsed));
  };

  const handleAddPreset = (amount: number) => {
    const updated = simulationNominal + amount;
    setSimulationNominal(updated);
    setSimulationInputValue(new Intl.NumberFormat('id-ID').format(updated));
  };

  const handleResetSimulation = () => {
    setSimulationNominal(0);
    setSimulationInputValue('');
  };

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
          draftText={quickCaptureDraft}
          onDraftConsumed={() => setQuickCaptureDraft(undefined)}
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
                Batas pengeluaran harian agar cadangan operasional bertahan hingga akhir siklus.
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

            {/* CONTEXTUAL SURVIVAL GUIDANCE BANNER */}
            <div
              data-testid="survival-guidance-banner"
              className={`rounded-2xl p-4 border transition-all ${guidanceTheme.containerClass}`}
            >
              <div className="flex items-start gap-3">
                {guidanceTheme.icon}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/40 dark:bg-black/20 ${guidanceTheme.badgeClass}`}>
                      {survivalGuidance.headline}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-95">
                    {survivalGuidance.message}
                  </p>
                  <div className="pt-1 text-[11px] sm:text-xs font-semibold opacity-90">
                    <span className="font-bold">Langkah Praktis: </span>
                    {survivalGuidance.tactical_action}
                  </div>

                  {/* Tactical Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {survivalGuidance.tone === 'CRITICAL' && (summary?.operational_free_cash ?? 0) <= 0 ? (
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={onNavigateToVaults}
                        className="min-h-[38px] text-xs font-extrabold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                        endContent={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Lihat Pos Simpanan
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setIsSimulationOpen(true)}
                          className="min-h-[38px] text-xs font-extrabold rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 transition-all"
                        >
                          ⚡ Buka Simulasi Belanja
                        </Button>
                        {survivalGuidance.tone !== 'HEALTHY' && (
                          <Button
                            size="sm"
                            variant="light"
                            onPress={onNavigateToVaults}
                            className="min-h-[38px] text-xs font-bold rounded-xl text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
                            endContent={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Lihat Pos Pengeluaran
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
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
                  ÷ {summary?.days_remaining ?? 0} hari = <strong className="font-mono text-slate-700 dark:text-zinc-200">{formatRupiah(dailyRunway)} / hari</strong>
                </div>
              </div>
            </div>

            {/* Simulation Trigger Bar */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Simulasi Pra-Belanja (What-If)
                </span>
              </div>
              <Button
                size="sm"
                variant={isSimulationOpen ? 'flat' : 'bordered'}
                onPress={() => setIsSimulationOpen(!isSimulationOpen)}
                aria-expanded={isSimulationOpen}
                aria-controls="runway-simulation-panel"
                className={`min-h-[38px] text-xs font-extrabold rounded-xl transition-all ${
                  isSimulationOpen
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700/80'
                }`}
              >
                {isSimulationOpen ? '✕ Tutup Simulasi' : '⚡ Cek Dampak Belanja'}
              </Button>
            </div>

            {/* Expandable Simulation Drawer */}
            <AnimatePresence>
              {isSimulationOpen && (
                <motion.div
                  id="runway-simulation-panel"
                  data-testid="runway-simulation-panel"
                  role="region"
                  aria-label="Simulasi Pengeluaran Hero"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden pt-4 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-4"
                >
                  {/* Currency Input & Quick Chips */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label
                        htmlFor="simulation-nominal-input"
                        className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                      >
                        Rencana Belanja (Pengeluaran Luar Rutinitas)
                      </label>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={handleResetSimulation}
                        className="text-xs text-slate-500 dark:text-zinc-400 hover:text-rose-500 min-h-[38px] px-2.5 rounded-xl font-bold self-end sm:self-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Reset
                      </Button>
                    </div>

                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-sm font-bold text-slate-400 dark:text-zinc-500 select-none">
                        Rp
                      </span>
                      <input
                        id="simulation-nominal-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="Misal: 150.000"
                        value={simulationInputValue}
                        onChange={(e) => handleNominalInputChange(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-700/80 rounded-2xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mr-1 select-none">
                        Tambah Cepat:
                      </span>
                      {[
                        { label: '+50rb', amount: 50000, ariaLabel: 'Tambah 50 ribu rupiah' },
                        { label: '+100rb', amount: 100000, ariaLabel: 'Tambah 100 ribu rupiah' },
                        { label: '+250rb', amount: 250000, ariaLabel: 'Tambah 250 ribu rupiah' },
                        { label: '+500rb', amount: 500000, ariaLabel: 'Tambah 500 ribu rupiah' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          aria-label={preset.ariaLabel}
                          onClick={() => handleAddPreset(preset.amount)}
                          className="min-h-[38px] min-w-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700/80 transition-all cursor-pointer select-none active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Side-by-Side Comparison Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Realita Saat Ini */}
                    <div className="bg-white dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/60 pb-2.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Realita Saat Ini
                        </span>
                        <Chip
                          size="sm"
                          variant="flat"
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-extrabold"
                        >
                          STATUS SAAT INI
                        </Chip>
                      </div>

                      <div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                          Jatah Harian Saat Ini
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white tabular-nums">
                            {formatRupiah(summary?.daily_safe_runway ?? 0)}
                          </span>
                          <span className="text-slate-500 dark:text-zinc-400 text-xs font-bold">/ hari</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span>Sisa Jatah Hari Ini:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatRupiah(remainingBudget)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span>Saldo Bebas Operasional:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatRupiah(summary?.operational_free_cash ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Jika Jadi Beli */}
                    <div
                      data-testid="projected-card"
                      aria-live="polite"
                      className={`bg-white dark:bg-zinc-950/60 border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-colors ${
                        simulationResults.status === 'CRITICAL'
                          ? 'border-rose-500/40 bg-rose-500/[0.02]'
                          : simulationResults.status === 'WARNING'
                          ? 'border-amber-500/40 bg-amber-500/[0.02]'
                          : 'border-emerald-500/40 bg-emerald-500/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/60 pb-2.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                          Jika Jadi Beli
                        </span>
                        <Chip
                          size="sm"
                          variant="flat"
                          data-testid="simulation-status-badge"
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                            simulationResults.status === 'CRITICAL'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : simulationResults.status === 'WARNING'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {simulationResults.status === 'CRITICAL'
                            ? 'Defisit'
                            : simulationResults.status === 'WARNING'
                            ? 'Waspada'
                            : 'Aman'}
                        </Chip>
                      </div>

                      <div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                          Proyeksi Jatah Harian
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span
                            data-testid="projected-daily-runway"
                            className={`text-xl sm:text-2xl font-mono font-black tabular-nums ${
                              simulationResults.status === 'CRITICAL'
                                ? 'text-rose-600 dark:text-rose-400'
                                : simulationResults.status === 'WARNING'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatRupiah(simulationResults.projectedDailyRunway)}
                          </span>
                          <span className="text-slate-500 dark:text-zinc-400 text-xs font-bold">/ hari</span>
                        </div>
                        <div className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                          <span>Dampak:</span>
                          <span
                            data-testid="simulation-daily-drop"
                            className="font-mono font-bold text-rose-500 dark:text-rose-400 tabular-nums"
                          >
                            -{formatRupiah(simulationResults.dailyDrop)}
                          </span>
                          <span>/ hari</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span>Sisa Saldo Bebas:</span>
                          <span
                            data-testid="projected-free-cash"
                            className="font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                          >
                            {formatRupiah(simulationResults.projectedFreeCash)}
                          </span>
                        </div>
                        <div className="text-[11px] leading-relaxed pt-1">
                          <span
                            className={
                              simulationResults.status === 'CRITICAL'
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : simulationResults.status === 'WARNING'
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            }
                          >
                            {simulationResults.statusCopy}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer Bridge */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Simulasi murni evaluasi visual & tidak mengubah saldo atau buku besar.
                    </p>
                    <Button
                      onPress={() => {
                        setQuickCaptureDraft(`Beli Rp ${new Intl.NumberFormat('id-ID').format(simulationNominal)}`);
                        setIsSimulationOpen(false);
                      }}
                      isDisabled={simulationNominal <= 0}
                      disabled={simulationNominal <= 0}
                      className="min-h-[38px] bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-4 rounded-xl shadow-md shadow-emerald-900/20 transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Lanjut Catat Pengeluaran ➔
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
