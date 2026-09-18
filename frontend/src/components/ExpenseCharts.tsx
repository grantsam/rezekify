import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

export const ExpenseCharts: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');

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

      {period === 'daily' ? (
        <div className="space-y-4">
          <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-800 pb-2">
            {[
              { day: 'Sen', amount: 45000, safe: 70000 },
              { day: 'Sel', amount: 62000, safe: 70000 },
              { day: 'Rab', amount: 28000, safe: 70000 },
              { day: 'Kam', amount: 85000, safe: 70000 },
              { day: 'Jum', amount: 55000, safe: 70000 },
              { day: 'Sab', amount: 95000, safe: 70000 },
              { day: 'Min', amount: 35000, safe: 70000 },
            ].map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full bg-slate-800 rounded-t-lg h-32 relative flex items-end overflow-hidden">
                  <div
                    className={`w-full transition-all rounded-t-md ${
                      d.amount > d.safe ? 'bg-rose-500/80' : 'bg-indigo-500/80'
                    }`}
                    style={{ height: `${Math.min(100, (d.amount / 100000) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Sesuai Jatah</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-2">
          {[
            { cat: 'Makanan & Minuman', amount: 450000, pct: 45, color: 'bg-indigo-500' },
            { cat: 'Transportasi', amount: 200000, pct: 20, color: 'bg-sky-500' },
            { cat: 'Kebutuhan Kos', amount: 250000, pct: 25, color: 'bg-emerald-500' },
            { cat: 'Hiburan', amount: 100000, pct: 10, color: 'bg-amber-500' },
          ].map((item) => (
            <div key={item.cat} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.cat}</span>
                <span className="text-slate-400 tabular-nums">Rp {item.amount.toLocaleString('id-ID')} ({item.pct}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
