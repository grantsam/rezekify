import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Plus, AlertCircle, PiggyBank, X, Sparkles } from 'lucide-react';
import { Account, Vault } from '../types/api';
import { VaultCard } from './VaultCard';

const DepositVaultModal = React.lazy(() => import('./DepositVaultModal').then(m => ({ default: m.DepositVaultModal })));
const PayBillModal = React.lazy(() => import('./PayBillModal').then(m => ({ default: m.PayBillModal })));
const LumpSumAllocationModal = React.lazy(() => import('./LumpSumAllocationModal').then(m => ({ default: m.LumpSumAllocationModal })));

export interface VaultsViewProps {
  vaults: Vault[];
  accounts?: Account[];
  isLoading: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onToggleLock: (id: string, is_locked?: boolean) => Promise<void> | void;
  onEditVault: (vault: Vault) => void;
  onDeleteVault: (id: string) => Promise<void> | void;
  onOpenCreateVault: () => void;
  onDepositVault?: (vault: Vault) => void;
  onPayBillVault?: (vault: Vault) => void;
  onDataMutated?: () => Promise<void> | void;
}

export const VaultsView: React.FC<VaultsViewProps> = ({
  vaults,
  accounts,
  isLoading: _isLoading,
  errorMessage,
  onDismissError,
  onToggleLock,
  onEditVault,
  onDeleteVault,
  onOpenCreateVault,
  onDepositVault,
  onPayBillVault,
  onDataMutated,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIXED_BILL' | 'SAVINGS'>('ALL');
  const [localDepositVault, setLocalDepositVault] = useState<Vault | null>(null);
  const [localPayBillVault, setLocalPayBillVault] = useState<Vault | null>(null);
  const [isLumpSumModalOpen, setIsLumpSumModalOpen] = useState(false);

  const handleDeposit = (vault: Vault) => {
    if (onDepositVault) {
      onDepositVault(vault);
    } else {
      setLocalDepositVault(vault);
    }
  };

  const handlePayBill = (vault: Vault) => {
    if (onPayBillVault) {
      onPayBillVault(vault);
    } else {
      setLocalPayBillVault(vault);
    }
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 rounded-[28px] shadow-xl shadow-black/5">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Komitmen & Vaults
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
            Alokasi pos dana aman dan sinking funds untuk mengunci kas operasional.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            onPress={() => setIsLumpSumModalOpen(true)}
            aria-label="Alokasikan Dana (Lump-Sum)"
            startContent={<Sparkles className="w-4 h-4 text-emerald-500" />}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold min-h-[40px] px-4 rounded-2xl text-xs border border-emerald-500/30 transition-all"
          >
            Alokasikan Dana (Lump-Sum)
          </Button>

          <Button
            size="sm"
            onPress={onOpenCreateVault}
            aria-label="+ Tambah Vault"
            startContent={<Plus className="w-4 h-4" />}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold min-h-[40px] px-5 rounded-2xl text-xs shadow-lg shadow-emerald-900/20 transition-all"
          >
            + Tambah Vault
          </Button>
        </div>
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
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800/80 pb-3 overflow-x-auto">
        <Button
          size="sm"
          variant="light"
          onPress={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all min-h-[38px] h-auto ${
            activeTab === 'ALL'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/20'
              : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-zinc-800/50 bg-transparent'
          }`}
        >
          <span>Semua</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
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
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/20'
              : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-zinc-800/50 bg-transparent'
          }`}
        >
          <span>Tagihan Tetap</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'FIXED_BILL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
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
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/20'
              : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-zinc-800/50 bg-transparent'
          }`}
        >
          <span>Tabungan</span>
          <span className={`text-[10px] py-0.5 px-2 rounded-lg font-mono ${
            activeTab === 'SAVINGS' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}>
            {countSavings}
          </span>
        </Button>
      </div>

      {/* Bento Grid */}
      {filteredVaults.length === 0 ? (
        <div className="bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-xl">
          <PiggyBank className="w-12 h-12 text-emerald-500 mb-3 stroke-[1.5]" />
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-1">
            Belum ada komitmen atau vault aktif
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 font-medium">
            Buat pos tagihan rutin bulanan atau tabungan masa depan untuk mengamankan kas operasional Anda.
          </p>
          <Button
            size="sm"
            onPress={onOpenCreateVault}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs min-h-[40px] px-5 shadow-lg shadow-emerald-900/20"
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
              onDeposit={handleDeposit}
              onPayBill={handlePayBill}
            />
          ))}
        </div>
      )}

      <React.Suspense fallback={null}>
        {accounts && localDepositVault && (
          <DepositVaultModal
            isOpen={Boolean(localDepositVault)}
            onClose={() => setLocalDepositVault(null)}
            onSuccess={async () => {
              setLocalDepositVault(null);
              await onDataMutated?.();
            }}
            vault={localDepositVault}
            accounts={accounts}
          />
        )}

        {accounts && localPayBillVault && (
          <PayBillModal
            isOpen={Boolean(localPayBillVault)}
            onClose={() => setLocalPayBillVault(null)}
            onSuccess={async () => {
              setLocalPayBillVault(null);
              await onDataMutated?.();
            }}
            vault={localPayBillVault}
            accounts={accounts}
          />
        )}

        <LumpSumAllocationModal
          isOpen={isLumpSumModalOpen}
          onClose={() => setIsLumpSumModalOpen(false)}
          onSuccess={async () => {
            setIsLumpSumModalOpen(false);
            await onDataMutated?.();
          }}
          vaults={vaults}
          accounts={accounts || []}
        />
      </React.Suspense>
    </motion.div>
  );
};