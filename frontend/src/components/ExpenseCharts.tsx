import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody } from '@heroui/react';
import { BarChart3, AlertCircle, CheckCircle2, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';
import { SpendingBreakdownResponse, DailySpendingResponse, MonthlySpendingResponse } from '../types/api';

interface Props {
  refreshTrigger?: number;
}

export const PALETTE = ['#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6'];
export const CIRCUMFERENCE = 2 * Math.PI * 60; // radius 60 ≈ 376.991

export function resolveCategoryColor(color: string | null | undefined, index: number): string {
  if (!color || color.toLowerCase() === '#64748b') {
    return PALETTE[index % PALETTE.length];
  }
  return color;
}

function formatCompactRupiah(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${Math.round(amount / 1_000)}rb`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export const ExpenseCharts: React.FC<Props> = ({ refreshTrigger = 0 }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // ponytail: url period toggle; upgrade to custom date ranges if datepicker filter is added.
  const period: 'daily' | 'monthly' = searchParams.get('period') === 'monthly' ? 'monthly' : 'daily';

  const handlePeriodChange = (newPeriod: 'daily' | 'monthly') => {
    if (newPeriod === period) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPeriod === 'monthly') {
        next.set('period', 'monthly');
      } else {
        next.delete('period');
      }
      return next;
    }, { replace: true });
  };

  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null);

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
  // Coordinate space: viewBox="0 0 560 160", y bounds 20 to 140 (height 120)
  const yThreshold = Math.max(20, Math.min(140, 140 - (threshold / maxDailyAmount) * 120));

  const hasExpenses = period === 'daily'
    ? dailyData?.items.some((i) => i.amount > 0)
    : (monthlyData?.items && monthlyData.items.length > 0);

  // ponytail: fixed 7-point cubic bezier curve; upgrade to d3-shape if points become dynamic or exceed 30.
  const { curvePath, areaPath, points } = useMemo(() => {
    if (!dailyData || dailyData.items.length === 0) {
      return { curvePath: '', areaPath: '', points: [] };
    }
    const count = dailyData.items.length;
    const startX = 60;
    const endX = 540;
    const stepX = count > 1 ? (endX - startX) / (count - 1) : 0;

    const pts = dailyData.items.map((item, idx) => {
      const x = count > 1 ? startX + idx * stepX : (startX + endX) / 2;
      const y = 140 - (Math.max(0, item.amount) / maxDailyAmount) * 120;
      return {
        x: Number.isFinite(x) ? x : startX,
        y: Number.isFinite(y) ? y : 140,
      };
    });

    if (pts.length === 1) {
      const p = pts[0];
      const cPath = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y}`;
      const aPath = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} 140 L ${p.x - 10} 140 Z`;
      return { curvePath: cPath, areaPath: aPath, points: pts };
    }

    let cPath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const dx = (curr.x - prev.x) / 2;
      cPath += ` C ${prev.x + dx} ${prev.y}, ${curr.x - dx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const aPath = `${cPath} L ${pts[pts.length - 1].x} 140 L ${pts[0].x} 140 Z`;
    return { curvePath: cPath, areaPath: aPath, points: pts };
  }, [dailyData, maxDailyAmount]);

  return (
    <Card
      data-testid="expense-charts-card"
      className="min-h-[380px] flex flex-col justify-between bg-white/85 dark:bg-[#141417] backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-lg shadow-black/5 text-slate-900 dark:text-white select-none text-left"
    >
      <CardBody className="p-5 sm:p-6 flex flex-col justify-between flex-1">
        <div>
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Analitik Pengeluaran Terarah</h3>
              </div>
              <div
                role="tablist"
                aria-label="Pilih rentang waktu analitik"
                className="flex bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-2xl text-xs border border-slate-200/80 dark:border-zinc-800/80 shrink-0 w-[240px]"
              >
                <Button
                  size="sm"
                  variant="light"
                  role="tab"
                  aria-selected={period === 'daily'}
                  onPress={() => handlePeriodChange('daily')}
                  className={`flex-1 min-h-[38px] px-2 py-1 rounded-xl font-extrabold transition-all text-xs ${
                    period === 'daily'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
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
                  onPress={() => handlePeriodChange('monthly')}
                  className={`flex-1 min-h-[38px] px-2 py-1 rounded-xl font-extrabold transition-all text-xs ${
                    period === 'monthly'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  Bulanan (Monthly)
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 min-h-[28px]">
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
                {period === 'daily'
                  ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
                  : 'Distribusi pengeluaran per kategori pada siklus berjalan'}
              </p>
              {period === 'daily' && threshold > 0 && (
                <div
                  data-testid="safe-runway-header-badge"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-mono font-extrabold shadow-xs select-none tabular-nums shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Batas Aman: Rp {threshold.toLocaleString('id-ID')}/hari</span>
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div
              data-testid="expense-charts-skeleton"
              aria-busy="true"
              className="h-56 flex flex-col justify-between animate-pulse"
            >
              <div className="h-40 flex items-end justify-between gap-2 sm:gap-3">
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
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-zinc-800/80 rounded-2xl">
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
            <div className="h-56 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-zinc-800/80 rounded-2xl">
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
              className="space-y-3 min-h-[224px] flex flex-col justify-between"
            >
              {/* Screen-reader accessible transcript */}
              <div className="sr-only">
                {dailyData.items.map((item) => {
                  const isOver = item.amount > item.safe_runway_threshold;
                  const diffOver = item.amount - item.safe_runway_threshold;
                  return (
                    <span key={item.date}>
                      {item.day_label}, {item.date}: Rp {item.amount.toLocaleString('id-ID')}{' '}
                      {isOver ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})` : 'Sesuai Jatah'}
                    </span>
                  );
                })}
              </div>

              {/* Chart SVG Canvas */}
              <div className="relative w-full overflow-hidden">
                {/* Safe Runway Threshold Baseline */}
                {threshold > 0 && (
                  <div
                    data-testid="safe-runway-baseline-divider"
                    aria-hidden="true"
                    className="absolute left-[60px] right-[20px] pointer-events-none z-10 border-t-2 border-dashed border-amber-500/50"
                    style={{ top: `${(yThreshold / 160) * 100}%` }}
                  />
                )}

                <svg
                  viewBox="0 0 560 160"
                  className="w-full h-40 overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="dailyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* 3 Horizontal Y-axis Gridlines */}
                  <line x1="60" y1="140" x2="540" y2="140" stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-zinc-800" strokeWidth="1" />
                  <line x1="60" y1="80" x2="540" y2="80" stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-zinc-800" strokeWidth="1" />
                  <line x1="60" y1="20" x2="540" y2="20" stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-zinc-800" strokeWidth="1" />

                  {/* Y-axis Ticks */}
                  <text x="52" y="140" textAnchor="end" dominantBaseline="middle" className="text-[10px] font-mono fill-slate-400 dark:fill-zinc-500 font-semibold select-none">
                    Rp 0
                  </text>
                  <text x="52" y="80" textAnchor="end" dominantBaseline="middle" className="text-[10px] font-mono fill-slate-400 dark:fill-zinc-500 font-semibold select-none">
                    Rp {Math.round(maxDailyAmount / 2).toLocaleString('id-ID')}
                  </text>
                  <text x="52" y="20" textAnchor="end" dominantBaseline="middle" className="text-[10px] font-mono fill-slate-400 dark:fill-zinc-500 font-semibold select-none">
                    Rp {Math.round(maxDailyAmount).toLocaleString('id-ID')}
                  </text>

                  {/* Curved Area Wave */}
                  {areaPath && <path d={areaPath} fill="url(#dailyAreaGradient)" />}

                  {/* Smooth Emerald Curve Stroke */}
                  {curvePath && (
                    <path
                      d={curvePath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Points and Hover Hitboxes */}
                  {points.map((pt, idx) => {
                    const item = dailyData.items[idx];
                    const isOver = item.amount > item.safe_runway_threshold;
                    const isHovered = hoveredDayIndex === idx;

                    return (
                      <g key={item.date}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.5 : 3.5}
                          fill={isOver ? '#F43F5E' : '#10B981'}
                          stroke="#FFFFFF"
                          strokeWidth={isHovered ? 2 : 1.5}
                          className="transition-all duration-200"
                        />
                        <circle
                          data-testid={`chart-node-${idx}`}
                          cx={pt.x}
                          cy={pt.y}
                          r={24}
                          fill="transparent"
                          className="cursor-pointer focus:outline-none"
                          tabIndex={0}
                          aria-label={`${item.day_label}, ${item.date}: Rp ${item.amount.toLocaleString('id-ID')} (${isOver ? 'Melebihi Jatah' : 'Sesuai Jatah'})`}
                          onMouseEnter={() => setHoveredDayIndex(idx)}
                          onMouseLeave={() => setHoveredDayIndex(null)}
                          onFocus={() => setHoveredDayIndex(idx)}
                          onBlur={() => setHoveredDayIndex(null)}
                        />
                      </g>
                    );
                  })}

                  {/* Illuminated Beacon Dot */}
                  {hoveredDayIndex !== null && points[hoveredDayIndex] && (() => {
                    const pt = points[hoveredDayIndex];
                    const item = dailyData.items[hoveredDayIndex];
                    const isOver = item.amount > item.safe_runway_threshold;
                    return (
                      <g data-testid="living-chart-beacon" pointerEvents="none">
                        <line x1={pt.x} y1="20" x2={pt.x} y2="140" stroke="currentColor" strokeDasharray="3 3" className="text-emerald-500/40" strokeWidth="1" />
                        <circle cx={pt.x} cy={pt.y} r={14} className="animate-ping fill-emerald-400/30" />
                        <circle cx={pt.x} cy={pt.y} r={9} fill={isOver ? '#F43F5E' : '#10B981'} fillOpacity={0.25} />
                        <circle cx={pt.x} cy={pt.y} r={5} fill={isOver ? '#F43F5E' : '#10B981'} stroke="#FFFFFF" strokeWidth={2} />
                      </g>
                    );
                  })()}
                </svg>

                {/* Floating Interactive Tooltip */}
                {hoveredDayIndex !== null && points[hoveredDayIndex] && (() => {
                  const pt = points[hoveredDayIndex];
                  const item = dailyData.items[hoveredDayIndex];
                  const isOver = item.amount > item.safe_runway_threshold;
                  const diffOver = item.amount - item.safe_runway_threshold;
                  const leftPct = (pt.x / 560) * 100;

                  return (
                    <div
                      className="absolute z-20 pointer-events-none -translate-x-1/2 bg-slate-900/95 dark:bg-[#141417]/95 border border-slate-700 dark:border-zinc-800/80 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-xl text-center min-w-[140px] transition-all duration-150"
                      style={{
                        left: `${leftPct}%`,
                        top: pt.y > 60 ? `${(pt.y / 160) * 100 - 45}%` : `${(pt.y / 160) * 100 + 15}%`,
                      }}
                    >
                      <p className="text-[11px] font-bold text-slate-400">
                        {item.day_label} · {item.date}
                      </p>
                      <p className="text-xs font-extrabold text-white tabular-nums font-mono my-0.5">
                        Rp {item.amount.toLocaleString('id-ID')}
                      </p>
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-0.5 tabular-nums ${
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
                  );
                })()}
              </div>

              {/* Day Labels Row */}
              <div className="flex justify-between pl-14 pr-4 pt-2 border-b border-slate-200/80 dark:border-zinc-800/80 pb-2">
                {dailyData.items.map((item, idx) => (
                  <div
                    key={item.date}
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    className={`text-center text-[11px] font-bold cursor-pointer transition-colors ${
                      hoveredDayIndex === idx
                        ? 'text-emerald-500 font-extrabold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.day_label}
                  </div>
                ))}
              </div>
            </div>
          ) : period === 'monthly' && monthlyData ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2 flex-1 min-h-[224px]">
              {/* Left Column: Segmented SVG Donut Ring */}
              <div className="md:col-span-5 flex items-center justify-center relative">
                <svg viewBox="0 0 160 160" className="w-40 h-40">
                  {/* Background Track Circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-zinc-800/60"
                  />

                  {/* Category Arcs */}
                  {(() => {
                    let accumulatedOffset = 0;
                    const totalSpent = monthlyData.total_spent || monthlyData.items.reduce((acc, i) => acc + i.amount, 0) || 1;

                    return monthlyData.items.map((item, idx) => {
                      const itemPct = item.amount > 0 ? (item.amount / totalSpent) * 100 : item.percentage;
                      const arcLength = (itemPct / 100) * CIRCUMFERENCE;
                      const offset = accumulatedOffset;
                      accumulatedOffset += arcLength;
                      const isHovered = hoveredCategoryIndex === idx;

                      if (arcLength <= 0) return null;

                      return (
                        <circle
                          key={item.category_id || item.category_name}
                          cx="80"
                          cy="80"
                          r="60"
                          fill="transparent"
                          stroke={resolveCategoryColor(item.color, idx)}
                          strokeWidth={isHovered ? 18 : 14}
                          strokeDasharray={`${arcLength} ${CIRCUMFERENCE}`}
                          strokeDashoffset={-offset}
                          transform="rotate(-90 80 80)"
                          className="transition-all duration-300 ease-out cursor-pointer"
                          onMouseEnter={() => setHoveredCategoryIndex(idx)}
                          onMouseLeave={() => setHoveredCategoryIndex(null)}
                        />
                      );
                    });
                  })()}

                  {/* Donut Center Display */}
                  <text x="80" y="74" textAnchor="middle" className="text-[11px] font-bold fill-slate-500 dark:fill-zinc-400 select-none">
                    Total
                  </text>
                  <text x="80" y="94" textAnchor="middle" className="text-sm font-extrabold font-mono fill-slate-900 dark:fill-white tabular-nums select-none">
                    {formatCompactRupiah(monthlyData.total_spent)}
                  </text>
                </svg>
              </div>

              {/* Right Column: Category Breakdown List */}
              <div className="md:col-span-7 flex flex-col justify-center space-y-2.5">
                {monthlyData.items.map((item, idx) => {
                  const isHovered = hoveredCategoryIndex === idx;
                  const itemColor = resolveCategoryColor(item.color, idx);
                  const hasBudget = Boolean(item.budget_limit && item.budget_limit > 0);
                  const diff = hasBudget && item.budget_limit ? item.budget_limit - item.amount : 0;
                  const status =
                    item.budget_status ||
                    (diff < 0
                      ? 'OVER_BUDGET'
                      : item.budget_limit && item.amount >= item.budget_limit * 0.8
                      ? 'WARNING'
                      : 'HEALTHY');

                  const budgetFillColor =
                    status === 'OVER_BUDGET'
                      ? 'bg-rose-500'
                      : status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <div
                      key={item.category_id || item.category_name}
                      onMouseEnter={() => setHoveredCategoryIndex(idx)}
                      onMouseLeave={() => setHoveredCategoryIndex(null)}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-100/90 dark:bg-zinc-800/80 shadow-xs'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: itemColor }}
                          />
                          <span className="text-slate-800 dark:text-slate-200 font-extrabold truncate">
                            {item.category_name}
                          </span>
                          {hasBudget ? (
                            status === 'OVER_BUDGET' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <TrendingUp className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Lewat {formatRupiah(Math.abs(diff))}</span>
                              </span>
                            ) : status === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Sisa {formatRupiah(diff)}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>Sisa {formatRupiah(diff)}</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/60">
                              <Target className="w-3 h-3 shrink-0" />
                              <span>Tanpa limit</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums shrink-0 ml-2">
                          <span className="text-slate-500 dark:text-zinc-400 font-bold text-[11px]">
                            {item.percentage}%
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-extrabold">
                            Rp {item.amount.toLocaleString('id-ID')}
                            {hasBudget && item.budget_limit && (
                              <span className="text-slate-400 dark:text-zinc-500 font-normal">
                                {' '}/ Rp {item.budget_limit.toLocaleString('id-ID')}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      {hasBudget ? (
                        <div
                          role="progressbar"
                          aria-label={`${item.category_name} budget: ${Math.round(item.budget_spent_pct || 0)}%`}
                          aria-valuenow={Math.min(100, item.budget_spent_pct || 0)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1.5"
                        >
                          <div
                            data-testid={`budget-progress-fill-${item.category_id || item.category_name}`}
                            className={`h-full rounded-full transition-all duration-300 ${budgetFillColor}`}
                            style={{
                              width: `${Math.min(100, item.budget_spent_pct || 0)}%`,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          role="progressbar"
                          aria-label={`${item.category_name}: ${item.percentage}%`}
                          aria-valuenow={item.percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="w-full h-1.5 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: itemColor,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Legend / Status Footer Row */}
        {period === 'daily' && dailyData && hasExpenses ? (
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-bold px-2 pt-3 min-h-[32px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sesuai Jatah
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah
            </span>
          </div>
        ) : period === 'monthly' && monthlyData && hasExpenses ? (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-2 pt-3 min-h-[32px]">
            <span>{monthlyData.items.length} Kategori Pengeluaran Terdata</span>
            <span>Distribusi Siklus Berjalan</span>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
};
