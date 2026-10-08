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
}) => {
  const activeAccounts = accounts.filter((acc) => acc.is_active !== false);

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          label: 'Aman Terkendali',
          color: 'success' as const,
          chipClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          progressColor: 'success' as const,
        };
      case 'WARNING':
        return {
          label: 'Waspada',
          color: 'warning' as const,
          chipClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          progressColor: 'warning' as const,
        };
      case 'CRITICAL':
        return {
          label: 'Hemat Ketat',
          color: 'danger' as const,
          chipClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
          progressColor: 'danger' as const,
        };
      default:
        return {
          label: status || 'UNKNOWN',
          color: 'default' as const,
          chipClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
          progressColor: 'default' as const,
        };
    }
  };

  const statusConfig = getStatusConfig(summary?.health_status);
  const dailyRunway = summary?.daily_safe_runway ?? 0;
  const todaySpent = summary?.today_spent ?? 0;
  const remainingBudget = dailyRunway - todaySpent;
  const isOverspent = remainingBudget < 0;

  // Percentage of daily safe runway spent today (capped at 100 for visual bar)
  const spentPercentage = dailyRunway > 0 ? Math.min(100, Math.max(0, Math.round((todaySpent / dailyRunway) * 100))) : (todaySpent > 0 ? 100 : 0);

  return (
    <div className="space-y-6">
      {/* Onboarding Banner when no accounts */}
      {!isLoading && activeAccounts.length === 0 && (
        <Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none">
          <CardBody className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-zinc-800 border border-zinc-700/80 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  Mulai Hitung Batas Belanja Harian
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-1">
                  Tambahkan rekening atau dompet pertama Anda (BCA, GoPay, atau Tunai) untuk mengaktifkan telemetri runway otomatis dan kalkulasi belanja harian bebas risiko.
                </p>
              </div>
            </div>
            <Button
              color="primary"
              onPress={onOpenCreateAccount}
              startContent={<Building2 className="w-4 h-4" />}
              className="font-semibold text-xs py-2.5 px-4 min-h-[40px] rounded-xl shrink-0 bg-white text-zinc-950 hover:bg-zinc-200"
            >
              + Tambah Rekening Pertama
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Tier 1: Status Keuangan Hari Ini (Hero Card) */}
      <Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-xl overflow-hidden relative">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <CardBody className="p-5 sm:p-6 relative z-10 flex flex-col gap-6">
          {/* Top Bar: Title & Health Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                STATUS KEUANGAN HARI INI
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Jatah Belanja Hari Ini
              </h2>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color={statusConfig.color}
              className={`text-xs font-semibold px-2 py-0.5 ${statusConfig.chipClass}`}
            >
              {statusConfig.label}
            </Chip>
          </div>

          {/* Core Daily Safe Runway Number */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl md:text-5xl font-mono font-bold text-white tabular-nums tracking-tight">
                  {formatRupiah(dailyRunway)}
                </span>
                <span className="text-zinc-400 text-sm sm:text-base font-normal">/ hari</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                Batas belanja aman harian agar cadangan operasional bertahan hingga akhir siklus.
              </p>
            </div>
          </div>

          {/* Sub-bar: Pengeluaran Hari Ini, Sisa Jatah, Progress Bar */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-medium">Pengeluaran Hari Ini:</span>
                <span className="text-zinc-200 font-mono font-semibold tabular-nums">
                  {formatRupiah(todaySpent)}
                </span>
              </div>

              <div>
                {isOverspent ? (
                  <span className="text-rose-400 font-semibold font-mono tabular-nums">
                    Melebihi jatah: {formatRupiah(Math.abs(remainingBudget))}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-medium">Sisa Jatah Hari Ini:</span>
                    <span className="text-emerald-400 font-semibold font-mono tabular-nums">
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
              color={isOverspent ? 'danger' : statusConfig.progressColor}
              aria-label="Progres Pengeluaran Hari Ini"
              className="h-2"
            />

            {/* Bottom Meta in Sub-bar: Saldo Bebas Pakai & Sisa Hari */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/60 text-xs">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-400">Saldo Bebas Pakai:</span>
                <span className="text-white font-mono font-semibold tabular-nums">
                  {formatRupiah(summary?.operational_free_cash ?? 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-zinc-300 font-medium">
                  {summary?.days_remaining ?? 0} hari lagi menuju siklus baru
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Spotlight Hero */}
      <AISpotlightHero onOpenChat={onOpenChat ?? (() => {})} />

      {/* Tier 2: Tren 7 Hari & Transaksi Terakhir (Grid 12-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Col 7: 7-Day Spending Chart */}
        <div className="lg:col-span-7 w-full">
          <ExpenseCharts refreshTrigger={refreshTrigger} />
        </div>

        {/* Col 5: Recent Transactions Card */}
        <div className="lg:col-span-5 w-full">
          <RecentTransactionsCard
            transactions={transactions ?? []}
            isLoading={isLoading}
            onViewAll={onNavigateToLedger}
          />
        </div>
      </div>

      {/* Tier 3: Tagihan & Pos Tabungan (Grid 12-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Col 6: Upcoming Bills Card */}
        <div className="lg:col-span-6 w-full">
          <UpcomingBillsCard bills={summary?.upcoming_bills} isLoading={isLoading} />
        </div>

        {/* Col 6: Komitmen & Vaults Prioritas */}
        <div className="lg:col-span-6 w-full">
          <Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Komitmen & Vaults Prioritas</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={onOpenSimulateModal}
                    startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[32px] rounded-lg text-xs"
                  >
                    Simulasi Belanja
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={onNavigateToVaults}
                    endContent={<ArrowRight className="w-3.5 h-3.5" />}
                    className="text-xs text-zinc-400 hover:text-white bg-transparent p-1 min-h-[32px]"
                  >
                    Lihat Semua Vault
                  </Button>
                </div>
              </div>

              {vaults.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  Belum ada pos komitmen atau vault aktif.
                </div>
              ) : (
                <div className="space-y-3">
                  {vaults.slice(0, 3).map((vault) => {
                    const pct =
                      vault.target_amount > 0
                        ? Math.min(100, Math.round((vault.allocated_amount / vault.target_amount) * 100))
                        : 100;
                    return (
                      <div
                        key={vault.id}
                        className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-white truncate max-w-[180px]">
                            {vault.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {vault.is_locked ? (
                              <Lock className="w-3 h-3 text-zinc-400" />
                            ) : (
                              <Unlock className="w-3 h-3 text-zinc-500" />
                            )}
                            <span className="text-[10px] font-mono text-zinc-400">{pct}%</span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden my-1.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="h-full bg-emerald-400 rounded-full"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums">
                          <span>{formatRupiah(vault.allocated_amount)}</span>
                          <span className="text-zinc-500">/ {formatRupiah(vault.target_amount)}</span>
                        </div>
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
