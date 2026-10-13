import React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { TelemetrySnapshot } from '../types/api';

export interface ChatTelemetryStripProps {
  telemetry: TelemetrySnapshot | null;
  onResetChat: () => Promise<void> | void;
  isResetting?: boolean;
  providerLabel?: string;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

const HEALTH_BADGE_STYLES: Record<string, string> = {
  HEALTHY: 'bg-emerald-500/15 text-[#0F766E] dark:text-[#10B981] border-[#10B981]/30',
  WARNING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  CRITICAL: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

export const ChatTelemetryStrip: React.FC<ChatTelemetryStripProps> = ({
  telemetry,
  onResetChat,
  isResetting = false,
  providerLabel,
}) => {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#042421]/90 border-b border-slate-200/80 dark:border-[#10B981]/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-left select-none shadow-xs">
      {telemetry ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          {/* Saldo Bebas */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-400">Saldo Bebas</span>
            <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">{formatCurrency(telemetry.operational_free_cash)}</span>
          </div>

          {/* Jatah Aman + Health Badge */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-400">Jatah Aman</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${
                  HEALTH_BADGE_STYLES[telemetry.health_status] || HEALTH_BADGE_STYLES.HEALTHY
                }`}
              >
                {telemetry.health_status}
              </span>
            </div>
            <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(telemetry.daily_safe_runway)} <span className="text-slate-400 dark:text-slate-400 font-medium font-sans">/ hari</span>
            </span>
          </div>

          {/* Sisa Siklus */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-400">Sisa Siklus</span>
            <span className="font-extrabold font-mono tabular-nums text-slate-700 dark:text-slate-200">{telemetry.days_remaining} hari tersisa</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
          <span>Memuat data telemetri...</span>
        </div>
      )}

      {/* Provider Label & Reset Chat Button */}
      <div className="flex items-center gap-2 ml-auto">
        {providerLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold tracking-wide bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981] border border-[#10B981]/30">
            {providerLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onResetChat}
          disabled={isResetting}
          aria-label="Bersihkan riwayat percakapan"
          title="Bersihkan riwayat percakapan"
          className="min-h-[36px] min-w-[36px] p-2 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all border border-slate-200/80 dark:border-white/10 disabled:opacity-50 disabled:pointer-events-none bg-transparent"
        >
          {isResetting ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};