import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Progress, Button, Card, CardBody } from '@heroui/react';
import { BarChart3, AlertCircle } from 'lucide-react';
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
    <Card className="bg-white/85 dark:bg-[#141417] backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-lg shadow-black/5 text-slate-900 dark:text-white select-none text-left">
      <CardBody className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Analitik Pengeluaran Terarah</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
              {period === 'daily'
                ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
                : 'Distribusi pengeluaran per kategori pada siklus berjalan'}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Pilih rentang waktu analitik"
            className="flex bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-2xl text-xs self-start sm:self-auto border border-slate-200/80 dark:border-zinc-800/80"
          >
            <Button
              size="sm"
              variant="light"
              role="tab"
              aria-selected={period === 'daily'}
              onPress={() => setPeriod('daily')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-extrabold transition-all ${
                period === 'daily'
                  ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
              }`}
            >
              Harian (Daily)
            </Button>
            <Button
              size="sm"
              variant="light"
              role="tab"
              aria-selected={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-extrabold transition-all ${
                period === 'monthly'
                  ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
              }`}
            >
              Bulanan (Monthly)
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div
            data-testid="expense-charts-skeleton"
            aria-busy="true"
            className="h-44 flex flex-col justify-between animate-pulse"
          >
            <div className="h-32 flex items-end justify-between gap-2 sm:gap-3">
              {[45, 65, 25, 90, 50, 20, 75].map((heightPct, idx) => (
                <div key={idx} className="flex-1 bg-slate-100 dark:bg-zinc-900 rounded-t-xl h-full flex items-end overflow-hidden">
                  <div
                    className="w-full bg-slate-200 dark:bg-zinc-800 rounded-t-lg"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2 sm:gap-3 pt-2 border-b border-slate-200/80 dark:border-zinc-800/80 pb-2">
              {[...Array(7)].map((_, idx) => (
                <div key={idx} className="flex-1 flex justify-center">
                  <div className="h-3 w-6 bg-slate-200 dark:bg-zinc-900 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-zinc-800/80 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
              {error.toLowerCase().includes('authenticated') ? 'Perlu Autentikasi' : 'Gagal Memuat Analitik'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-1 font-medium">
              {error.toLowerCase().includes('authenticated')
                ? 'Silakan masuk atau daftarkan akun Anda untuk memuat grafik analitik pengeluaran harian dan bulanan.'
                : error}
            </p>
          </div>
        ) : !hasExpenses ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-zinc-800/80 rounded-2xl">
            <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2 opacity-60" />
            <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Belum Ada Pengeluaran Tercatat</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5 font-medium">
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
                className="absolute inset-x-0 pointer-events-none z-10 border-t-2 border-dashed border-amber-500/80 flex items-center justify-end"
                style={{ bottom: `${thresholdPct}%` }}
              >
                <span className="text-[10px] font-extrabold tracking-tight text-amber-700 dark:text-amber-300 bg-white/90 dark:bg-[#141417]/90 backdrop-blur-md px-2 py-0.5 rounded-lg border border-amber-400/40 dark:border-amber-500/40 shadow-sm -translate-y-1/2 select-none tabular-nums font-mono">
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
                      <div className="p-2 flex flex-col items-center text-center">
                        <p className="text-[11px] font-bold text-slate-400">
                          {item.day_label} · {item.date}
                        </p>
                        <p className="text-xs font-extrabold text-white tabular-nums font-mono my-0.5">
                          Rp {item.amount.toLocaleString('id-ID')}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1 tabular-nums ${
                            isOver
                              ? 'text-rose-300 bg-rose-950/80 border border-rose-800/60'
                              : 'text-emerald-300 bg-emerald-950/80 border border-emerald-800/60'
                          }`}
                        >
                          {isOver
                            ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})`
                            : 'Sesuai Jatah'}
                        </span>
                      </div>
                    }
                    className="bg-slate-900/95 dark:bg-[#141417]/95 border border-slate-700 dark:border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl"
                  >
                    <div
                      tabIndex={0}
                      aria-label={`${item.day_label}, ${item.date}: Rp ${item.amount.toLocaleString('id-ID')} (${isOver ? 'Melebihi Jatah' : 'Sesuai Jatah'})`}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-t-xl"
                    >
                      <span className="sr-only">
                        {isOver
                          ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})`
                          : 'Sesuai Jatah'}
                      </span>

                      {/* Bar track */}
                      <div className="w-full bg-slate-100 dark:bg-zinc-900/60 rounded-t-xl h-full relative flex items-end overflow-hidden">
                        <motion.div
                          style={{ originY: 1, height: '100%' }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: heightPct / 100 }}
                          transition={{ duration: 0.25, ease: 'easeOut', delay: idx * 0.02 }}
                          className={`w-full rounded-t-lg transition-colors ${
                            isOver
                              ? 'bg-gradient-to-t from-rose-600 to-rose-500'
                              : 'bg-gradient-to-t from-[#0F766E] to-[#10B981]'
                          }`}
                        />
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>

            {/* Day Labels Row */}
            <div className="flex justify-between gap-2 sm:gap-3 pt-2 border-b border-slate-200/80 dark:border-zinc-800/80 pb-2">
              {dailyData.items.map((item) => (
                <div key={item.date} className="flex-1 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {item.day_label}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-bold px-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Sesuai Jatah
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah
              </span>
            </div>
          </div>
        ) : period === 'monthly' && monthlyData ? (
          <div className="space-y-3 py-2">
            {monthlyData.items.map((item) => (
              <div key={item.category_id || item.category_name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold">{item.category_name}</span>
                  <span className="text-slate-600 dark:text-slate-300 font-mono font-bold tabular-nums">
                    Rp {item.amount.toLocaleString('id-ID')} ({item.percentage}%)
                  </span>
                </div>
                <Progress
                  value={item.percentage}
                  color="success"
                  size="sm"
                  radius="full"
                  aria-label={`${item.category_name}: ${item.percentage}%`}
                  className="w-full"
                  classNames={{
                    indicator: 'bg-gradient-to-r from-[#0F766E] to-[#10B981]',
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
};