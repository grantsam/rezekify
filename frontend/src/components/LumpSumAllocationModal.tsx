import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Sparkles, AlertCircle, CheckCircle2, AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import { Account, DistributionStrategy, Vault, VaultDistributeRequest } from '../types/api';
import { distributeToVaults } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';

export interface LumpSumAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vaults: Vault[];
  accounts: Account[];
}

const QUICK_CHIPS = [
  { label: '+500rb', amount: 500000 },
  { label: '+1jt', amount: 1000000 },
  { label: '+2.5jt', amount: 2500000 },
  { label: '+5jt', amount: 5000000 },
];

function getDeficit(v: Vault): number {
  return Math.max(0, (v.target_amount || 0) - (v.allocated_amount || 0));
}

// ponytail: deficit-weighted greedy allocation with integer rounding correction; upgrade to linear solver if multi-objective constraints arise.
export function calculatePriorityBillsDistribution(
  vaults: Vault[],
  totalAmount: number
): Record<string, number> {
  const allocations: Record<string, number> = {};
  vaults.forEach((v) => {
    allocations[v.id] = 0;
  });

  if (totalAmount <= 0 || !vaults.length) {
    return allocations;
  }

  let remaining = totalAmount;

  // Phase 1: Fixed bills ordered by closest target date
  const fixedBills = vaults
    .filter((v) => v.vault_type === 'FIXED_BILL')
    .slice()
    .sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return a.target_date.localeCompare(b.target_date);
    });

  for (const bill of fixedBills) {
    if (remaining <= 0) break;
    const deficit = getDeficit(bill);
    if (deficit > 0) {
      const allocated = Math.min(remaining, deficit);
      allocations[bill.id] = allocated;
      remaining -= allocated;
    }
  }

  // Phase 2: Remainder to SAVINGS proportional to deficit
  if (remaining > 0) {
    const savings = vaults.filter((v) => v.vault_type === 'SAVINGS');
    if (savings.length > 0) {
      const deficits: Record<string, number> = {};
      let totalSavingsDeficit = 0;
      for (const s of savings) {
        const def = getDeficit(s);
        deficits[s.id] = def;
        totalSavingsDeficit += def;
      }

      if (totalSavingsDeficit > 0) {
        let runningDistributed = 0;
        for (const s of savings) {
          const ratio = deficits[s.id] / totalSavingsDeficit;
          const share = Math.round(remaining * ratio);
          allocations[s.id] = (allocations[s.id] || 0) + share;
          runningDistributed += share;
        }
        const diff = remaining - runningDistributed;
        if (diff !== 0) {
          const largestSavings = savings.reduce(
            (max, s) => (deficits[s.id] > deficits[max.id] ? s : max),
            savings[0]
          );
          allocations[largestSavings.id] = (allocations[largestSavings.id] || 0) + diff;
        }
      } else {
        const baseShare = Math.round(remaining / savings.length);
        let runningDistributed = 0;
        for (const s of savings) {
          allocations[s.id] = (allocations[s.id] || 0) + baseShare;
          runningDistributed += baseShare;
        }
        const diff = remaining - runningDistributed;
        if (diff !== 0) {
          allocations[savings[0].id] = (allocations[savings[0].id] || 0) + diff;
        }
      }
    } else if (fixedBills.length > 0) {
      allocations[fixedBills[0].id] = (allocations[fixedBills[0].id] || 0) + remaining;
    }
  }

  return allocations;
}

