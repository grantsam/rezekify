import React, { useState } from 'react';
import { Loader2, Building2, Wallet, Coins } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
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

  const dialogRef = React.useCallback((node: HTMLElement | null) => {
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
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={handleClose}
      backdrop="blur"
      classNames={{
        base: 'bg-slate-900 border border-slate-800 text-white',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
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
                <h3 id="account-modal-title" className="font-semibold text-lg text-slate-100">Tambah Akun Baru</h3>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                >
                  Tutup modal
                </button>
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="light"
                onPress={handleClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                Batal
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-medium rounded-xl text-xs text-white transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" data-testid="submit-loading-spinner" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Akun</span>
                )}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
