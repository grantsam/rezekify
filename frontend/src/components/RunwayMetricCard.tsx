import React from 'react';
import { Chip, Progress, Card, CardBody, Button } from '@heroui/react';
import { Gauge, ShieldCheck, AlertCircle, AlertTriangle, Lock, Wallet } from 'lucide-react';
import { DashboardSummaryResponse } from '../types/api';

interface Props {
  summary: DashboardSummaryResponse | null;
  onOpenAuth?: () => void;
}

export const RunwayMetricCard: React.FC<Props> = ({ summary, onOpenAuth }) => {
  if (!summary) {
    if (onOpenAuth) {
      return (
        <Card className="bg-white/80 dark:bg-[#042421]/90 backdrop-blur-2xl border-2 border-[#10B981]/30 rounded-[28px] shadow-xl shadow-[#10B981]/5 select-none text-left">
          <CardBody className="p-5 md:p-6 text-slate-900 dark:text-white flex flex-col justify-between min-h-[260px]">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]">
                  <Gauge className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Batas Belanja Harian (Runway)</h2>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
                Akses Telemetri Keuangan
              </p>
              <p className="text-xs text-slate-600 dark:text-emerald-200/80 font-medium mt-2 leading-relaxed max-w-md">
                Masuk atau daftarkan akun Anda untuk mengaktifkan telemetri batas belanja harian bebas risiko dan pemantauan kas.
              </p>
            </div>
            <Button
              onPress={onOpenAuth}
              className="mt-6 bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white text-xs sm:text-sm font-extrabold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#10B981]/25 w-fit active:scale-95 min-h-[40px]"
            >
              Masuk / Buat Akun
            </Button>
          </CardBody>
        </Card>
      );
    }

    return (
      <Card
        data-testid="runway-skeleton"
        aria-busy="true"
        className="bg-white/80 dark:bg-[#042421]/90 border-2 border-[#10B981]/30 rounded-[28px] shadow-xl shadow-[#10B981]/5 animate-pulse select-none"
      >
        <CardBody className="p-5 md:p-6 text-slate-900 dark:text-white flex flex-col justify-between min-h-[260px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
                <div className="h-4 w-48 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
              </div>
              <div className="h-6 w-32 bg-slate-200 dark:bg-[#021D17] rounded-full" />
            </div>

            <div className="my-4 space-y-2">
              <div className="h-10 sm:h-12 w-64 bg-slate-200 dark:bg-[#021D17] rounded-2xl" />
              <div className="h-3 w-80 bg-slate-100 dark:bg-[#021D17]/60 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-5 border-t border-slate-200/80 dark:border-white/10 mt-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
              <div className="h-6 w-36 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
            </div>
            <div className="space-y-1.5 border-l border-slate-200/80 dark:border-white/10 pl-6">
              <div className="h-3 w-32 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
              <div className="h-6 w-36 bg-slate-200 dark:bg-[#021D17] rounded-xl" />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const statusConfig = {
    HEALTHY: {
      color: 'success' as const,
      label: 'Aman Terkendali',
      icon: ShieldCheck,
      glowStyle: 'border-2 border-emerald-500/30 shadow-xl shadow-emerald-500/10',
    },
    WARNING: {
      color: 'warning' as const,
      label: 'Mode Waspada',
      icon: AlertTriangle,
      glowStyle: 'border-2 border-amber-500/30 shadow-xl shadow-amber-500/10',
    },
    CRITICAL: {
      color: 'danger' as const,
      label: 'Mode Hemat Ketat',
      icon: AlertCircle,
      glowStyle: 'border-2 border-rose-500/30 shadow-xl shadow-rose-500/10',
    },
  }[summary.health_status];

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`bg-white/80 dark:bg-[#042421]/90 backdrop-blur-2xl ${statusConfig.glowStyle} rounded-[28px] relative overflow-hidden transition-all duration-300 select-none text-left`}>
      <CardBody className="p-5 md:p-6 text-slate-900 dark:text-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] shadow-xs">
                <Gauge className="w-5 h-5" />
              </div>
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Batas Belanja Harian (Runway)</h2>
            </div>
            <Chip
              color={statusConfig.color}
              variant="flat"
              size="sm"
              startContent={<StatusIcon className="w-3.5 h-3.5" />}
              className="font-extrabold text-xs"
            >
              {statusConfig.label}
            </Chip>
          </div>

          {/* Big Safe Runway Metric */}
          <div className="my-3">
            <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums font-mono text-slate-900 dark:text-white">
              Rp {summary.daily_safe_runway.toLocaleString('id-ID')}
              <span className="text-base sm:text-lg md:text-xl font-bold text-slate-500 dark:text-slate-400 ml-1.5 font-sans">/ hari</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-emerald-200/80 font-medium mt-2">
              Jatah belanja bebas risiko untuk <strong className="font-extrabold text-slate-900 dark:text-white">{summary.days_remaining} hari ke depan</strong> hingga siklus inflow berikutnya.
            </p>
            <Progress
              size="sm"
              radius="full"
              value={summary.days_remaining ? Math.min(100, Math.max(0, (summary.days_remaining / 30) * 100)) : 0}
              color={statusConfig.color}
              aria-label="Progres Hari Runway"
              className="mt-3 opacity-90"
            />
          </div>
        </div>

        {/* Typographic stat columns with subtle dividers */}
        <div className="grid grid-cols-2 gap-6 pt-5 border-t border-slate-200/80 dark:border-white/10 mt-4">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-bold">
              <Wallet className="w-3.5 h-3.5 text-[#10B981]" /> Kas Bebas Pakai
            </span>
            <p className="text-base sm:text-lg font-extrabold tabular-nums font-mono text-[#0F766E] dark:text-[#10B981]">
              Rp {summary.operational_free_cash.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="border-l border-slate-200/80 dark:border-white/10 pl-6">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-bold">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Cadangan Terkunci
            </span>
            <p className="text-base sm:text-lg font-extrabold tabular-nums font-mono text-amber-600 dark:text-amber-400">
              Rp {summary.vault_locked_cash.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};