export function calculateProportionalDistribution(
  vaults: Vault[],
  totalAmount: number
): Record<string, number> {
  const allocations: Record<string, number> = {};
  vaults.forEach((v) => {
    allocations[v.id] = 0;
  });

  if (totalAmount <= 0 || !vaults.length) {
    return allocations;
  }

  const deficits: Record<string, number> = {};
  let totalDeficit = 0;
  for (const v of vaults) {
    const def = getDeficit(v);
    deficits[v.id] = def;
    totalDeficit += def;
  }

  if (totalDeficit > 0) {
    let runningDistributed = 0;
    for (const v of vaults) {
      const ratio = deficits[v.id] / totalDeficit;
      const share = Math.round(totalAmount * ratio);
      allocations[v.id] = share;
      runningDistributed += share;
    }
    const diff = totalAmount - runningDistributed;
    if (diff !== 0) {
      const largest = vaults.reduce(
        (max, v) => (deficits[v.id] > deficits[max.id] ? v : max),
        vaults[0]
      );
      allocations[largest.id] += diff;
    }
  } else {
    const baseShare = Math.round(totalAmount / vaults.length);
    let runningDistributed = 0;
    for (const v of vaults) {
      allocations[v.id] = baseShare;
      runningDistributed += baseShare;
    }
    const diff = totalAmount - runningDistributed;
    if (diff !== 0) {
      allocations[vaults[0].id] += diff;
    }
  }

  return allocations;
}

