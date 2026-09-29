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
  HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

// ponytail: single-strip inline telemetry display; upgrade to expandable telemetry popover if historical metrics are added.
export const ChatTelemetryStrip: React.FC<ChatTelemetryStripProps> = ({
  telemetry,
  onResetChat,
  isResetting = false,
  providerLabel,
}) => {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-[#0c0c0e]/90 border-b border-zinc-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {telemetry ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          {/* Saldo Bebas */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">Saldo Bebas</span>
            <span className="font-semibold font-mono tabular-nums text-zinc-100">{formatCurrency(telemetry.operational_free_cash)}</span>
          </div>

          {/* Jatah Aman + Health Badge */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">Jatah Aman</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  HEALTH_BADGE_STYLES[telemetry.health_status] || HEALTH_BADGE_STYLES.HEALTHY
                }`}
              >
                {telemetry.health_status}
              </span>
            </div>
            <span className="font-semibold font-mono tabular-nums text-zinc-100">
              {formatCurrency(telemetry.daily_safe_runway)} <span className="text-zinc-500 font-normal font-sans">/ hari</span>
            </span>
          </div>

          {/* Sisa Siklus */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-medium tracking-wider text-zinc-500">Sisa Siklus</span>
            <span className="font-semibold font-mono tabular-nums text-zinc-200">{telemetry.days_remaining} hari tersisa</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="w-2 h-2 rounded-full bg-indigo-500/60 animate-ping" />
          <span>Memuat data telemetri...</span>
        </div>
      )}

      {/* Provider Label & Reset Chat Button */}
      <div className="flex items-center gap-2 ml-auto">
        {providerLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {providerLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onResetChat}
          disabled={isResetting}
          aria-label="Bersihkan riwayat percakapan"
          title="Bersihkan riwayat percakapan"
          className="min-h-[38px] min-w-[38px] p-2 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 active:scale-95 transition-all border border-zinc-800 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isResetting ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
