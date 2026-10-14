import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Receipt, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { Account, Vault } from '../types/api';
import { payBillVault } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';

export interface PayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vault: Vault | null;
  accounts: Account[];
}

export const PayBillModal: React.FC<PayBillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vault,
  accounts,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const titleId = 'pay-bill-modal-title';

  useEffect(() => {
    if (isOpen && vault) {
      const defaultAcc = accounts.find((a) => a.is_active);
      setSelectedAccountId(defaultAcc ? defaultAcc.id : '');
      setAmountStr(vault.target_amount ? vault.target_amount.toString() : '');
      setNotes('');
      setErrorMessage(null);

      const timer = setTimeout(() => {
        const dialog = formRef.current?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.setAttribute('aria-labelledby', titleId);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vault, accounts]);

  if (!isOpen || !vault) return null;

  const payAmount = parseFloat(amountStr) || vault.target_amount || 0;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setErrorMessage('Pilih rekening untuk pembayaran tagihan.');
      return;
    }
    if (payAmount <= 0) {
      setErrorMessage('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      // ponytail: single-currency ledger mutation; add multi-currency fee handling when foreign bill payments are integrated.
      await payBillVault(vault.id, {
        account_id: selectedAccountId,
        amount: payAmount,
        notes: notes.trim(),
      });
      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses pembayaran tagihan.');
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
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-extrabold text-slate-900 dark:text-white">
                  Bayar Tagihan: {vault.name}
                </h2>
                {vault.target_date && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    Jatuh tempo: {vault.target_date}
                  </p>
                )}
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

              {/* Account Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pay-bill-account-select"
                  className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                >
                  Sumber Rekening Pembayaran
                </label>
                <select
                  id="pay-bill-account-select"
                  required
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-[40px]"
                >
                  <option value="">Pilih rekening</option>
                  {accounts
                    .filter((a) => a.is_active)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — Saldo: {formatRupiah(acc.current_balance)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pay-bill-amount-input"
                  className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                >
                  Nominal Pembayaran
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-zinc-500">
                    Rp
                  </span>
                  <input
                    id="pay-bill-amount-input"
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
                    className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-[42px]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pay-bill-notes-input"
                  className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                >
                  Catatan (Opsional)
                </label>
                <input
                  id="pay-bill-notes-input"
                  type="text"
                  placeholder="misal: Periode Oktober 2026"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-[40px]"
                />
              </div>

              {/* Explanation card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-slate-600 dark:text-zinc-400 font-medium">
                <p className="font-bold text-amber-700 dark:text-amber-400">
                  Pencatatan Otomatis & Siklus Baru:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Pembayaran akan dicatat di buku besar, memotong saldo rekening, mengosongkan alokasi terkumpul, dan memajukan jatuh tempo tagihan ke bulan depan.
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
                isDisabled={isSubmitting || !selectedAccountId || payAmount <= 0}
                className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs min-h-[42px] px-5 rounded-2xl shadow-lg shadow-amber-950/30 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Konfirmasi & Bayar Tagihan'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
