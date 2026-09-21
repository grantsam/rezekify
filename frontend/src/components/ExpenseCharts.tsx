import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Progress } from '@heroui/react';
import { BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '../services/apiClient';
import { SpendingBreakdownResponse, DailySpendingResponse, MonthlySpendingResponse } from '../types/api';

interface Props {
  refreshTrigger?: number;
}

export const ExpenseCharts: React.FC<Props> = ({ refreshTrigger = 0 }) => {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch<SpendingBreakdownResponse>(`/analytics/spending-breakdown?period=${period}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat analitik.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, refreshTrigger]);

  const dailyData = data?.period === 'daily' ? (data as DailySpendingResponse) : null;
  const monthlyData = data?.period === 'monthly' ? (data as MonthlySpendingResponse) : null;

  const maxDailyAmount = dailyData?.items.reduce(
    (max, item) => Math.max(max, item.amount, item.safe_runway_threshold, dailyData.daily_safe_runway || 0),
    1
  ) || 1;

  const threshold = dailyData?.daily_safe_runway || 0;
  const thresholdPct = Math.min(100, Math.max(0, (threshold / maxDailyAmount) * 100));

  const hasExpenses = period === 'daily'
    ? dailyData?.items.some((i) => i.amount > 0)
    : (monthlyData?.items && monthlyData.items.length > 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-base">Analitik Pengeluaran Terarah</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {period === 'daily'
              ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
              : 'Distribusi pengeluaran per kategori pada siklus berjalan'}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Pilih rentang waktu analitik"
          className="flex bg-slate-800/90 p-1 rounded-xl text-xs self-start sm:self-auto border border-slate-700/60"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'daily'}
            onClick={() => setPeriod('daily')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg transition-all ${
              period === 'daily'
                ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Harian (Daily)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'monthly'}
            onClick={() => setPeriod('monthly')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg transition-all ${
              period === 'monthly'
                ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bulanan (Monthly)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-44 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs">Memuat analitik...</span>
        </div>
      ) : error ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl">
          <AlertCircle className="w-6 h-6 text-indigo-400 mb-2" />
          <p className="font-semibold text-xs text-slate-300">
            {error.toLowerCase().includes('authenticated') ? 'Perlu Autentikasi' : 'Gagal Memuat Analitik'}
          </p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-1">
            {error.toLowerCase().includes('authenticated')
              ? 'Silakan masuk atau daftarkan akun Anda untuk memuat grafik analitik pengeluaran harian dan bulanan.'
              : error}
          </p>
        </div>
      ) : !hasExpenses ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl">
          <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
          <p className="font-semibold text-xs text-slate-300">Belum Ada Pengeluaran Tercatat</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            Unggah struk atau ketik transaksi pada Omni-Input di atas untuk melihat analitik langsung.
          </p>
        </div>
      ) : period === 'daily' && dailyData ? (
        <div
          role="region"
          aria-label="Grafik pengeluaran 7 hari terakhir vs ambang batas aman runway"
          className="space-y-4"
        >
          <div className="h-36 relative flex items-end justify-between gap-2 sm:gap-3">
            {/* Safe Runway Threshold Baseline */}
            <div
              className="absolute inset-x-0 pointer-events-none z-10 border-t border-dashed border-amber-400/70 flex items-center justify-end"
              style={{ bottom: `${thresholdPct}%` }}
            >
              <span className="text-[10px] font-medium tracking-tight text-amber-300 bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-sm -translate-y-1/2 select-none">
                Batas Aman: Rp {threshold.toLocaleString('id-ID')}
              </span>
            </div>

            {dailyData.items.map((item, idx) => {
              const heightPct = item.amount > 0 ? Math.min(100, Math.max(6, (item.amount / maxDailyAmount) * 100)) : 0;
              const isOver = item.amount > item.safe_runway_threshold;
              const diffOver = item.amount - item.safe_runway_threshold;
              return (
                <Tooltip
                  key={item.date}
                  placement="top"
                  delay={0}
                  closeDelay={0}
                  content={
                    <div className="p-1.5 flex flex-col items-center">
                      <p className="text-[11px] font-medium text-slate-400">
                        {item.day_label} · {item.date}
                      </p>
                      <p className="text-xs font-bold text-white tabular-nums my-0.5">
                        Rp {item.amount.toLocaleString('id-ID')}
                      </p>
                      <span
                        className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                          isOver
                            ? 'text-rose-400 bg-rose-950/70 border border-rose-800/60'
                            : 'text-emerald-400 bg-emerald-950/70 border border-emerald-800/60'
                        }`}
                      >
                        {isOver
                          ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})`
                          : 'Sesuai Jatah'}
                      </span>
                    </div>
                  }
                  className="bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl"
                >
                  <div
                    tabIndex={0}
                    aria-label={`${item.day_label}, ${item.date}: Rp ${item.amount.toLocaleString('id-ID')} (${isOver ? 'Melebihi Jatah' : 'Sesuai Jatah'})`}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded-t-lg"
                  >
                    {/* Screen-reader and testing fallback for status badge */}
                    <span className="sr-only">
                      {isOver
                        ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})`
                        : 'Sesuai Jatah'}
                    </span>

                    {/* Bar track */}
                    <div className="w-full bg-slate-800/70 rounded-t-lg h-full relative flex items-end overflow-hidden">
                      <motion.div
                        style={{ originY: 1, height: '100%' }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: heightPct / 100 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 20, delay: idx * 0.04 }}
                        className={`w-full rounded-t-md transition-colors ${
                          isOver ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>

          {/* Day Labels Row */}
          <div className="flex justify-between gap-2 sm:gap-3 pt-2 border-b border-slate-800 pb-2">
            {dailyData.items.map((item) => (
              <div key={item.date} className="flex-1 text-center text-[11px] text-slate-400">
                {item.day_label}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sesuai Jatah
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah
            </span>
          </div>
        </div>
      ) : period === 'monthly' && monthlyData ? (
        <div className="space-y-3 py-2">
          {monthlyData.items.map((item) => (
            <div key={item.category_id || item.category_name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.category_name}</span>
                <span className="text-slate-400 tabular-nums">
                  Rp {item.amount.toLocaleString('id-ID')} ({item.percentage}%)
                </span>
              </div>
              <Progress
                value={item.percentage}
                color="primary"
                size="sm"
                radius="full"
                aria-label={`${item.category_name}: ${item.percentage}%`}
                className="w-full"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
