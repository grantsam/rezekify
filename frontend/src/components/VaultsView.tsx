import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Plus, AlertCircle, PiggyBank, X } from 'lucide-react';
import { Vault } from '../types/api';
import { VaultCard } from './VaultCard';

export interface VaultsViewProps {
  vaults: Vault[];
  isLoading: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onToggleLock: (id: string, is_locked?: boolean) => Promise<void> | void;
  onEditVault: (vault: Vault) => void;
  onDeleteVault: (id: string) => Promise<void> | void;
  onOpenCreateVault: () => void;
}

export const VaultsView: React.FC<VaultsViewProps> = ({
  vaults,
  isLoading: _isLoading,
  errorMessage,
  onDismissError,
  onToggleLock,
  onEditVault,
  onDeleteVault,
  onOpenCreateVault,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIXED_BILL' | 'SAVINGS'>('ALL');

  const filteredVaults = vaults.filter((vault) => {
    if (activeTab === 'FIXED_BILL') return vault.vault_type === 'FIXED_BILL';
    if (activeTab === 'SAVINGS') return vault.vault_type === 'SAVINGS';
    return true;
  });

  const countAll = vaults.length;
  const countBills = vaults.filter((v) => v.vault_type === 'FIXED_BILL').length;
  const countSavings = vaults.filter((v) => v.vault_type === 'SAVINGS').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6 text-left select-none"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 dark:bg-[#042421]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-[#10B981]/30 p-5 rounded-[28px] shadow-xl shadow-[#10B981]/5">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Komitmen & Vaults
          </h2>
          <p className="text-xs text-slate-600 dark:text-emerald-200/80 font-medium mt-0.5">
            Alokasi pos dana aman dan sinking funds untuk mengunci kas operasional.
          </p>
        </div>

        <Button
          size="sm"
          onPress={onOpenCreateVault}
          startContent={<Plus className="w-4 h-4" />}
          className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold min-h-[40px] px-5 rounded-2xl text-xs shadow-lg shadow-[#10B981]/20 transition-all"
        >
          Tambah Vault
        </Button>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-2xl border bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 backdrop-blur-xl flex items-start justify-between gap-3 text-xs sm:text-sm shadow-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider mb-0.5 text-rose-700 dark:text-rose-400">
                Gagal Memproses Vault
              </p>
              <p className="text-slate-800 dark:text-rose-200 font-medium">{errorMessage}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="light"
            onPress={onDismissError}
            aria-label="Tutup pesan kesalahan"
            className="text-slate-500 hover:text-rose-600 dark:text-rose-300 dark:hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-xl bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/10 pb-3 overflow-x-auto">
        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all min-h-[38px] h-auto ${
            activeTab === 'ALL'
              ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#10B981] bg-transparent'
          }`}
        >
          <span>Semua</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-[#021D17] text-slate-700 dark:text-emerald-300'
          }`}>
            {countAll}
          </span>
        </Button>

        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('FIXED_BILL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all min-h-[38px] h-auto ${
            activeTab === 'FIXED_BILL'
              ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#10B981] bg-transparent'
          }`}
        >
          <span>Tagihan Tetap</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'FIXED_BILL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-[#021D17] text-slate-700 dark:text-emerald-300'
          }`}>
            {countBills}
          </span>
        </Button>

        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('SAVINGS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all min-h-[38px] h-auto ${
            activeTab === 'SAVINGS'
              ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#10B981] bg-transparent'
          }`}
        >
          <span>Tabungan</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'SAVINGS' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-[#021D17] text-slate-700 dark:text-emerald-300'
          }`}>
            {countSavings}
          </span>
        </Button>
      </div>

      {/* Bento Grid */}
      {filteredVaults.length === 0 ? (
        <div className="bg-white/80 dark:bg-[#042421]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-[#10B981]/30 rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-xl">
          <PiggyBank className="w-12 h-12 text-[#10B981] mb-3 stroke-[1.5]" />
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-1">
            Belum ada komitmen atau vault aktif
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 font-medium">
            Buat pos tagihan rutin bulanan atau tabungan masa depan untuk mengamankan kas operasional Anda.
          </p>
          <Button
            size="sm"
            onPress={onOpenCreateVault}
            className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold rounded-2xl text-xs min-h-[40px] px-5 shadow-lg shadow-[#10B981]/20"
          >
            Buat Vault Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVaults.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              onToggleLock={onToggleLock}
              onEdit={onEditVault}
              onDelete={onDeleteVault}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};