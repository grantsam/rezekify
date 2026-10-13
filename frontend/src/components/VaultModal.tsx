import React, { useState, useEffect } from 'react';
import { Loader2, PiggyBank, Receipt, Lock, Pencil } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { Vault, VaultType } from '../types/api';
import { apiFetch, apiClient } from '../services/apiClient';

export interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vault?: Vault | null; // If provided, switches to EDIT mode
  initialVault?: Vault | null;
  mode?: 'create' | 'edit';
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
  vault,
  initialVault,
  mode,
}) => {
  const activeVault = vault ?? initialVault;
  const isEdit = mode === 'edit' || Boolean(activeVault);

  const [name, setName] = useState('');
  const [vaultType, setVaultType] = useState<VaultType>('FIXED_BILL');
  const [targetAmount, setTargetAmount] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && activeVault) {
      setName(activeVault.name || '');
      setVaultType(activeVault.vault_type || 'FIXED_BILL');
      setTargetAmount(activeVault.target_amount !== undefined ? activeVault.target_amount.toString() : '');
      setAllocatedAmount(activeVault.allocated_amount !== undefined ? activeVault.allocated_amount.toString() : '');
      setTargetDate(activeVault.target_date || '');
      setIsLocked(Boolean(activeVault.is_locked));
      setErrorMsg(null);
    } else if (!isEdit) {
      setName('');
      setVaultType('FIXED_BILL');
      setTargetAmount('');
      setAllocatedAmount('');
      setTargetDate('');
      setIsLocked(false);
      setErrorMsg(null);
    }
  }, [isEdit, activeVault, isOpen]);

  const titleId = isEdit ? 'edit-vault-modal-title' : 'vault-modal-title';

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

  if (!isOpen || (isEdit && !activeVault)) return null;

  const resetForm = () => {
    setName('');
    setVaultType('FIXED_BILL');
    setTargetAmount('');
    setAllocatedAmount('');
    setTargetDate('');
    setIsLocked(false);
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

    const parsedAllocated =
      allocatedAmount.trim() === ''
        ? (isEdit ? 0 : parsedTarget)
        : parseFloat(allocatedAmount);

    if (isNaN(parsedAllocated) || parsedAllocated < 0) {
      setErrorMsg('Alokasi terkunci tidak boleh negatif');
      return;
    }

    // Guard: Locked vaults cannot decrease allocated amount
    if (isEdit && activeVault?.is_locked && parsedAllocated < activeVault.allocated_amount) {
      setErrorMsg('Alokasi dana pada vault terkunci tidak boleh dikurangi');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEdit && activeVault) {
        await apiClient.updateVault(activeVault.id, {
          name: trimmedName,
          target_amount: parsedTarget,
          allocated_amount: parsedAllocated,
          target_date: targetDate.trim() ? targetDate.trim() : null,
        });
      } else {
        await apiFetch('/vaults', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
            vault_type: vaultType,
            target_amount: parsedTarget,
            allocated_amount: parsedAllocated,
            target_date: targetDate.trim() ? targetDate.trim() : null,
            is_locked: isLocked,
          }),
        });
      }

      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || (isEdit ? 'Gagal memperbarui komitmen vault.' : 'Gagal menyimpan komitmen vault.'));
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
        base: 'bg-white dark:bg-[#042421] border-2 border-[#10B981]/30 text-slate-900 dark:text-white rounded-[28px] shadow-2xl shadow-[#10B981]/10 text-left select-none',
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
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                    {isEdit ? (
                      <Pencil className="w-4 h-4" />
                    ) : vaultType === 'SAVINGS' ? (
                      <PiggyBank className="w-4 h-4" />
                    ) : (
                      <Receipt className="w-4 h-4" />
                    )}
                  </div>
                  <h3 id={titleId} className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                    {isEdit ? 'Edit Komitmen Vault' : 'Tambah Komitmen & Vault'}
                  </h3>
                </div>
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
              {isEdit && activeVault?.is_locked && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    Vault ini sedang terkunci. Anda dapat menambah alokasi, namun tidak dapat mengurangi alokasi di bawah dana saat ini.
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-300 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="vault-name" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                    Nama Tagihan / Komitmen
                    <span className="sr-only">Nama Komitmen</span>
                  </label>
                  <input
                    id="vault-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Sewa Kos, Listrik PLN, Tabungan Darurat"
                    className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-medium"
                  />
                </div>

                {!isEdit && (
                  <div>
                    <span className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">Tipe Pos</span>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#021D17] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 text-xs" role="radiogroup" aria-label="Tipe Pos">
                      {VAULT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                        <Button
                          key={type}
                          role="radio"
                          onPress={() => setVaultType(type)}
                          aria-checked={vaultType === type}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl font-extrabold transition-all min-h-[38px] ${
                            vaultType === type
                              ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                              : 'text-slate-600 dark:text-slate-400 hover:text-[#10B981] bg-transparent'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="target-amount" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                      Target Biaya (Rp)
                      <span className="sr-only">Target Nominal</span>
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
                      className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label htmlFor="allocated-amount" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                      Alokasi Terkunci (Rp)
                    </label>
                    <input
                      id="allocated-amount"
                      type="number"
                      min="0"
                      step="any"
                      value={allocatedAmount}
                      onChange={(e) => setAllocatedAmount(e.target.value)}
                      placeholder={isEdit ? '0' : 'Sama dengan target'}
                      className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="target-date" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white outline-none font-medium transition-all"
                  />
                </div>

                {!isEdit && (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#021D17]/60 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <Lock className={`w-4 h-4 ${isLocked ? 'text-[#10B981]' : 'text-slate-400'}`} />
                      <div>
                        <label htmlFor="is_locked_toggle" className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white cursor-pointer">
                          Kunci Dana Komitmen
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Cegah pengurangan alokasi dana secara tidak sengaja</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="is_locked_toggle"
                      checked={isLocked}
                      onChange={(e) => setIsLocked(e.target.checked)}
                      className="w-4 h-4 rounded text-[#10B981] focus:ring-[#10B981] bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-pointer accent-[#10B981]"
                    />
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-2">
              <Button
                variant="light"
                onPress={handleClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors min-h-[38px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                isDisabled={isSubmitting}
                className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#10B981]/25 px-5 min-h-[38px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      data-testid={isEdit ? 'edit-submit-loading-spinner' : 'submit-loading-spinner'}
                    />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Komitmen'}</span>
                )}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};