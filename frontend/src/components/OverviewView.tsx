import React from 'react';
import { Button, Chip } from '@heroui/react';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Lock,
  Unlock,
  Calculator,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSummaryResponse, Vault, Account } from '../types/api';
import { RunwayMetricCard } from './RunwayMetricCard';
import { ExpenseCharts } from './ExpenseCharts';
import { UpcomingBillsCard } from './UpcomingBillsCard';

export interface OverviewViewProps {
  summary: DashboardSummaryResponse | null;
  vaults: Vault[];
  accounts: Account[];
  isLoading: boolean;
  refreshTrigger: number;
  onNavigateToVaults: () => void;
  onOpenCreateAccount: () => void;
  onOpenSimulateModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  vaults,
  accounts,
  isLoading,
  refreshTrigger,
  onNavigateToVaults,
  onOpenCreateAccount,
  onOpenSimulateModal,
}) => {
  const activeAccounts = accounts.filter((acc) => acc.is_active !== false);

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'CRITICAL':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Banner when no accounts */}
      {!isLoading && activeAccounts.length === 0 && (
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            type="button"
            color="primary"
            onPress={onOpenCreateAccount}
            startContent={<Building2 className="w-4 h-4" />}
            className="font-semibold text-xs py-2.5 px-4 min-h-[40px] rounded-xl shrink-0 bg-white text-zinc-950 hover:bg-zinc-200"
          >
            + Tambah Rekening Pertama
          </Button>
        </div>
      )}

      {/* 3 Telemetry Hero Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tile 1: Daily Safe Runway */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              DAILY SAFE RUNWAY
            </span>
            <Chip
              size="sm"
              variant="flat"
              color={getStatusBadgeColor(summary?.health_status)}
              className="text-[11px] font-bold uppercase tracking-wider"
            >
              {summary?.health_status || 'UNKNOWN'}
            </Chip>
          </div>
          <div className="my-2">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
              Rp {(summary?.daily_safe_runway ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {summary?.days_remaining ?? 0} hari tersisa dalam siklus bulanan
          </p>
        </div>

        {/* Tile 2: Kas Bebas Operasional */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              KAS BEBAS OPERASIONAL
            </span>
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-200 tabular-nums">
              Rp {(summary?.operational_free_cash ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Total kas cair (Rp {(summary?.total_liquid_cash ?? 0).toLocaleString('id-ID')}) dikurangi pos vault
          </p>
        </div>

        {/* Tile 3: Cadangan Terkunci (Vaults) */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              CADANGAN TERKUNCI (VAULTS)
            </span>
            <Button
              type="button"
              size="sm"
              variant="flat"
              onPress={onOpenSimulateModal}
              startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[32px] rounded-lg text-xs"
            >
              Simulasi Belanja
            </Button>
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-200 tabular-nums">
              Rp {(summary?.vault_locked_cash ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Dana komitmen & tabungan aman dari belanja harian
          </p>
        </div>
      </div>

      {/* Bento Telemetry Row (12-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Col 7: 7-Day Spending Chart */}
        <div className="lg:col-span-7 w-full">
          <ExpenseCharts refreshTrigger={refreshTrigger} />
        </div>

        {/* Col 5: Upcoming Bills Card */}
        <div className="lg:col-span-5 w-full space-y-6">
          <UpcomingBillsCard bills={summary?.upcoming_bills} isLoading={isLoading} />
          <RunwayMetricCard summary={summary} />
        </div>
      </div>

      {/* Mini-Vaults Section */}
      <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Komitmen & Vaults Prioritas</h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="light"
            onPress={onNavigateToVaults}
            endContent={<ArrowRight className="w-3.5 h-3.5" />}
            className="text-xs text-zinc-400 hover:text-white bg-transparent p-1"
          >
            Lihat Semua Vault
          </Button>
        </div>

        {vaults.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            Belum ada pos komitmen atau vault aktif.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vaults.slice(0, 3).map((vault) => {
              const pct = vault.target_amount > 0
                ? Math.min(100, Math.round((vault.allocated_amount / vault.target_amount) * 100))
                : 100;
              return (
                <div
                  key={vault.id}
                  className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                      {vault.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {vault.is_locked ? (
                        <Lock className="w-3 h-3 text-zinc-400" />
                      ) : (
                        <Unlock className="w-3 h-3 text-zinc-500" />
                      )}
                      <span className="text-[10px] font-mono text-zinc-400">{pct}%</span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden my-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="h-full bg-emerald-400 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Rp {vault.allocated_amount.toLocaleString('id-ID')}</span>
                    <span className="text-zinc-500">/ Rp {vault.target_amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
