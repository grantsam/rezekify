import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { PlusCircle, Calculator, Tag } from 'lucide-react';
import { Transaction, Account, Category, TransactionFilterParams } from '../types/api';
import { TransactionsTable } from './TransactionsTable';

export interface LedgerViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onParamsChange: (params: TransactionFilterParams) => void;
  onPageChange: (page: number) => void;
  onDeleteTransaction: (id: string) => Promise<void> | void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenManualModal: () => void;
  onOpenSimulateModal: () => void;
  onOpenCategoryModal: () => void;
  isLoading?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  accounts,
  categories,
  total,
  page,
  pageSize,
  totalPages,
  onParamsChange,
  onPageChange,
  onDeleteTransaction,
  onEditTransaction,
  onOpenManualModal,
  onOpenSimulateModal,
  onOpenCategoryModal,
  isLoading = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header with Title and Pro Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Buku Besar (Ledger)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pencatatan mutasi double-entry immutable dengan audit trail lengkap.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            onPress={onOpenCategoryModal}
            startContent={<Tag className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            + Kategori
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={onOpenSimulateModal}
            startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            Simulasi Belanja
          </Button>

          <Button
            size="sm"
            onPress={onOpenManualModal}
            startContent={<PlusCircle className="w-3.5 h-3.5" />}
            className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold min-h-[38px] rounded-xl text-xs"
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
