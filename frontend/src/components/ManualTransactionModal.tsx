import React, { useState } from 'react';
import { X, PlusCircle, Loader2 } from 'lucide-react';
import { Account } from '../types/api';
import { apiFetch } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess?: () => void;
  onSubmit?: (data: {
    transaction_type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
    amount: number;
    description: string;
    account_id?: string;
    from_account_id?: string;
    to_account_id?: string;
  }) => Promise<void>;
}

export const ManualTransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  accounts,
  onSuccess,
  onSubmit,
}) => {
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Nominal harus lebih besar dari 0');
      return;
    }

    const payload = {
      transaction_type: type,
      amount: parsedAmount,
      description: description.trim() || (type === 'TRANSFER' ? 'Transfer Antar Akun' : 'Transaksi Manual'),
      account_id: type !== 'TRANSFER' ? (accountId || accounts[0]?.id) : undefined,
      from_account_id: type === 'TRANSFER' ? (fromAccountId || accounts[0]?.id) : undefined,
      to_account_id: type === 'TRANSFER' ? (toAccountId || accounts[1]?.id) : undefined,
      source_channel: 'WEB_MANUAL',
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await apiFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-modal-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 text-white shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 id="manual-modal-title" className="font-semibold text-lg">Catat Transaksi Manual</h3>
          <button
            type="button"
            onClick={onClose}
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
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 rounded-lg font-medium transition-all ${
                  type === t
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'EXPENSE' ? 'Pengeluaran' : t === 'INCOME' ? 'Pemasukan' : 'Transfer'}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="amount-input" className="block text-xs text-slate-400 mb-1">
              Nominal (Rp)
            </label>
            <input
              id="amount-input"
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="misal: 25000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500"
            />
          </div>

          <div>
            <label htmlFor="desc-input" className="block text-xs text-slate-400 mb-1">
              Deskripsi
            </label>
            <input
              id="desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="misal: Makan Siang Nasi Padang"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500"
            />
          </div>

          {type !== 'TRANSFER' ? (
            <div>
              <label htmlFor="account-select" className="block text-xs text-slate-400 mb-1">
                Pilih Akun
              </label>
              <select
                id="account-select"
                value={accountId || accounts[0]?.id || ''}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white"
              >
                {accounts.length === 0 ? (
                  <option value="">Belum ada akun</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {acc.current_balance.toLocaleString('id-ID')})
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="from-account-select" className="block text-xs text-slate-400 mb-1">
                  Dari Akun
                </label>
                <select
                  id="from-account-select"
                  value={fromAccountId || accounts[0]?.id || ''}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="to-account-select" className="block text-xs text-slate-400 mb-1">
                  Ke Akun
                </label>
                <select
                  id="to-account-select"
                  value={toAccountId || accounts[1]?.id || ''}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 min-h-[40px] rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>Simpan Transaksi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