export const LumpSumAllocationModal: React.FC<LumpSumAllocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vaults,
  accounts,
}) => {
  const [totalAmountStr, setTotalAmountStr] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [strategy, setStrategy] = useState<DistributionStrategy>('PRIORITY_BILLS');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const titleId = 'lump-sum-allocation-modal-title';

  useEffect(() => {
    if (isOpen) {
      setTotalAmountStr('');
      setSelectedAccountId('');
      setStrategy('PRIORITY_BILLS');
      setErrorMessage(null);
      const initial: Record<string, number> = {};
      vaults.forEach((v) => {
        initial[v.id] = 0;
      });
      setAllocations(initial);

      const timer = setTimeout(() => {
        const dialog =
          formRef.current?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.setAttribute('aria-labelledby', titleId);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vaults]);

  if (!isOpen) return null;

  const totalAmount = parseFloat(totalAmountStr) || 0;
  const totalAllocated = Object.values(allocations).reduce((sum, amt) => sum + (amt || 0), 0);
  const diff = totalAmount - totalAllocated;

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const isAccountSolvent = !selectedAccount || selectedAccount.current_balance >= totalAmount;

  const isSubmitDisabled =
    isSubmitting ||
    totalAmount <= 0 ||
    diff !== 0 ||
    !isAccountSolvent;

  const handleTotalChange = (val: string) => {
    setTotalAmountStr(val);
    setErrorMessage(null);
    const num = parseFloat(val) || 0;
    if (strategy === 'PRIORITY_BILLS') {
      setAllocations(calculatePriorityBillsDistribution(vaults, num));
    } else if (strategy === 'PROPORTIONAL') {
      setAllocations(calculateProportionalDistribution(vaults, num));
    }
  };

  const handleAddChip = (chipAmount: number) => {
    const current = parseFloat(totalAmountStr) || 0;
    const newTotal = current + chipAmount;
    setTotalAmountStr(newTotal.toString());
    setErrorMessage(null);
    if (strategy === 'PRIORITY_BILLS') {
      setAllocations(calculatePriorityBillsDistribution(vaults, newTotal));
    } else if (strategy === 'PROPORTIONAL') {
      setAllocations(calculateProportionalDistribution(vaults, newTotal));
    }
  };

  const handleStrategyChange = (newStrategy: DistributionStrategy) => {
    setStrategy(newStrategy);
    const total = parseFloat(totalAmountStr) || 0;
    if (newStrategy === 'PRIORITY_BILLS') {
      setAllocations(calculatePriorityBillsDistribution(vaults, total));
    } else if (newStrategy === 'PROPORTIONAL') {
      setAllocations(calculateProportionalDistribution(vaults, total));
    }
  };

  const handleVaultAllocChange = (vaultId: string, valStr: string) => {
    const val = Math.max(0, parseFloat(valStr) || 0);
    setStrategy('CUSTOM');
    setAllocations((prev) => ({
      ...prev,
      [vaultId]: val,
    }));
  };

  const handleFillDeficit = (vault: Vault) => {
    const deficit = getDeficit(vault);
    setStrategy('CUSTOM');
    setAllocations((prev) => ({
      ...prev,
      [vault.id]: deficit,
    }));
  };

  const handleAllocateRemainder = () => {
    if (diff <= 0) return;
    const targetVault =
      vaults.find(
        (v) =>
          v.vault_type === 'SAVINGS' &&
          getDeficit(v) > (allocations[v.id] || 0)
      ) || vaults[0];
    if (targetVault) {
      setStrategy('CUSTOM');
      setAllocations((prev) => ({
        ...prev,
        [targetVault.id]: (prev[targetVault.id] || 0) + diff,
      }));
    }
  };

  const handleClose = () => {
    setTotalAmountStr('');
    setSelectedAccountId('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const request: VaultDistributeRequest = {
        total_amount: totalAmount,
        source_account_id: selectedAccountId || null,
        allocations: vaults
          .map((v) => ({
            vault_id: v.id,
            amount: allocations[v.id] || 0,
          }))
          .filter((item) => item.amount > 0),
      };

      await distributeToVaults(request);
      await onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mendistribusikan dana ke vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-white dark:bg-[#141417] border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] shadow-2xl p-6 max-w-2xl w-full text-slate-900 dark:text-zinc-100 max-h-[90vh] flex flex-col',
        backdrop: 'bg-black/60 backdrop-blur-md',
      }}
    >
      <ModalContent>
        {() => (
          <form
            ref={(el) => {
              formRef.current = el;
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', titleId);
            }}
            onSubmit={handleSubmit}
            className="flex flex-col h-full space-y-5 overflow-hidden"
          >
            {/* Header */}
            <ModalHeader className="p-0 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-extrabold text-slate-900 dark:text-white">
                  Alokasi Lump-Sum Multi-Vault
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Distribusikan dana masuk (gaji/proyek) ke semua komitmen & tabungan sekaligus.
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="p-0 space-y-4 overflow-y-auto pr-1">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-300 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Input Nominal & Source Account */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Nominal Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="total-nominal-input"
                    className="text-xs font-bold text-slate-700 dark:text-zinc-300"
                  >
                    Total Nominal Dana
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-zinc-500">
                      Rp
                    </span>
                    <input
                      id="total-nominal-input"
                      type="number"
                      min="1"
                      step="any"
                      required
                      placeholder="Masukkan total nominal"
                      value={totalAmountStr}
                      onChange={(e) => handleTotalChange(e.target.value)}
                      className="w-full pl-11 pr-3 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px]"
                    />
                  </div>
                </div>

                {/* Source Account Selector */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="source-account-select"
                    className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Rekening Sumber</span>
                  </label>
                  <select
                    id="source-account-select"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px]"
                  >
                    <option value="">Pilih rekening sumber (opsional)</option>
                    {accounts
                      .filter((a) => a.is_active)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — {formatRupiah(acc.current_balance)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Quick Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleAddChip(chip.amount)}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-zinc-800/80 hover:bg-emerald-500/15 text-slate-700 dark:text-zinc-300 hover:text-emerald-500 border border-slate-200 dark:border-zinc-700/80 transition-all min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Solvency Warning */}
              {selectedAccount && !isAccountSolvent && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-300 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Saldo rekening tidak mencukupi untuk total alokasi ({formatRupiah(selectedAccount.current_balance)} tersedia).
                  </span>
                </div>
              )}

              {/* Step 2: Strategy Tabs */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Strategi Distribusi Otomatis
                </span>
                <div
                  role="tablist"
                  aria-label="Pilihan Strategi Distribusi"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 dark:bg-zinc-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={strategy === 'PRIORITY_BILLS'}
                    onClick={() => handleStrategyChange('PRIORITY_BILLS')}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[38px] flex items-center justify-center text-center cursor-pointer ${
                      strategy === 'PRIORITY_BILLS'
                        ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500'
                    }`}
                  >
                    Prioritas Tagihan (Bill First)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={strategy === 'PROPORTIONAL'}
                    onClick={() => handleStrategyChange('PROPORTIONAL')}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[38px] flex items-center justify-center text-center cursor-pointer ${
                      strategy === 'PROPORTIONAL'
                        ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500'
                    }`}
                  >
                    Prorata Target (Proportional)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={strategy === 'CUSTOM'}
                    onClick={() => handleStrategyChange('CUSTOM')}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[38px] flex items-center justify-center text-center cursor-pointer ${
                      strategy === 'CUSTOM'
                        ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500'
                    }`}
                  >
                    Kustom Manual
                  </button>
                </div>
              </div>

              {/* Step 3: Live Allocation Balance Status */}
              <div className="rounded-2xl border p-3.5 transition-all text-xs">
                {totalAmount <= 0 ? (
                  <div className="text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-emerald-500" />
                    <span>Masukkan nominal dana di atas untuk memulai kalkulasi alokasi.</span>
                  </div>
                ) : diff === 0 ? (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Alokasi Pas ({formatRupiah(totalAllocated)} / {formatRupiah(totalAmount)})</span>
                    </div>
                    <span className="text-[11px] font-mono bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                      100% Terdistribusi
                    </span>
                  </div>
                ) : diff > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-600 dark:text-amber-400 font-bold">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Sisa dana belum dialokasikan: {formatRupiah(diff)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAllocateRemainder}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all font-extrabold self-start sm:self-auto cursor-pointer min-h-[38px]"
                    >
                      Alokasikan Sisa
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Alokasi melebihi total dana sebesar {formatRupiah(Math.abs(diff))}</span>
                  </div>
                )}
              </div>

              {/* Step 4: Vault Allocation List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <span>Daftar Vault Target ({vaults.length})</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">
                    Total dialokasikan: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(totalAllocated)}</strong>
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {vaults.map((vault) => {
                    const currentAlloc = vault.allocated_amount || 0;
                    const target = vault.target_amount || 0;
                    const deficit = getDeficit(vault);
                    const allocAmount = allocations[vault.id] ?? 0;
                    const isBill = vault.vault_type === 'FIXED_BILL';

                    return (
                      <div
                        key={vault.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white truncate">
                              {vault.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                                isBill
                                  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {isBill ? 'Tagihan Tetap' : 'Tabungan'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                            <span>Terkumpul: {formatRupiah(currentAlloc)} / {formatRupiah(target)}</span>
                            {deficit > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                (Kurang {formatRupiah(deficit)})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {deficit > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFillDeficit(vault)}
                              className="text-[10px] px-2 py-1 rounded-xl bg-slate-200/80 dark:bg-zinc-800 hover:bg-emerald-500/10 text-slate-600 dark:text-zinc-300 hover:text-emerald-500 border border-slate-300/80 dark:border-zinc-700 font-bold transition-all shrink-0 min-h-[38px] cursor-pointer"
                              title="Penuhkan target defisit"
                            >
                              Penuhkan
                            </button>
                          )}
                          <div className="relative flex-1 sm:w-36">
                            <input
                              id={`alloc-${vault.id}`}
                              aria-label={`Alokasi ${vault.name}`}
                              type="number"
                              min="0"
                              step="any"
                              value={allocAmount.toString()}
                              onChange={(e) => handleVaultAllocChange(vault.id, e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-bold text-right text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[38px]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="p-0 pt-2 flex items-center justify-end gap-3 shrink-0">
              <Button
                type="button"
                variant="light"
                size="sm"
                onPress={handleClose}
                className="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-2xl min-h-[40px] px-4"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                isDisabled={isSubmitDisabled}
                isLoading={isSubmitting}
                className={`text-white font-extrabold rounded-2xl text-xs min-h-[40px] px-5 shadow-lg transition-all ${
                  isSubmitDisabled
                    ? 'bg-slate-300 dark:bg-zinc-800 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 shadow-emerald-900/20'
                }`}
              >
                Kunci & Alokasikan Dana
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};

export default LumpSumAllocationModal;
