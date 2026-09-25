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
        <Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none">
          <CardBody className="p-5 md:p-6 text-white flex flex-col justify-between min-h-[260px]">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-sm text-zinc-300">Batas Belanja Harian (Runway)</h2>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white mt-3">
                Akses Telemetri Keuangan
              </p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-md">
                Masuk atau daftarkan akun Anda untuk mengaktifkan telemetri batas belanja harian bebas risiko dan pemantauan kas.
              </p>
            </div>
            <Button
              type="button"
              onPress={onOpenAuth}
              className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/30 w-fit active:scale-95 min-h-[40px]"
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
        className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none animate-pulse"
      >
        <CardBody className="p-5 md:p-6 text-white flex flex-col justify-between min-h-[260px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-zinc-800 rounded-md" />
                <div className="h-4 w-48 bg-zinc-800 rounded" />
              </div>
              <div className="h-6 w-32 bg-zinc-800 rounded-full" />
            </div>

            <div className="my-4 space-y-2">
              <div className="h-10 sm:h-12 w-64 bg-zinc-800 rounded" />
              <div className="h-3 w-80 bg-zinc-800/80 rounded" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-5 border-t border-zinc-800/80 mt-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-zinc-800 rounded" />
              <div className="h-6 w-36 bg-zinc-800 rounded" />
            </div>
            <div className="space-y-1.5 border-l border-zinc-800/80 pl-6">
              <div className="h-3 w-32 bg-zinc-800 rounded" />
              <div className="h-6 w-36 bg-zinc-800 rounded" />
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
      glowStyle: 'border-emerald-500/30 shadow-lg shadow-emerald-500/10',
    },
    WARNING: {
      color: 'warning' as const,
      label: 'Mode Waspada',
      icon: AlertTriangle,
      glowStyle: 'border-amber-500/30 shadow-lg shadow-amber-500/10',
    },
    CRITICAL: {
      color: 'danger' as const,
      label: 'Mode Hemat Ketat',
      icon: AlertCircle,
      glowStyle: 'border-rose-500/30 shadow-lg shadow-rose-500/10',
    },
  }[summary.health_status];

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`bg-[#141417] border ${statusConfig.glowStyle} rounded-2xl relative overflow-hidden transition-all duration-300`}>
      <CardBody className="p-5 md:p-6 text-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-sm text-zinc-300">Batas Belanja Harian (Runway)</h2>
            </div>
            <Chip
              color={statusConfig.color}
              variant="flat"
              size="sm"
              startContent={<StatusIcon className="w-3.5 h-3.5" />}
              className="font-semibold text-xs"
            >
              {statusConfig.label}
            </Chip>
          </div>

          {/* Big Safe Runway Metric */}
          <div className="my-3">
            <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums font-mono text-white">
              Rp {summary.daily_safe_runway.toLocaleString('id-ID')}
              <span className="text-base sm:text-lg md:text-xl font-normal text-zinc-400 ml-1.5 font-sans">/ hari</span>
            </p>
            <p className="text-xs text-zinc-400 mt-2">
              Jatah belanja bebas risiko untuk <strong className="font-semibold text-zinc-200">{summary.days_remaining} hari ke depan</strong> hingga siklus inflow berikutnya.
            </p>
            <Progress
              size="sm"
              radius="full"
              value={summary.days_remaining ? Math.min(100, Math.max(0, (summary.days_remaining / 30) * 100)) : 0}
              color={statusConfig.color}
              aria-label="Progres Hari Runway"
              className="mt-3 opacity-80"
            />
          </div>
        </div>

        {/* Clean typographic stat columns with subtle dividers */}
        <div className="grid grid-cols-2 gap-6 pt-5 border-t border-zinc-800/80 mt-4">
          <div>
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1 font-medium">
              <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Kas Bebas Pakai
            </span>
            <p className="text-base sm:text-lg font-bold tabular-nums font-mono text-indigo-200">
              Rp {summary.operational_free_cash.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="border-l border-zinc-800/80 pl-6">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1 font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Cadangan Terkunci
            </span>
            <p className="text-base sm:text-lg font-bold tabular-nums font-mono text-amber-300">
              Rp {summary.vault_locked_cash.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
