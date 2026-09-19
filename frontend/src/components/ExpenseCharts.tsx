import React, { useState, useEffect, useCallback } from 'react';
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
    (max, item) => Math.max(max, item.amount, item.safe_runway_threshold),
    1
  ) || 1;

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
        <div className="flex bg-slate-800/90 p-1 rounded-xl text-xs self-start sm:self-auto border border-slate-700/60">
          <button
            type="button"
            onClick={() => setPeriod('daily')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              period === 'daily'
                ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Harian (Daily)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
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
          <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
            Unggah struk atau ketik transaksi pada Omni-Input di atas untuk melihat analitik langsung.
          </p>
        </div>
      ) : period === 'daily' && dailyData ? (
        <div className="space-y-4">
          <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-800 pb-2 relative">
            {dailyData.items.map((item, idx) => {
              const heightPct = item.amount > 0 ? Math.max(8, (item.amount / maxDailyAmount) * 100) : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="w-full bg-slate-800/80 rounded-t-lg h-32 relative flex items-end overflow-hidden">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 20, delay: idx * 0.04 }}
                      className={`w-full rounded-t-md transition-colors ${
                        item.is_over_budget ? 'bg-rose-500' : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">{item.day_label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Sesuai Jatah
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah
            </span>
          </div>
        </div>
      ) : period === 'monthly' && monthlyData ? (
        <div className="space-y-3 py-2">
          {monthlyData.items.map((item, idx) => (
            <div key={item.category_id || item.category_name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.category_name}</span>
                <span className="text-slate-400 tabular-nums">
                  Rp {item.amount.toLocaleString('id-ID')} ({item.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22, delay: idx * 0.05 }}
                  style={{ backgroundColor: item.color || '#6366f1' }}
                  className="h-full rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
