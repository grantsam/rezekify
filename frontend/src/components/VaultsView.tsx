import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Plus, AlertCircle, PiggyBank } from 'lucide-react';
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Komitmen & Vaults
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Alokasi pos dana aman dan sinking funds untuk mengunci kas operasional.
          </p>
        </div>

        <Button
          size="sm"
          onPress={onOpenCreateVault}
          startContent={<Plus className="w-4 h-4" />}
          className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold min-h-[38px] rounded-xl text-xs"
        >
          + Tambah Vault
        </Button>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-xs sm:text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-zinc-400">
                Gagal Memproses Vault
              </p>
              <p className="text-zinc-200">{errorMessage}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="light"
            onPress={onDismissError}
            aria-label="Tutup pesan kesalahan"
            className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-lg bg-transparent"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] h-auto ${
            activeTab === 'ALL'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 bg-transparent'
          }`}
        >
          <span>Semua</span>
          <span className="text-[10px] py-0.5 px-2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countAll}
          </span>
        </Button>

        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('FIXED_BILL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] h-auto ${
            activeTab === 'FIXED_BILL'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 bg-transparent'
          }`}
        >
          <span>Tagihan Tetap</span>
          <span className="text-[10px] py-0.5 px-2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countBills}
          </span>
        </Button>

        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('SAVINGS')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] h-auto ${
            activeTab === 'SAVINGS'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 bg-transparent'
          }`}
        >
          <span>Tabungan</span>
          <span className="text-[10px] py-0.5 px-2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countSavings}
          </span>
        </Button>
      </div>

      {/* Bento Grid */}
      {filteredVaults.length === 0 ? (
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <PiggyBank className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-white mb-1">
            Belum ada komitmen atau vault aktif
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Buat pos tagihan rutin bulanan atau tabungan masa depan untuk mengamankan kas operasional Anda.
          </p>
          <Button
            size="sm"
            onPress={onOpenCreateVault}
            className="bg-white text-zinc-950 font-semibold rounded-xl text-xs min-h-[38px] px-4"
          >
            + Buat Vault Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
