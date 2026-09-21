import React, { useState } from 'react';
import { X, Loader2, Building2, Wallet, Coins } from 'lucide-react';
import { AccountType } from '../types/api';
import { apiFetch } from '../services/apiClient';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

const ACCOUNT_TYPE_OPTIONS: { type: AccountType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { type: 'BANK', label: 'Bank', icon: Building2 },
  { type: 'EWALLET', label: 'E-Wallet', icon: Wallet },
  { type: 'CASH', label: 'Cash', icon: Coins },
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('BANK');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setAccountType('BANK');
    setInitialBalance('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Nama rekening wajib diisi');
      return;
    }

    const parsedBalance = parseFloat(initialBalance) || 0;
    if (parsedBalance < 0) {
      setErrorMsg('Saldo awal tidak boleh negatif');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiFetch('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          account_type: accountType,
          initial_balance: parsedBalance,
        }),
      });

      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membuat akun baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 text-white shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 id="account-modal-title" className="font-semibold text-lg text-slate-100">Tambah Akun Baru</h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup modal"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="account-name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Nama Rekening / Akun
            </label>
            <input
              id="account-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: BCA Utama, GoPay, Dompet Tunai"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Tipe Akun</span>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {ACCOUNT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition-all ${
                    accountType === type
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="initial-balance" className="block text-xs font-medium text-slate-400 mb-1.5">
              Saldo Awal (Rp)
            </label>
            <input
              id="initial-balance"
              type="number"
              min="0"
              step="any"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-xl text-xs text-white transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" data-testid="submit-loading-spinner" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Akun</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
