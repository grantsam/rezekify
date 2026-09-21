import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Calculator, TrendingDown } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export interface SimulatePurchaseResponse {
  current_daily_runway: number;
  projected_daily_runway: number;
  daily_drop_amount: number;
  is_safe: boolean;
  advice: string;
}

export interface SimulatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimulatePurchaseModal: React.FC<SimulatePurchaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [plannedAmount, setPlannedAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SimulatePurchaseResponse | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setPlannedAmount('');
    setErrorMsg(null);
    setResult(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(plannedAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Nominal belanja harus lebih besar dari 0');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await apiFetch<SimulatePurchaseResponse>('/dashboard/simulate-purchase', {
        method: 'POST',
        body: JSON.stringify({ planned_amount: parsedAmount }),
      });
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mensimulasikan pembelian.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulate-modal-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 id="simulate-modal-title" className="font-semibold text-lg text-slate-100">Simulasi Rencana Belanja</h3>
              <p className="text-xs text-slate-400">What-If Purchase & Runway Impact Simulator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup modal"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSimulate} noValidate className="space-y-4 mt-4">
          <div>
            <label htmlFor="planned-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
              Nominal Rencana Belanja (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
                Rp
              </span>
              <input
                id="planned-amount"
                type="number"
                min="1"
                step="any"
                required
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
                placeholder="Contoh: 500000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mensimulasikan Dampak...</span>
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>Hitung Dampak Belanja</span>
              </>
            )}
          </button>
        </form>

        {/* Simulation Results Card */}
        {result && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Hasil Proyeksi Runway
            </h4>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Current Runway */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Jatah Saat Ini</span>
                <p className="text-sm font-bold text-slate-200 tabular-nums">
                  Rp {result.current_daily_runway.toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-500">/ hari</span>
              </div>

              {/* Projected Runway */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Proyeksi Setelah Belanja</span>
                <p
                  className={`text-sm font-bold tabular-nums ${
                    result.is_safe ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  Rp {result.projected_daily_runway.toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-500">/ hari</span>
              </div>

              {/* Drop Amount */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block mb-1">Penurunan Jatah Harian</span>
                <p className="text-sm font-bold text-amber-400 tabular-nums">
                  -Rp {result.daily_drop_amount.toLocaleString('id-ID')}/hari
                </p>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <TrendingDown className="w-3 h-3 text-amber-400" /> berkurang
                </span>
              </div>
            </div>

            {/* AI Advice Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                result.is_safe
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              {result.is_safe ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <p className="font-semibold mb-1">
                  {result.is_safe ? 'Kalkulasi Aman' : 'Peringatan Risiko Pengeluaran'}
                </p>
                <p className="text-slate-300">{result.advice}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
