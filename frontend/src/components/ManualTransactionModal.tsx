import React, { useState, useEffect } from 'react';
import { PlusCircle, Loader2, Save, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Select, SelectItem } from '@heroui/react';
import { Account, Category, Transaction, TransactionUpdateRequest } from '../types/api';
import { apiFetch, updateTransaction } from '../services/apiClient';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories?: Category[];
  onSuccess?: () => void;
  transaction?: Transaction | null;
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
        base: 'bg-white dark:bg-[#042421] border-2 border-[#10B981]/30 text-slate-900 dark:text-white rounded-[28px] shadow-2xl shadow-[#10B981]/10 max-w-lg text-left select-none',
        backdrop: 'bg-black/60 backdrop-blur-md',
        closeButton: 'hover:bg-slate-100 dark:hover:bg-[#021D17] text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl',
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
                  <h3 id={titleId} className="font-extrabold text-base sm:text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                    {isEdit ? (
                      <>
                        <Save className="w-5 h-5 text-[#10B981]" />
                        <span>Edit Transaksi</span>
                        <span className="text-[10px] font-mono font-bold uppercase bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981] px-2 py-0.5 rounded-lg border border-[#10B981]/20">
                          Reconciliation
                        </span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-5 h-5 text-[#10B981]" />
                        <span>Tambah Transaksi Manual</span>
                      </>
                    )}
                  </h3>
                  {isEdit && (
                    <p className="text-xs text-slate-500 dark:text-emerald-200/80 font-medium mt-0.5">
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
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-300 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-[#021D17] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 text-xs" role="radiogroup" aria-label="Tipe Transaksi">
                  {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                    <Button
                      key={t}
                      role="radio"
                      aria-checked={type === t}
                      onPress={() => setType(t)}
                      className={`min-h-[38px] flex items-center justify-center py-2 rounded-xl font-extrabold transition-all ${
                        type === t
                          ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-[#10B981] bg-transparent'
                      }`}
                    >
                      {t === 'EXPENSE' ? 'Pengeluaran' : t === 'INCOME' ? 'Pemasukan' : 'Transfer'}
                    </Button>
                  ))}
                </div>

                <div>
                  <label htmlFor="amount-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
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
                    className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-mono font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="desc-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#10B981]" />
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
                    className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-medium"
                  />
                </div>

                {type !== 'TRANSFER' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="account-select" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Pilih Akun <span className="sr-only">Rekening / Akun</span>*</span>
                      </label>
                      <Select
                        id="account-select"
                        name="account_id"
                        role="combobox"
                        aria-label="Pilih Akun"
                        selectedKeys={accountId ? [accountId] : (accounts[0]?.id ? [accounts[0].id] : [])}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          if (selected) setAccountId(selected);
                        }}
                        onChange={(e) => {
                          if (e.target.value) setAccountId(e.target.value);
                        }}
                        disallowEmptySelection={accounts.length > 0}
                        isDisabled={accounts.length === 0}
                        placeholder={accounts.length === 0 ? 'Belum ada akun' : 'Pilih Akun'}
                        className="w-full"
                        classNames={{
                          trigger: 'bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                          popoverContent: 'bg-white dark:bg-[#042421] border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white',
                          value: 'text-slate-900 dark:text-white text-xs font-bold',
                        }}
                      >
                        {[
                          ...(accountId && !accounts.some((a) => a.id === accountId) ? [
                            <SelectItem key={accountId} textValue={accountId} className="text-slate-700 dark:text-slate-200">
                              {accountId}
                            </SelectItem>
                          ] : []),
                          ...accounts.map((acc) => (
                            <SelectItem
                              key={acc.id}
                              textValue={`${acc.name} (Rp ${Number(acc.current_balance).toLocaleString('id-ID')})`}
                              className="text-slate-700 dark:text-slate-200 hover:bg-[#10B981]/10 font-medium"
                            >
                              {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                            </SelectItem>
                          )),
                        ]}
                      </Select>
                    </div>

                    <div>
                      <label htmlFor="category-select" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Kategori (Opsional)</span>
                      </label>
                      <Select
                        id="category-select"
                        name="category_id"
                        role="combobox"
                        aria-label="Kategori (Opsional)"
                        selectedKeys={categoryId ? [categoryId] : ['none']}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          setCategoryId(selected === 'none' ? '' : (selected || ''));
                        }}
                        onChange={(e) => {
                          setCategoryId(e.target.value === 'none' ? '' : (e.target.value || ''));
                        }}
                        disallowEmptySelection
                        placeholder={`-- ${isEdit ? 'Tanpa Kategori' : 'Pilih Kategori'} --`}
                        className="w-full"
                        classNames={{
                          trigger: 'bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                          popoverContent: 'bg-white dark:bg-[#042421] border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white',
                          value: 'text-slate-900 dark:text-white text-xs font-bold',
                        }}
                      >
                        {[
                          <SelectItem key="none" textValue={isEdit ? 'Tanpa Kategori' : 'Pilih Kategori'} className="text-slate-400 font-medium">
                            -- {isEdit ? 'Tanpa Kategori' : 'Pilih Kategori'} --
                          </SelectItem>,
                          ...(categoryId && !categories.some((c) => (!c.category_type || c.category_type.toUpperCase() === type) && c.id === categoryId) ? [
                            <SelectItem key={categoryId} textValue={categoryId} className="text-slate-700 dark:text-slate-200">
                              {categories.find((c) => c.id === categoryId)?.name || categoryId}
                            </SelectItem>
                          ] : []),
                          ...categories
                            .filter((c) => !c.category_type || c.category_type.toUpperCase() === type)
                            .map((cat) => (
                              <SelectItem
                                key={cat.id}
                                textValue={cat.name}
                                className="text-slate-700 dark:text-slate-200 hover:bg-[#10B981]/10 font-medium"
                              >
                                {cat.name}
                              </SelectItem>
                            )),
                        ]}
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="from-account-select" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                        Dari Rekening Asal <span className="sr-only">Dari Akun</span>*
                      </label>
                      <Select
                        id="from-account-select"
                        name="from_account_id"
                        role="combobox"
                        aria-label="Dari Rekening Asal"
                        selectedKeys={fromAccountId ? [fromAccountId] : (accounts[0]?.id ? [accounts[0].id] : [])}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          if (selected) setFromAccountId(selected);
                        }}
                        onChange={(e) => {
                          if (e.target.value) setFromAccountId(e.target.value);
                        }}
                        disallowEmptySelection={accounts.length > 0}
                        isDisabled={accounts.length === 0}
                        placeholder="Pilih rekening asal"
                        className="w-full"
                        classNames={{
                          trigger: 'bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                          popoverContent: 'bg-white dark:bg-[#042421] border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white',
                          value: 'text-slate-900 dark:text-white text-xs font-bold',
                        }}
                      >
                        {[
                          ...(fromAccountId && !accounts.some((a) => a.id === fromAccountId) ? [
                            <SelectItem key={fromAccountId} textValue={fromAccountId} className="text-slate-700 dark:text-slate-200">
                              {fromAccountId}
                            </SelectItem>
                          ] : []),
                          ...accounts.map((acc) => (
                            <SelectItem
                              key={acc.id}
                              textValue={`${acc.name} (Rp ${Number(acc.current_balance).toLocaleString('id-ID')})`}
                              className="text-slate-700 dark:text-slate-200 hover:bg-[#10B981]/10 font-medium"
                            >
                              {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                            </SelectItem>
                          )),
                        ]}
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="to-account-select" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                        Ke Rekening Tujuan <span className="sr-only">Ke Akun</span>*
                      </label>
                      <Select
                        id="to-account-select"
                        name="to_account_id"
                        role="combobox"
                        aria-label="Ke Rekening Tujuan"
                        selectedKeys={toAccountId ? [toAccountId] : (accounts[1]?.id ? [accounts[1].id] : accounts[0]?.id ? [accounts[0].id] : [])}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          if (selected) setToAccountId(selected);
                        }}
                        onChange={(e) => {
                          if (e.target.value) setToAccountId(e.target.value);
                        }}
                        disallowEmptySelection={accounts.length > 0}
                        isDisabled={accounts.length === 0}
                        placeholder="Pilih rekening tujuan"
                        className="w-full"
                        classNames={{
                          trigger: 'bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                          popoverContent: 'bg-white dark:bg-[#042421] border border-slate-200 dark:border-[#10B981]/30 text-slate-900 dark:text-white',
                          value: 'text-slate-900 dark:text-white text-xs font-bold',
                        }}
                      >
                        {[
                          ...(toAccountId && !accounts.some((a) => a.id === toAccountId) ? [
                            <SelectItem key={toAccountId} textValue={toAccountId} className="text-slate-700 dark:text-slate-200">
                              {toAccountId}
                            </SelectItem>
                          ] : []),
                          ...accounts.map((acc) => (
                            <SelectItem
                              key={acc.id}
                              textValue={`${acc.name} (Rp ${Number(acc.current_balance).toLocaleString('id-ID')})`}
                              className="text-slate-700 dark:text-slate-200 hover:bg-[#10B981]/10 font-medium"
                            >
                              {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                            </SelectItem>
                          )),
                        ]}
                      </Select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="date-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Waktu Transaksi <span className="sr-only">Tanggal Transaksi</span></span>
                  </label>
                  <input
                    id="date-input"
                    aria-label="Waktu Transaksi"
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white outline-none font-medium transition-all"
                  />
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-2">
              <Button
                variant="light"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                isDisabled={isSubmitting || !amount}
                className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#10B981]/25 px-5 min-h-[40px] flex items-center gap-2"
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