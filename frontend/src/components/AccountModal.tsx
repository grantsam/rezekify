import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Building2, Wallet, Coins, AlertTriangle } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { Account, AccountType } from '../types/api';
import { apiFetch, updateAccount, deactivateAccount } from '../services/apiClient';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  accountToEdit?: Account | null;
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
  accountToEdit = null,
}) => {
  const isEditMode = Boolean(accountToEdit);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('BANK');
  const [initialBalance, setInitialBalance] = useState('');
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name || '');
        setAccountType(accountToEdit.account_type || 'BANK');
        setInitialBalance('');
      } else {
        setName('');
        setAccountType('BANK');
        setInitialBalance('');
      }
      setIsConfirmingDeactivate(false);
      setErrorMsg(null);
    }
  }, [isOpen, accountToEdit]);

  const dialogRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', 'account-modal-title');
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== 'account-modal-title') {
        node.setAttribute('aria-labelledby', 'account-modal-title');
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, []);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setAccountType('BANK');
    setInitialBalance('');
    setIsConfirmingDeactivate(false);
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

    if (!isEditMode) {
      const parsedBalance = parseFloat(initialBalance) || 0;
      if (parsedBalance < 0) {
        setErrorMsg('Saldo awal tidak boleh negatif');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditMode && accountToEdit) {
        await updateAccount(accountToEdit.id, {
          name: trimmedName,
          account_type: accountType,
        });
      } else {
        const parsedBalance = parseFloat(initialBalance) || 0;
        await apiFetch('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
            account_type: accountType,
            initial_balance: parsedBalance,
          }),
        });
      }

      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || (isEditMode ? 'Gagal memperbarui rekening.' : 'Gagal membuat akun baru.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!accountToEdit) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await deactivateAccount(accountToEdit.id);
      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menonaktifkan rekening.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={handleClose}
      backdrop="blur"
      classNames={{
        base: 'bg-[#141417] border border-zinc-800/80 text-zinc-100',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-zinc-800 text-zinc-400 hover:text-white',
      }}
    >
      <ModalContent>
        {(_modalClose) => (
          <form
            onSubmit={handleSubmit}
            ref={(el) => {
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', 'account-modal-title');
            }}
          >
            <ModalHeader id="account-modal-title">
              <div className="flex items-center justify-between w-full pr-6">
                <h3 id="account-modal-title" className="font-semibold text-lg text-zinc-100">
                  {isEditMode ? 'Edit Rekening' : 'Tambah Akun Baru'}
                </h3>
                <Button
                  variant="light"
                  isIconOnly
                  onPress={handleClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                >
                  Tutup modal
                </Button>
              </div>
            </ModalHeader>
            <ModalBody>
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="account-name" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Nama Rekening / Akun
                  </label>
                  <input
                    id="account-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: BCA Utama, GoPay, Dompet Tunai"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-400 mb-1.5">Tipe Akun</span>
                  <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs" role="radiogroup" aria-label="Tipe Akun">
                    {ACCOUNT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                      <Button
                        key={type}
                        onPress={() => setAccountType(type)}
                        aria-checked={accountType === type}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition-all min-h-[38px] ${
                          accountType === type
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                            : 'text-zinc-400 hover:text-white border border-transparent bg-transparent'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {!accountToEdit ? (
                  <div>
                    <label htmlFor="initial-balance" className="block text-xs font-medium text-zinc-400 mb-1.5">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="edit-current-balance" className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Saldo Saat Ini (Rp)
                    </label>
                    <input
                      id="edit-current-balance"
                      type="text"
                      disabled
                      value={`Rp ${(accountToEdit.current_balance ?? 0).toLocaleString('id-ID')}`}
                      className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-400 cursor-not-allowed"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Saldo dikelola otomatis secara immutable melalui mutasi transaksi.
                    </p>
                  </div>
                )}

                {isEditMode && isConfirmingDeactivate && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Konfirmasi Penonaktifan Rekening</span>
                    </div>
                    <p className="text-zinc-300">
                      Rekening ini akan dinonaktifkan dan disembunyikan dari daftar akun aktif. Seluruh catatan transaksi dan mutasi tetap tersimpan secara aman di buku besar.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => setIsConfirmingDeactivate(false)}
                        className="text-xs text-zinc-400 hover:text-white min-h-[38px] px-3 rounded-lg"
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        isLoading={isSubmitting}
                        isDisabled={isSubmitting}
                        onPress={handleDeactivate}
                        className="bg-rose-600 hover:bg-rose-700 font-medium text-xs text-white min-h-[38px] px-3.5 rounded-lg"
                      >
                        Ya, Nonaktifkan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between">
              <div>
                {isEditMode && !isConfirmingDeactivate && (
                  <Button
                    color="danger"
                    variant="light"
                    onPress={() => setIsConfirmingDeactivate(true)}
                    className="px-3.5 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors min-h-[38px]"
                  >
                    Nonaktifkan Rekening
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="light"
                  onPress={handleClose}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors min-h-[38px]"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" data-testid="submit-loading-spinner" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan Akun'}</span>
                  )}
                </Button>
              </div>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
