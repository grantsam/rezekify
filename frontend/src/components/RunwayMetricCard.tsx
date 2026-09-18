import React from 'react';
import { Gauge, ShieldCheck, AlertCircle, AlertTriangle, Lock, Wallet } from 'lucide-react';
import { DashboardSummaryResponse } from '../types/api';

interface Props {
  summary: DashboardSummaryResponse | null;
}

export const RunwayMetricCard: React.FC<Props> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-white animate-pulse h-64" />
    );
  }

  const statusColor = {
    HEALTHY: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      glow: 'shadow-glow-emerald',
      label: 'Keuangan Sehat (Safe)',
      icon: ShieldCheck,
    },
    WARNING: {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      glow: 'shadow-glow-amber',
      label: 'Waspada (Menipis)',
      icon: AlertTriangle,
    },
    CRITICAL: {
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      glow: 'shadow-glow-rose',
      label: 'Kritis (Insolvent)',
      icon: AlertCircle,
    },
  }[summary.health_status];

  const StatusIcon = statusColor.icon;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
              Dynamic Daily Safe Runway
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusColor.badge}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {statusColor.label}
          </span>
        </div>

        {/* Big Safe Runway Metric */}
        <div className="my-3">
          <p className="text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums text-white">
            Rp {summary.daily_safe_runway.toLocaleString('id-ID')}
            <span className="text-lg md:text-xl font-normal text-slate-400 ml-1.5">/ hari</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Jatah belanja bebas risiko untuk <strong>{summary.days_remaining} hari ke depan</strong> hingga siklus inflow berikutnya.
          </p>
        </div>
      </div>

      {/* Bottom telemetry grid */}
      <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-800/80 mt-4">
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/50">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Wallet className="w-3.5 h-3.5 text-slate-400" /> Kas Operasional Bebas
          </span>
          <p className="text-base font-bold tabular-nums text-indigo-200">
            Rp {summary.operational_free_cash.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/50">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Brankas Terkunci
          </span>
          <p className="text-base font-bold tabular-nums text-amber-300">
            Rp {summary.vault_locked_cash.toLocaleString('id-ID')}
          </p>
        </div>
      </div>
    </div>
  );
};
