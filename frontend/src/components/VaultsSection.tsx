import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@heroui/react';
import { Plus, PiggyBank, Receipt, Shield, Layers, AlertCircle, X } from 'lucide-react';
import { Vault, VaultType } from '../types/api';
import { VaultCard } from './VaultCard';

export interface VaultsSectionProps {
  vaults: Vault[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onDismissError?: () => void;
  onToggleLock: (id: string) => Promise<void> | void;
  onEdit: (vault: Vault) => void;
  onDelete: (id: string) => Promise<void> | void;
  onOpenCreate: () => void;
}

type TabType = 'ALL' | VaultType;

export const VaultsSection: React.FC<VaultsSectionProps> = ({
  vaults,
  isLoading = false,
  errorMessage,
  onDismissError,
  onToggleLock,
  onEdit,
  onDelete,
  onOpenCreate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggleLockWrapper = async (id: string) => {
    try {
      setTogglingId(id);
      await onToggleLock(id);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteWrapper = async (id: string) => {
    try {
      setDeletingId(id);
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const safeVaults = Array.isArray(vaults) ? vaults : [];
  const fixedBillsCount = safeVaults.filter((v) => v.vault_type === 'FIXED_BILL').length;
  const savingsCount = safeVaults.filter((v) => v.vault_type === 'SAVINGS').length;

  // ponytail: client-side tab filtering; add server-side pagination when vaults > 50
  const filteredVaults = safeVaults.filter((vault) => {
    if (activeTab === 'ALL') return true;
    return vault.vault_type === activeTab;
  });

  return (
    <section aria-labelledby="vaults-section-title" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <h2 id="vaults-section-title" className="text-lg font-bold text-slate-100">
              Komitmen & Vaults
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Kunci dana untuk tagihan rutin dan pos tabungan terencana agar runway tetap aman dari pengeluaran impulsif.
          </p>
        </div>

        <Button
          onPress={onOpenCreate}
          startContent={<Plus className="w-4 h-4" />}
          className="min-h-[38px] px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 font-medium rounded-xl text-xs text-white shrink-0 shadow-sm"
        >
          + Tambah Vault
        </Button>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Tutup pesan kesalahan"
              className="text-slate-400 hover:text-white p-1 rounded-md min-w-[28px] min-h-[28px] flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      {safeVaults.length > 0 && !isLoading && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Button
            size="sm"
            variant="flat"
            onPress={() => setActiveTab('ALL')}
            startContent={<Layers className="w-3.5 h-3.5" />}
            endContent={
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-[10px] text-slate-300 font-mono">
                {safeVaults.length}
              </span>
            }
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeTab === 'ALL'
                ? 'bg-slate-800 text-slate-100 border-slate-700 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Semua
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={() => setActiveTab('FIXED_BILL')}
            startContent={<Receipt className="w-3.5 h-3.5 text-amber-400" />}
            endContent={
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-[10px] text-slate-300 font-mono">
                {fixedBillsCount}
              </span>
            }
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeTab === 'FIXED_BILL'
                ? 'bg-slate-800 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Tagihan Tetap
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={() => setActiveTab('SAVINGS')}
            startContent={<PiggyBank className="w-3.5 h-3.5 text-emerald-400" />}
            endContent={
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-[10px] text-slate-300 font-mono">
                {savingsCount}
              </span>
            }
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeTab === 'SAVINGS'
                ? 'bg-slate-800 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Tabungan
          </Button>
        </div>
      )}

      {/* Content States */}
      {isLoading ? (
        <div
          data-testid="vaults-loading-skeleton"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 bg-slate-800 rounded-full" />
                <div className="h-8 w-20 bg-slate-800 rounded-xl" />
              </div>
              <div className="h-6 w-36 bg-slate-800 rounded-lg" />
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full bg-slate-800 rounded-full" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-slate-800 rounded" />
                  <div className="h-3 w-20 bg-slate-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : safeVaults.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 shadow-inner">
            <PiggyBank className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-semibold text-slate-100">
              Belum ada komitmen atau vault aktif
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kunci alokasi dana untuk pos penting seperti tagihan bulanan atau dana darurat agar tidak terpakai untuk belanja harian.
            </p>
          </div>

          <Button
            onPress={onOpenCreate}
            className="min-h-[38px] px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs rounded-xl shadow-sm"
          >
            + Buat Vault Pertama
          </Button>
        </div>
      ) : filteredVaults.length === 0 ? (
        /* Empty Filter State */
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
          Tidak ada vault dalam kategori ini.
        </div>
      ) : (
        /* Grid of VaultCards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredVaults.map((vault) => (
              <motion.div
                key={vault.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <VaultCard
                  vault={vault}
                  onToggleLock={handleToggleLockWrapper}
                  onEdit={onEdit}
                  onDelete={handleDeleteWrapper}
                  isTogglingLock={togglingId === vault.id}
                  isDeleting={deletingId === vault.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};
