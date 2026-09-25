import React, { useState, useEffect } from 'react';
import { PlusCircle, Loader2, Save, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { Account, Category, Transaction, TransactionUpdateRequest } from '../types/api';
import { apiFetch, updateTransaction } from '../services/apiClient';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories?: Category[];
  onSuccess?: () => void;
  transaction?: Transaction | null; // If provided, switches to EDIT mode
  initialTransaction?: Transaction | null;
  mode?: 'create' | 'edit';
  onSubmit?: (data: any) => Promise<void>;
}

export const ManualTransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories = [],
  onSuccess,
  transaction,
  initialTransaction,
  mode,
  onSubmit,
}) => {
  const activeTx = transaction ?? initialTransaction;
  const isEdit = mode === 'edit' || Boolean(activeTx);

  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && activeTx) {
      setDescription(activeTx.description || '');

      if (activeTx.transaction_date) {
        try {
          const d = new Date(activeTx.transaction_date);
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

      const entries = activeTx.ledger_entries || [];
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
    } else if (!isEdit && isOpen) {
      setType('EXPENSE');
      setAmount('');
      setDescription('');
      setAccountId(accounts[0]?.id || '');
      setFromAccountId(accounts[0]?.id || '');
      setToAccountId(accounts[1]?.id || accounts[0]?.id || '');
      setCategoryId('');
      const d = new Date();
      setTransactionDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setErrorMsg(null);
    }
  }, [isEdit, activeTx, accounts, isOpen]);

  const titleId = isEdit ? 'edit-modal-title' : 'manual-modal-title';

  const dialogRef = React.useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', titleId);
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== titleId) {
        node.setAttribute('aria-labelledby', titleId);
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, [titleId]);

  if (!isOpen || (isEdit && !activeTx)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (isEdit) {
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setErrorMsg('Nominal harus berupa angka positif lebih dari 0.');
        return;
      }
      if (!description.trim()) {
        setErrorMsg('Deskripsi transaksi tidak boleh kosong.');
        return;
      }
    } else {
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setErrorMsg('Nominal harus lebih besar dari 0');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEdit && activeTx) {
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

        if (onSubmit) {
          await onSubmit(payload);
        } else {
          await updateTransaction(activeTx.id, payload);
        }
        onSuccess?.();
        onClose();
      } else {
        const payload = {
          transaction_type: type,
          amount: parsedAmount,
          description: description.trim() || (type === 'TRANSFER' ? 'Transfer Antar Akun' : 'Transaksi Manual'),
          account_id: type !== 'TRANSFER' ? (accountId || accounts[0]?.id) : undefined,
          from_account_id: type === 'TRANSFER' ? (fromAccountId || accounts[0]?.id) : undefined,
          to_account_id: type === 'TRANSFER' ? (toAccountId || accounts[1]?.id || accounts[0]?.id) : undefined,
          category_id: type !== 'TRANSFER' ? (categoryId || undefined) : undefined,
          transaction_date: transactionDate ? new Date(transactionDate).toISOString() : undefined,
          source_channel: 'WEB_MANUAL',
        };

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
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (isEdit ? 'Gagal memperbarui transaksi.' : 'Gagal menyimpan transaksi.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-[#141417] border border-zinc-800/80 text-zinc-100 max-w-lg',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-zinc-800 text-zinc-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <form
            onSubmit={handleSubmit}
            noValidate
            ref={(el) => {
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', titleId);
            }}
          >
            <ModalHeader id={titleId}>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <h3 id={titleId} className="font-semibold text-lg flex items-center gap-2 text-white">
                    {isEdit ? (
                      <>
                        <Save className="w-5 h-5 text-indigo-400" />
                        <span>Edit Transaksi</span>
                        <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                          Reconciliation
                        </span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-5 h-5 text-indigo-400" />
                        <span>Tambah Transaksi Manual</span>
                      </>
                    )}
                  </h3>
                  {isEdit && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Perubahan nominal atau rekening akan merekonsiliasi saldo secara otomatis.
                    </p>
                  )}
                </div>
                <Button
                  variant="light"
                  isIconOnly
                  onPress={onClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                >
                  Tutup modal
                </Button>
              </div>
            </ModalHeader>

            <ModalBody>
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 text-xs" role="radiogroup" aria-label="Tipe Transaksi">
                  {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                    <Button
                      key={t}
                      role="radio"
                      aria-checked={type === t}
                      onPress={() => setType(t)}
                      className={`min-h-[38px] flex items-center justify-center py-2 rounded-lg font-medium transition-all ${
                        type === t
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t === 'EXPENSE' ? 'Pengeluaran' : t === 'INCOME' ? 'Pemasukan' : 'Transfer'}
                    </Button>
                  ))}
                </div>

                <div>
                  <label htmlFor="amount-input" className="block text-xs font-medium text-zinc-400 mb-1">
                    Nominal Transaksi (Rp) <span className="sr-only">Nominal</span>*
                  </label>
                  <input
                    id="amount-input"
                    aria-label="Nominal Transaksi"
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Contoh: 25000"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none tabular-nums placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label htmlFor="desc-input" className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Keterangan Transaksi <span className="sr-only">Deskripsi</span>*</span>
                  </label>
                  <input
                    id="desc-input"
                    aria-label="Keterangan Transaksi"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Makan Siang Nasi Padang"
                    required
                    maxLength={500}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none placeholder-zinc-500"
                  />
                </div>

                {type !== 'TRANSFER' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="account-select" className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Pilih Akun <span className="sr-only">Rekening / Akun</span>*</span>
                      </label>
                      <select
                        id="account-select"
                        aria-label="Rekening / Akun"
                        value={accountId || accounts[0]?.id || ''}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                      >
                        {accounts.length === 0 ? (
                          <option value="">Belum ada akun</option>
                        ) : (
                          accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="category-select" className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Kategori (Opsional)</span>
                      </label>
                      <select
                        id="category-select"
                        aria-label="Kategori (Opsional)"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="">-- {isEdit ? 'Tanpa Kategori' : 'Pilih Kategori'} --</option>
                        {categories
                          .filter((c) => !c.category_type || c.category_type.toUpperCase() === type)
                          .map((cat) => (
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
                      <label htmlFor="from-account-select" className="block text-xs font-medium text-zinc-400 mb-1">
                        Dari Rekening Asal <span className="sr-only">Dari Akun</span>*
                      </label>
                      <select
                        id="from-account-select"
                        aria-label="Dari Rekening Asal"
                        value={fromAccountId || accounts[0]?.id || ''}
                        onChange={(e) => setFromAccountId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="to-account-select" className="block text-xs font-medium text-zinc-400 mb-1">
                        Ke Rekening Tujuan <span className="sr-only">Ke Akun</span>*
                      </label>
                      <select
                        id="to-account-select"
                        aria-label="Ke Rekening Tujuan"
                        value={toAccountId || accounts[1]?.id || ''}
                        onChange={(e) => setToAccountId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none text-white"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="date-input" className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Waktu Transaksi <span className="sr-only">Tanggal Transaksi</span></span>
                  </label>
                  <input
                    id="date-input"
                    aria-label="Waktu Transaksi"
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="light"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition-colors min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isSubmitting}
                isDisabled={isSubmitting || !amount}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 min-h-[40px] rounded-xl text-xs font-medium transition-all shadow-md shadow-indigo-600/30 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : isEdit ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Simpan Transaksi</span>
                  </>
                )}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};

export const TransactionModal = ManualTransactionModal;

