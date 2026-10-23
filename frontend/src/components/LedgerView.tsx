import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { PlusCircle, Tag, Download } from 'lucide-react';
import { Transaction, Account, Category, TransactionFilterParams, Vault } from '../types/api';
import { downloadTransactionsCSV } from '../services/apiClient';
import { TransactionsTable } from './TransactionsTable';

export interface LedgerViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  vaults?: Vault[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeFilters?: TransactionFilterParams;
  onExportCSV?: () => Promise<void> | void;
  onParamsChange: (params: TransactionFilterParams) => void;
  onPageChange: (page: number) => void;
  onDeleteTransaction: (id: string) => Promise<void> | void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenManualModal: () => void;
  onOpenSimulateModal?: () => void;
  onOpenCategoryModal: () => void;
  isLoading?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  accounts,
  categories,
  vaults,
  total,
  page,
  pageSize,
  totalPages,
  activeFilters,
  onExportCSV,
  onParamsChange,
  onPageChange,
  onDeleteTransaction,
  onEditTransaction,
  onOpenManualModal,
  onOpenSimulateModal: _onOpenSimulateModal,
  onOpenCategoryModal,
  isLoading = false,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = async () => {
    if (onExportCSV) {
      await onExportCSV();
      return;
    }
    try {
      setIsExporting(true);
      await downloadTransactionsCSV(activeFilters);
    } catch (err) {
      console.error('Failed to export transactions CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6 text-left select-none"
    >
      {/* Header with Title and Pro Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 rounded-[28px] shadow-xl shadow-black/5">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Buku Besar (Ledger)
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
            Pencatatan mutasi double-entry immutable dengan audit trail lengkap.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            isLoading={isExporting}
            isDisabled={isExporting}
            onPress={handleExport}
            startContent={!isExporting ? <Download className="w-3.5 h-3.5 text-zinc-400" /> : undefined}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            Unduh CSV
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={onOpenCategoryModal}
            aria-label="+ Kategori"
            startContent={<Tag className="w-3.5 h-3.5 text-emerald-500" />}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold min-h-[40px] rounded-2xl text-xs border border-emerald-500/20 transition-all"
          >
            + Kategori
          </Button>

          <Button
            size="sm"
            onPress={onOpenManualModal}
            aria-label="+ Catat Manual"
            startContent={<PlusCircle className="w-4 h-4" />}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold min-h-[40px] rounded-2xl text-xs shadow-lg shadow-emerald-900/20 transition-all"
          >
            + Catat Manual
          </Button>
        </div>
      </div>

      {/* High-density Ledger Table with Multi-filter Toolbar */}
      <TransactionsTable
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        vaults={vaults}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onParamsChange={onParamsChange}
        onPageChange={onPageChange}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
        isLoading={isLoading}
      />
    </motion.div>
  );
};