import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { PiggyBank, Loader2, AlertCircle } from 'lucide-react';
import { Account, Vault } from '../types/api';
import { depositVault } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';

export interface DepositVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vault: Vault | null;
  accounts: Account[];
}

const QUICK_CHIPS = [
  { label: '+50rb', amount: 50000 },
  { label: '+100rb', amount: 100000 },
  { label: '+250rb', amount: 250000 },
  { label: '+500rb', amount: 500000 },
];

export const DepositVaultModal: React.FC<DepositVaultModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vault,
  accounts,
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const titleId = 'deposit-vault-modal-title';

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setSelectedAccountId('');
      setErrorMessage(null);
      const timer = setTimeout(() => {
        const dialog = formRef.current?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.setAttribute('aria-labelledby', titleId);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vault]);

  if (!isOpen || !vault) return null;

  const currentAllocated = vault.allocated_amount || 0;
  const target = vault.target_amount || 0;
  const depositNum = parseFloat(amountStr) || 0;
  const projectedAllocated = currentAllocated + depositNum;
  const projectedPct = target > 0 ? Math.min(100, Math.round((projectedAllocated / target) * 100)) : 100;

  const handleAddChip = (chipAmount: number) => {
    const current = parseFloat(amountStr) || 0;
    setAmountStr((current + chipAmount).toString());
    setErrorMessage(null);
  };

  const handleClose = () => {
    setAmountStr('');
    setSelectedAccountId('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositNum <= 0) {
      setErrorMessage('Nominal tambahan harus lebih besar dari 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      // ponytail: direct payload pass-through without multi-currency convert; add FX conversion when multi-currency accounts are supported.
      await depositVault(vault.id, {
        amount: depositNum,
        source_account_id: selectedAccountId || null,
      });
      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menambahkan alokasi ke vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-white dark:bg-[#141417] border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] shadow-2xl p-6 max-w-md w-full text-slate-900 dark:text-zinc-100',
        backdrop: 'bg-black/60 backdrop-blur-md',
      }}
    >
      <ModalContent>
        {() => (
          <form
            ref={(el) => {
              formRef.current = el;
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', titleId);
            }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <ModalHeader className="p-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-extrabold text-slate-900 dark:text-white">
                  Nabung ke {vault.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Terkumpul saat ini: {formatRupiah(currentAllocated)} / {formatRupiah(target)}
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="p-0 space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-300 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nominal Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="deposit-amount-input"
                  className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                >
                  Nominal Tambahan
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-zinc-500">
                    Rp
                  </span>
                  <input
                    id="deposit-amount-input"
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="0"
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[42px]"
                  />
                </div>
              </div>

              {/* Quick Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleAddChip(chip.amount)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-zinc-800/80 hover:bg-emerald-500/15 text-slate-700 dark:text-zinc-300 hover:text-emerald-500 border border-slate-200 dark:border-zinc-700/80 transition-all min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Account Selector (Optional verification) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="source-account-select"
                  className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                >
                  Verifikasi Saldo Rekening (Opsional)
                </label>
                <select
                  id="source-account-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px]"
                >
                  <option value="">Pilih rekening sumber (opsional)</option>
                  {accounts
                    .filter((a) => a.is_active)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — {formatRupiah(acc.current_balance)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Projection Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-700 dark:text-zinc-300">
                  <span>Proyeksi Terkumpul:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(projectedAllocated)} ({projectedPct}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
                  Dana akan langsung dikunci (<span className="text-emerald-500 font-bold">is_locked</span>) agar kas operasional harian terlindungi.
                </p>
              </div>
            </ModalBody>

            <ModalFooter className="p-0 pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="light"
                size="sm"
                onPress={handleClose}
                isDisabled={isSubmitting}
                className="text-xs font-bold text-slate-500 dark:text-zinc-400 min-h-[38px] rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                isDisabled={isSubmitting || depositNum <= 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs min-h-[42px] px-5 rounded-2xl shadow-lg shadow-emerald-950/30 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Alokasi'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
