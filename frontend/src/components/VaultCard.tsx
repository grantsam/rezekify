import React from 'react';
import { motion } from 'framer-motion';
import { Chip, Button } from '@heroui/react';
import {
  Lock,
  Unlock,
  Pencil,
  Trash2,
  Calendar,
  PiggyBank,
  Receipt,
  Loader2,
} from 'lucide-react';
import { Vault } from '../types/api';
import { formatRupiah } from '../utils/formatters';

export interface VaultCardProps {
  vault: Vault;
  onToggleLock: (id: string) => Promise<void> | void;
  onEdit: (vault: Vault) => void;
  onDelete: (id: string) => Promise<void> | void;
  isTogglingLock?: boolean;
  isDeleting?: boolean;
}

// ponytail: simplified date display using native toLocaleDateString; add when relative date-fns needed
const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const VaultCard: React.FC<VaultCardProps> = ({
  vault,
  onToggleLock,
  onEdit,
  onDelete,
  isTogglingLock = false,
  isDeleting = false,
}) => {
  const target = vault.target_amount || 0;
  const allocated = vault.allocated_amount || 0;
  const percentage = target > 0 ? Math.min(100, Math.max(0, Math.round((allocated / target) * 100))) : 0;
  const isComplete = allocated >= target && target > 0;

  const isFixedBill = vault.vault_type === 'FIXED_BILL';

  return (
    <div
      data-testid={`vault-card-${vault.id}`}
      className="bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 hover:border-zinc-700/60 rounded-[28px] p-5 transition-all shadow-xl shadow-black/5 flex flex-col justify-between gap-4 text-left select-none"
    >
      {/* Header with Type Badge, Lock Status & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={isFixedBill ? 'warning' : 'success'}
              startContent={
                isFixedBill ? (
                  <Receipt className="w-3.5 h-3.5" />
                ) : (
                  <PiggyBank className="w-3.5 h-3.5" />
                )
              }
              className={`text-xs font-extrabold ${
                isFixedBill
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isFixedBill ? 'Tagihan Tetap' : 'Tabungan'}
            </Chip>

            {vault.is_locked && (
              <Chip
                size="sm"
                variant="flat"
                startContent={<Lock className="w-3 h-3" />}
                className="text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              >
                Terkunci
              </Chip>
            )}
          </div>

          <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate" title={vault.name}>
            {vault.name}
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle Lock */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => onToggleLock(vault.id)}
            isDisabled={isTogglingLock}
            aria-label={vault.is_locked ? 'Buka kunci vault' : 'Kunci vault'}
            title={vault.is_locked ? 'Buka kunci alokasi vault' : 'Kunci alokasi vault'}
            className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl transition-all border disabled:opacity-50 ${
              vault.is_locked
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-500'
            }`}
          >
            {isTogglingLock ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : vault.is_locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </Button>

          {/* Edit */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => onEdit(vault)}
            aria-label="Ubah vault"
            title="Ubah detail vault"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </Button>

          {/* Delete (Disabled if locked) */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => {
              if (!vault.is_locked) {
                onDelete(vault.id);
              }
            }}
            isDisabled={vault.is_locked || isDeleting}
            aria-label="Hapus vault"
            title={vault.is_locked ? 'Vault terkunci tidak dapat dihapus' : 'Hapus vault'}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Progress & Amounts */}
      <div className="space-y-2 bg-slate-50/80 dark:bg-zinc-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs">
        <div className="flex items-baseline justify-between text-xs font-medium">
          <div className="flex items-baseline gap-1 text-slate-500 dark:text-slate-400">
            <span>Terkumpul:</span>
            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums font-mono">
              {formatRupiah(allocated)}
            </span>
          </div>
          <div className="flex items-baseline gap-1 text-slate-500 dark:text-slate-400">
            <span>Target:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums font-mono">
              {formatRupiah(target)}
            </span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              isComplete
                ? 'bg-[#10B981]'
                : 'bg-gradient-to-r from-[#0F766E] to-[#10B981]'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5 font-bold">
          <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-mono font-black">
            {percentage}%
          </span>
          {vault.target_date && (
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{formatDate(vault.target_date)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};