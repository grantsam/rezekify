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
        // ponytail: direct update call; add transaction-backed reallocation history when ledger auditing required
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
        base: 'bg-[#141417] border border-zinc-800/80 text-zinc-100',
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
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    {isEdit ? (
                      <Pencil className="w-4 h-4" />
                    ) : vaultType === 'SAVINGS' ? (
                      <PiggyBank className="w-4 h-4" />
                    ) : (
                      <Receipt className="w-4 h-4" />
                    )}
                  </div>
                  <h3 id={titleId} className="font-semibold text-lg text-zinc-100">
                    {isEdit ? 'Edit Komitmen Vault' : 'Tambah Komitmen & Vault'}
                  </h3>
                </div>
                <Button
                  variant="light"
                  isIconOnly
                  onPress={handleClose}
                  aria-label="Tutup modal"
                  className="sr-only"
                />
              </div>
            </ModalHeader>

            <ModalBody>
              {isEdit && activeVault?.is_locked && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Vault ini sedang terkunci. Anda dapat menambah alokasi, namun tidak dapat mengurangi alokasi di bawah dana saat ini.
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="vault-name" className="block text-xs font-medium text-zinc-400 mb-1.5">
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
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                {!isEdit && (
                  <div>
                    <span className="block text-xs font-medium text-zinc-400 mb-1.5">Tipe Pos</span>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs" role="radiogroup" aria-label="Tipe Pos">
                      {VAULT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                        <Button
                          key={type}
                          onPress={() => setVaultType(type)}
                          aria-checked={vaultType === type}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all min-h-[38px] ${
                            vaultType === type
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                              : 'text-zinc-400 hover:text-white border border-transparent bg-transparent'
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
                    <label htmlFor="target-amount" className="block text-xs font-medium text-zinc-400 mb-1.5">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="allocated-amount" className="block text-xs font-medium text-zinc-400 mb-1.5">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="target-date" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                {!isEdit && (
                  <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center gap-2.5">
                      <Lock className={`w-4 h-4 ${isLocked ? 'text-amber-400' : 'text-zinc-400'}`} />
                      <div>
                        <label htmlFor="is_locked_toggle" className="text-sm font-medium text-white cursor-pointer">
                          Kunci Dana Komitmen
                        </label>
                        <p className="text-xs text-zinc-400">Cegah pengurangan alokasi dana secara tidak sengaja</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="is_locked_toggle"
                      checked={isLocked}
                      onChange={(e) => setIsLocked(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-800 border-zinc-700 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="light"
                onPress={handleClose}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
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
