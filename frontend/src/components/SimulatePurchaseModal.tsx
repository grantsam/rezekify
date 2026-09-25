import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Calculator, TrendingDown } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react';
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

  const dialogRef = React.useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', 'simulate-modal-title');
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== 'simulate-modal-title') {
        node.setAttribute('aria-labelledby', 'simulate-modal-title');
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, []);

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
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={handleClose}
      backdrop="blur"
      size="lg"
      classNames={{
        base: 'bg-[#141417] border border-zinc-800/80 text-zinc-100 max-h-[90vh]',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-zinc-800 text-zinc-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <form
            onSubmit={handleSimulate}
            noValidate
            ref={(el) => {
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', 'simulate-modal-title');
            }}
          >
            <ModalHeader className="pb-4 border-b border-zinc-800/80">
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="simulate-modal-title" className="font-semibold text-lg text-zinc-100">
                      Simulasi Rencana Belanja
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal">
                      What-If Purchase & Runway Impact Simulator
                    </p>
                  </div>
                </div>
                <Button
                  variant="light"
                  isIconOnly
                  onPress={handleClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                />
              </div>
            </ModalHeader>

            <ModalBody className="py-6 overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="planned-amount" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Nominal Rencana Belanja (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  color="primary"
                  isLoading={isLoading}
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
                </Button>
              </div>

              {result && (
                <div className="mt-6 pt-5 border-t border-zinc-800/80 space-y-4">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                    Hasil Proyeksi Runway
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-900/70 border border-zinc-800 p-3.5 rounded-xl">
                      <span className="text-[11px] text-zinc-400 block mb-1">Jatah Saat Ini</span>
                      <p className="text-sm font-bold text-zinc-200 tabular-nums">
                        Rp {result.current_daily_runway.toLocaleString('id-ID')}
                      </p>
                      <span className="text-[10px] text-zinc-400">/ hari</span>
                    </div>

                    <div className="bg-zinc-900/70 border border-zinc-800 p-3.5 rounded-xl">
                      <span className="text-[11px] text-zinc-400 block mb-1">Proyeksi Setelah Belanja</span>
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          result.is_safe ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        Rp {result.projected_daily_runway.toLocaleString('id-ID')}
                      </p>
                      <span className="text-[10px] text-zinc-400">/ hari</span>
                    </div>

                    <div className="bg-zinc-900/70 border border-zinc-800 p-3.5 rounded-xl">
                      <span className="text-[11px] text-zinc-400 block mb-1">Penurunan Jatah Harian</span>
                      <p className="text-sm font-bold text-amber-400 tabular-nums">
                        -Rp {result.daily_drop_amount.toLocaleString('id-ID')}/hari
                      </p>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <TrendingDown className="w-3 h-3 text-amber-400" /> berkurang
                      </span>
                    </div>
                  </div>

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
                      <p className="text-zinc-300">{result.advice}</p>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
