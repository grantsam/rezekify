import React, { useState } from 'react';
import { Loader2, PiggyBank, Receipt, Lock } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { VaultType } from '../types/api';
import { apiFetch } from '../services/apiClient';

export interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

interface VaultOption {
  type: VaultType;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const VAULT_TYPE_OPTIONS: VaultOption[] = [
  { type: 'FIXED_BILL', label: 'Tagihan Tetap', icon: Receipt },
  { type: 'SAVINGS', label: 'Tabungan', icon: PiggyBank },
];

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [vaultType, setVaultType] = useState<VaultType>('FIXED_BILL');
  const [targetAmount, setTargetAmount] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = React.useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', 'vault-modal-title');
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== 'vault-modal-title') {
        node.setAttribute('aria-labelledby', 'vault-modal-title');
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, []);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setVaultType('FIXED_BILL');
    setTargetAmount('');
    setAllocatedAmount('');
    setTargetDate('');
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
      setErrorMsg('Nama tagihan / komitmen wajib diisi');
      return;
    }

    const parsedTarget = parseFloat(targetAmount);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setErrorMsg('Target biaya harus lebih besar dari 0');
      return;
    }

    const finalAllocated =
      allocatedAmount.trim() === '' ? parsedTarget : parseFloat(allocatedAmount) || 0;

    if (finalAllocated < 0) {
      setErrorMsg('Alokasi terkunci tidak boleh negatif');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiFetch('/vaults', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          vault_type: vaultType,
          target_amount: parsedTarget,
          allocated_amount: finalAllocated,
          target_date: targetDate.trim() ? targetDate.trim() : null,
        }),
      });

      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan komitmen vault.');
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
      disableAnimation
      classNames={{
        base: 'bg-slate-900 border border-slate-800 text-white',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <form
            onSubmit={handleSubmit}
            noValidate
            ref={(el) => {
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', 'vault-modal-title');
            }}
          >
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 id="vault-modal-title" className="font-semibold text-lg text-slate-100">Tambah Komitmen & Vault</h3>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                />
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
                  <label htmlFor="vault-name" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nama Tagihan / Komitmen
                  </label>
                  <input
                    id="vault-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Sewa Kos, Listrik PLN, Tabungan Darurat"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-400 mb-1.5">Tipe Pos</span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {VAULT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setVaultType(type)}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${
                          vaultType === type
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                            : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="target-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
                      Target Biaya (Rp)
                    </label>
                    <input
                      id="target-amount"
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="allocated-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
                      Alokasi Terkunci (Rp)
                    </label>
                    <input
                      id="allocated-amount"
                      type="number"
                      min="0"
                      step="any"
                      value={allocatedAmount}
                      onChange={(e) => setAllocatedAmount(e.target.value)}
                      placeholder="Sama dengan target"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="target-date" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
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
                  <span>Simpan Komitmen</span>
                )}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
