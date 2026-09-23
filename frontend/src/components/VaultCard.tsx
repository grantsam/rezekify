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

export interface VaultCardProps {
  vault: Vault;
  onToggleLock: (id: string) => Promise<void> | void;
  onEdit: (vault: Vault) => void;
  onDelete: (id: string) => Promise<void> | void;
  isTogglingLock?: boolean;
  isDeleting?: boolean;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

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
      className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between gap-4"
    >
      {/* Header with Type Badge, Lock Status & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
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
              className="text-xs"
            >
              {isFixedBill ? 'Tagihan Tetap' : 'Tabungan'}
            </Chip>

            {vault.is_locked && (
              <Chip
                size="sm"
                variant="flat"
                color="secondary"
                startContent={<Lock className="w-3 h-3" />}
                className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"
              >
                Terkunci
              </Chip>
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-100 truncate" title={vault.name}>
            {vault.name}
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle Lock */}
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={() => onToggleLock(vault.id)}
            isDisabled={isTogglingLock}
            disabled={isTogglingLock}
            aria-label={vault.is_locked ? 'Buka kunci vault' : 'Kunci vault'}
            title={vault.is_locked ? 'Buka kunci alokasi vault' : 'Kunci alokasi vault'}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors border disabled:opacity-50 ${
              vault.is_locked
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
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
            variant="flat"
            onPress={() => onEdit(vault)}
            aria-label="Ubah vault"
            title="Ubah detail vault"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </Button>

          {/* Delete (Disabled if locked) */}
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={() => {
              if (!vault.is_locked) {
                onDelete(vault.id);
              }
            }}
            isDisabled={vault.is_locked || isDeleting}
            disabled={vault.is_locked || isDeleting}
            aria-label="Hapus vault"
            title={vault.is_locked ? 'Vault terkunci tidak dapat dihapus' : 'Hapus vault'}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-950 disabled:hover:text-slate-400 disabled:hover:border-slate-800"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Progress & Amounts */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <div className="flex items-baseline gap-1 text-slate-400">
            <span>Terkumpul:</span>
            <span className="font-semibold text-slate-200 tabular-nums font-mono">
              {formatCurrency(allocated)}
            </span>
          </div>
          <div className="flex items-baseline gap-1 text-slate-400">
            <span>Target:</span>
            <span className="font-semibold text-slate-200 tabular-nums font-mono">
              {formatCurrency(target)}
            </span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full bg-slate-950 border border-slate-800/80 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              isComplete
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
          <span className="font-medium text-slate-300 tabular-nums font-mono">
            {percentage}%
          </span>
          {vault.target_date && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(vault.target_date)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
