import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Account, Category, Transaction, TransactionUpdateRequest } from '../types/api';
import { apiClient } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories?: Category[];
}

export const EditTransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  transaction,
  accounts,
  categories = [],
}) => {
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction) return;

    setDescription(transaction.description || '');

    if (transaction.transaction_date) {
      try {
        const d = new Date(transaction.transaction_date);
        if (!isNaN(d.getTime())) {
          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setTransactionDate(localIso);
        } else {
          setTransactionDate('');
        }
      } catch {
        setTransactionDate('');
      }
    } else {
      setTransactionDate('');
    }

    const entries = transaction.ledger_entries || [];
    const accountEntries = entries.filter((e) => e.account_id);
    const categoryEntry = entries.find((e) => e.category_id);

    if (categoryEntry) {
      setCategoryId(categoryEntry.category_id || '');
    } else {
      setCategoryId('');
    }

    if (accountEntries.length >= 2) {
      setType('TRANSFER');
      const creditEntry = accountEntries.find((e) => e.entry_type === 'CREDIT');
      const debitEntry = accountEntries.find((e) => e.entry_type === 'DEBIT');
      setFromAccountId(creditEntry?.account_id || accounts[0]?.id || '');
      setToAccountId(debitEntry?.account_id || accounts[1]?.id || accounts[0]?.id || '');
      setAmount(String(creditEntry?.amount ?? entries[0]?.amount ?? ''));
    } else if (accountEntries.length === 1) {
      const accEntry = accountEntries[0];
      setAmount(String(accEntry.amount ?? ''));
      setAccountId(accEntry.account_id || accounts[0]?.id || '');
      if (accEntry.entry_type === 'CREDIT') {
        setType('EXPENSE');
      } else {
        setType('INCOME');
      }
    } else {
      setAmount(String(entries[0]?.amount ?? ''));
      setAccountId(accounts[0]?.id || '');
      setType('EXPENSE');
    }
    setErrorMsg(null);
  }, [transaction, accounts]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Nominal harus berupa angka positif lebih dari 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Deskripsi transaksi tidak boleh kosong.');
      return;
    }

    const payload: TransactionUpdateRequest = {
      transaction_type: type,
      amount: parsedAmount,
      description: description.trim(),
      account_id: type !== 'TRANSFER' ? (accountId || accounts[0]?.id) : undefined,
      category_id: type !== 'TRANSFER' && categoryId ? categoryId : undefined,
      from_account_id: type === 'TRANSFER' ? (fromAccountId || accounts[0]?.id) : undefined,
      to_account_id: type === 'TRANSFER' ? (toAccountId || accounts[1]?.id || accounts[0]?.id) : undefined,
      transaction_date: transactionDate ? new Date(transactionDate).toISOString() : undefined,
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await apiClient.updateTransaction(transaction.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memperbarui transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
              <span>Edit Transaksi</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                Reconciliation
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Perubahan nominal atau rekening akan merekonsiliasi saldo secara otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
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
            <label htmlFor="edit-amount-input" className="block text-xs font-medium text-slate-400 mb-1">
              Nominal Transaksi (Rp) *
            </label>
            <input
              id="edit-amount-input"
              aria-label="Nominal Transaksi"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 75000"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="edit-desc-input" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Keterangan Transaksi *</span>
            </label>
            <input
              id="edit-desc-input"
              aria-label="Keterangan Transaksi"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Belanja Bulanan di Supermarket"
              required
              maxLength={500}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {type !== 'TRANSFER' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-account-select" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rekening / Akun *</span>
                </label>
                <select
                  id="edit-account-select"
                  aria-label="Rekening / Akun"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-category-select" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kategori (Opsional)</span>
                </label>
                <select
                  id="edit-category-select"
                  aria-label="Kategori (Opsional)"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Tanpa Kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-from-account" className="block text-xs font-medium text-slate-400 mb-1">
                  Dari Rekening Asal *
                </label>
                <select
                  id="edit-from-account"
                  aria-label="Dari Rekening Asal"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-to-account" className="block text-xs font-medium text-slate-400 mb-1">
                  Ke Rekening Tujuan *
                </label>
                <select
                  id="edit-to-account"
                  aria-label="Ke Rekening Tujuan"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="edit-datetime-input" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Waktu Transaksi</span>
            </label>
            <input
              id="edit-datetime-input"
              aria-label="Waktu Transaksi"
              type="datetime-local"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
