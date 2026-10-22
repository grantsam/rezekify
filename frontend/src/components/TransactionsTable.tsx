import React, { useState, useEffect, useRef } from 'react';
import { Trash2, ArrowUpRight, ArrowDownLeft, Clock, Pencil, Search, X, Lock } from 'lucide-react';
import { Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, Category, Transaction, TransactionFilterParams, Vault } from '../types/api';
import { formatRupiah } from '../utils/formatters';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (tx: Transaction) => void;
  isLoading?: boolean;
  accounts?: Account[];
  categories?: Category[];
  vaults?: Vault[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  onParamsChange?: (params: TransactionFilterParams) => void;
  onPageChange?: (page: number) => void;
}

const DATE_FILTERS: { key: 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'TODAY', label: 'Hari Ini' },
  { key: '7DAYS', label: '7 Hari Terakhir' },
  { key: 'THIS_MONTH', label: 'Bulan Ini' },
];

export const TransactionsTable: React.FC<Props> = ({
  transactions,
  onDelete,
  onEdit,
  isLoading,
  accounts,
  categories,
  vaults,
  total,
  page,
  pageSize = 20,
  totalPages,
  onParamsChange,
  onPageChange,
}) => {
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'>('ALL');

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  const skipDebounceRef = useRef(false);

  const latestParamsRef = useRef({
    selectedAccount,
    selectedCategory,
    dateFilter,
    pageSize,
    onParamsChange,
  });

  useEffect(() => {
    latestParamsRef.current = {
      selectedAccount,
      selectedCategory,
      dateFilter,
      pageSize,
      onParamsChange,
    };
  });

  const getDateRange = (filterKey: 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'): { start_date?: string; end_date?: string } => {
    if (filterKey === 'ALL') return {};
    const now = new Date();
    if (filterKey === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    if (filterKey === '7DAYS') {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { start_date: start.toISOString(), end_date: now.toISOString() };
    }
    if (filterKey === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start_date: start.toISOString(), end_date: now.toISOString() };
    }
    return {};
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      const {
        onParamsChange: notify,
        selectedAccount: acc,
        selectedCategory: cat,
        dateFilter: df,
        pageSize: ps,
      } = latestParamsRef.current;

      if (notify) {
        const dates = getDateRange(df);
        notify({
          account_id: acc || undefined,
          category_id: cat || undefined,
          search: searchQuery.trim() || undefined,
          ...dates,
          page: 1,
          page_size: ps,
        });
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [searchQuery]);

  const handleAccountChange = (newAcc: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSelectedAccount(newAcc);
    if (onParamsChange) {
      const dates = getDateRange(dateFilter);
      onParamsChange({
        account_id: newAcc || undefined,
        category_id: selectedCategory || undefined,
        search: searchQuery.trim() || undefined,
        ...dates,
        page: 1,
        page_size: pageSize,
      });
    }
  };

  const handleCategoryChange = (newCat: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSelectedCategory(newCat);
    if (onParamsChange) {
      const dates = getDateRange(dateFilter);
      onParamsChange({
        account_id: selectedAccount || undefined,
        category_id: newCat || undefined,
        search: searchQuery.trim() || undefined,
        ...dates,
        page: 1,
        page_size: pageSize,
      });
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearSearch = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    skipDebounceRef.current = true;
    setSearchQuery('');
    if (onParamsChange) {
      const dates = getDateRange(dateFilter);
      onParamsChange({
        account_id: selectedAccount || undefined,
        category_id: selectedCategory || undefined,
        search: undefined,
        ...dates,
        page: 1,
        page_size: pageSize,
      });
    }
  };

  const handleDateFilterChange = (key: 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH') => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setDateFilter(key);
    if (onParamsChange) {
      const dates = getDateRange(key);
      onParamsChange({
        account_id: selectedAccount || undefined,
        category_id: selectedCategory || undefined,
        search: searchQuery.trim() || undefined,
        ...dates,
        page: 1,
        page_size: pageSize,
      });
    }
  };

  const displayTransactions = onParamsChange
    ? transactions
    : transactions.filter((tx) => {
        if (selectedAccount) {
          const hasAcc = tx.ledger_entries?.some((e) => e.account_id === selectedAccount);
          if (!hasAcc) return false;
        }

        if (selectedCategory) {
          const hasCat = tx.ledger_entries?.some((e) => e.category_id === selectedCategory);
          if (!hasCat) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchChannel = (tx.source_channel || '').toLowerCase().includes(q);
          if (!matchDesc && !matchChannel) {
            return false;
          }
        }

        if (dateFilter !== 'ALL') {
          const txDate = new Date(tx.transaction_date);
          const now = new Date();

          if (dateFilter === 'TODAY') {
            const isToday =
              txDate.getFullYear() === now.getFullYear() &&
              txDate.getMonth() === now.getMonth() &&
              txDate.getDate() === now.getDate();
            if (!isToday) return false;
          } else if (dateFilter === '7DAYS') {
            if (txDate.getTime() < Date.now() - 7 * 86400000) return false;
          } else if (dateFilter === 'THIS_MONTH') {
            const isThisMonth =
              txDate.getFullYear() === now.getFullYear() &&
              txDate.getMonth() === now.getMonth();
            if (!isThisMonth) return false;
          }
        }

        return true;
      });

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedAccount ||
    selectedCategory ||
    dateFilter !== 'ALL'
  );

  if (
    transactions.length === 0 &&
    !onParamsChange &&
    !hasActiveFilters &&
    !accounts?.length &&
    !categories?.length
  ) {
    return (
      <div className="bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] p-8 text-center text-slate-500 dark:text-slate-400 shadow-xl">
        <Clock className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
        <p className="text-sm font-extrabold text-slate-800 dark:text-white">Belum ada transaksi.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Gunakan Omni-Input bar di atas atau catat manual untuk memulai mutasi ledger.
        </p>
      </div>
    );
  }

  const currentPage = page ?? 1;
  const totalCount = total !== undefined ? total : displayTransactions.length;
  const totalPagesCount = totalPages !== undefined ? totalPages : Math.max(1, Math.ceil(totalCount / pageSize));

  const handlePageStep = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage < 1 || newPage > totalPagesCount) return;
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (onPageChange) {
      onPageChange(newPage);
    }
    if (onParamsChange) {
      const dates = getDateRange(dateFilter);
      onParamsChange({
        account_id: selectedAccount || undefined,
        category_id: selectedCategory || undefined,
        search: searchQuery.trim() || undefined,
        ...dates,
        page: newPage,
        page_size: pageSize,
      });
    }
  };

  const getTxDetails = (tx: Transaction) => {
    const dateStr = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const amount = tx.ledger_entries?.[0]?.amount ?? 0;
    const formattedAmount = formatRupiah(Math.abs(Number(amount)));

    const isAccountDebit = tx.ledger_entries?.some((e) => Boolean(e.account_id) && e.entry_type === 'DEBIT') ?? false;
    const isTransfer = (tx.ledger_entries?.filter((e) => Boolean(e.account_id)).length ?? 0) >= 2;
    const isSourceIncome =
      /gaji|income|pemasukan|terima|bonus|investasi|topup|salary/i.test(tx.description || '') ||
      /income/i.test(tx.source_channel || '');
    const isIncome = (isAccountDebit && !isTransfer) || isSourceIncome;

    const channelChipProps = {
      TELEGRAM: { color: 'primary' as const, label: 'Telegram' },
      AI_OMNI_INPUT: { color: 'secondary' as const, label: 'AI Omni-Input' },
      WEB_MANUAL: { color: 'default' as const, label: 'Manual' },
    }[tx.source_channel] || { color: 'default' as const, label: tx.source_channel };

    const catId = tx.ledger_entries?.find((e) => e.category_id)?.category_id;
    const category = categories?.find((c) => c.id === catId);

    const vaultId = tx.ledger_entries?.find((e) => Boolean(e.vault_id))?.vault_id;
    const linkedVault = vaultId
      ? (vaults?.find((v) => v.id === vaultId) || { id: vaultId, name: 'Pos Tagihan' })
      : null;

    return {
      dateStr,
      formattedAmount,
      isIncome,
      channelChipProps,
      category,
      linkedVault,
    };
  };

  return (
    <div className="bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] overflow-hidden text-slate-900 dark:text-white shadow-2xl shadow-black/5 select-none text-left">
      <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div>
          <h3 className="font-black text-base sm:text-lg">Riwayat Transaksi Ledger</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Pencatatan ganda deterministik & reversal otomatis</p>
        </div>
        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          {totalCount} mutasi
        </span>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center bg-slate-50/50 dark:bg-zinc-900/40">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari transaksi atau channel..."
              aria-label="Cari transaksi"
              className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all shadow-xs min-h-[40px]"
            />
            {searchQuery && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleClearSearch}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-lg min-w-[28px] min-h-[28px] w-7 h-7 flex items-center justify-center transition-colors bg-transparent"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {accounts !== undefined && (
            <Select
              role="combobox"
              aria-label="Filter Akun"
              data-testid="filter-account-select"
              selectedKeys={[selectedAccount || 'ALL']}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                handleAccountChange(selected === 'ALL' ? '' : (selected || ''));
              }}
              disallowEmptySelection
              className="w-full sm:w-44"
              classNames={{
                trigger: 'bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                popoverContent: 'bg-white dark:bg-[#141417] border border-slate-200 dark:border-zinc-800/80 text-slate-900 dark:text-white',
                value: 'text-slate-900 dark:text-white text-xs font-bold',
              }}
            >
              {[
                <SelectItem
                  key="ALL"
                  textValue="Semua Akun"
                  className="text-slate-700 dark:text-slate-200 hover:bg-zinc-800/50 font-medium"
                >
                  Semua Akun
                </SelectItem>,
                ...(selectedAccount && selectedAccount !== 'ALL' && !accounts.some((a) => a.id === selectedAccount) ? [
                  <SelectItem key={selectedAccount} textValue={selectedAccount} className="text-slate-700 dark:text-slate-200">
                    {selectedAccount}
                  </SelectItem>
                ] : []),
                ...accounts.map((acc) => (
                  <SelectItem
                    key={acc.id}
                    textValue={acc.name}
                    className="text-slate-700 dark:text-slate-200 hover:bg-zinc-800/50 font-medium"
                  >
                    {acc.name}
                  </SelectItem>
                )),
              ]}
            </Select>
          )}

          {categories !== undefined && (
            <Select
              role="combobox"
              aria-label="Filter Kategori"
              data-testid="filter-category-select"
              selectedKeys={[selectedCategory || 'ALL']}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                handleCategoryChange(selected === 'ALL' ? '' : (selected || ''));
              }}
              disallowEmptySelection
              className="w-full sm:w-44"
              classNames={{
                trigger: 'bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-xs font-bold rounded-2xl min-h-[40px]',
                popoverContent: 'bg-white dark:bg-[#141417] border border-slate-200 dark:border-zinc-800/80 text-slate-900 dark:text-white',
                value: 'text-slate-900 dark:text-white text-xs font-bold',
              }}
            >
              {[
                <SelectItem
                  key="ALL"
                  textValue="Semua Kategori"
                  className="text-slate-700 dark:text-slate-200 hover:bg-zinc-800/50 font-medium"
                >
                  Semua Kategori
                </SelectItem>,
                ...(selectedCategory && selectedCategory !== 'ALL' && !categories.some((c) => c.id === selectedCategory) ? [
                  <SelectItem key={selectedCategory} textValue={selectedCategory} className="text-slate-700 dark:text-slate-200">
                    {selectedCategory}
                  </SelectItem>
                ] : []),
                ...categories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    textValue={cat.name}
                    className="text-slate-700 dark:text-slate-200 hover:bg-zinc-800/50 font-medium"
                  >
                    {cat.name}
                  </SelectItem>
                )),
              ]}
            </Select>
          )}
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-slate-200/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl self-start lg:self-auto shrink-0">
          {DATE_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={dateFilter === filter.key ? 'solid' : 'flat'}
              aria-pressed={dateFilter === filter.key}
              onPress={() => handleDateFilterChange(filter.key)}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all min-h-[36px] flex items-center justify-center ${
                dateFilter === filter.key
                  ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#10B981] bg-transparent'
              }`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Mobile Card-View Mode (<640px) */}
      <div data-testid="transactions-mobile-cards" className="block sm:hidden divide-y divide-slate-200/80 dark:divide-white/10">
        {displayTransactions.length === 0 ? (
          <div className="py-10 px-4 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
            {hasActiveFilters
              ? 'Tidak ada transaksi yang sesuai dengan filter pencarian.'
              : 'Belum ada transaksi.'}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayTransactions.map((tx) => {
              const { dateStr, formattedAmount, isIncome, channelChipProps, category, linkedVault } = getTxDetails(tx);

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 hover:bg-[#10B981]/5 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                          isIncome
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-white'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{tx.description}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{dateStr}</p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-black font-mono tabular-nums ${
                          isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isIncome ? `+ ${formattedAmount}` : `- ${formattedAmount}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="flat" color={channelChipProps.color} className="text-[10px] h-5 px-1.5 font-bold">
                        {channelChipProps.label}
                      </Chip>
                      {category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800/80">
                          {category.name}
                        </span>
                      )}
                      {linkedVault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          <Lock className="w-2.5 h-2.5" />
                          {linkedVault.name}
                        </span>
                      )}
                      <Chip
                        size="sm"
                        variant="flat"
                        color={isIncome ? 'success' : 'default'}
                        className="text-[10px] h-5 px-1.5 font-bold"
                      >
                        {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                      </Chip>
                    </div>

                    <div className="inline-flex items-center gap-1 shrink-0">
                      {onEdit && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => onEdit(tx)}
                          isDisabled={isLoading}
                          className="min-w-[34px] min-h-[34px] p-2 text-slate-400 hover:text-emerald-500 rounded-xl bg-transparent"
                          aria-label="Edit transaksi"
                          title="Edit transaksi"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => setTxToDelete(tx)}
                        isDisabled={isLoading}
                        className="min-w-[34px] min-h-[34px] p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-transparent"
                        aria-label="Hapus transaksi"
                        title="Hapus transaksi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Desktop Table (>=640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100/80 dark:bg-zinc-900/80 text-xs font-black text-slate-600 dark:text-zinc-400 border-b border-slate-200/80 dark:border-zinc-800/80">
            <tr>
              <th scope="col" className="py-4 px-6">Transaksi</th>
              <th scope="col" className="py-4 px-6 text-right">Nominal</th>
              <th scope="col" className="py-4 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800/80 text-xs sm:text-sm">
            {displayTransactions.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                  {hasActiveFilters
                    ? 'Tidak ada transaksi yang sesuai dengan filter pencarian.'
                    : 'Belum ada transaksi.'}
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {displayTransactions.map((tx) => {
                  const { dateStr, formattedAmount, isIncome, channelChipProps, category, linkedVault } = getTxDetails(tx);

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                              isIncome
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-white'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-slate-900 dark:text-white">{tx.description}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <span>{dateStr}</span>
                              <Chip size="sm" variant="flat" color={channelChipProps.color} className="text-[10px] h-5 px-1.5 font-bold">
                                {channelChipProps.label}
                              </Chip>
                              {category && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800/80">
                                  {category.name}
                                </span>
                              )}
                              {linkedVault && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                  <Lock className="w-2.5 h-2.5" />
                                  {linkedVault.name}
                                </span>
                              )}
                              <Chip
                                size="sm"
                                variant="flat"
                                color={isIncome ? 'success' : 'default'}
                                className="text-[10px] h-5 px-1.5 font-bold"
                              >
                                {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                              </Chip>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-black font-mono tabular-nums ${
                            isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isIncome ? `+ ${formattedAmount}` : `- ${formattedAmount}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onEdit && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => onEdit(tx)}
                              isDisabled={isLoading}
                              className="min-w-[34px] min-h-[34px] p-2 text-slate-400 hover:text-emerald-500 rounded-xl bg-transparent"
                              aria-label="Edit transaksi"
                              title="Edit transaksi"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => setTxToDelete(tx)}
                            isDisabled={isLoading}
                            className="min-w-[34px] min-h-[34px] p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-transparent"
                            aria-label="Hapus transaksi"
                            title="Hapus transaksi (otomatis kembalikan saldo)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar Footer */}
      <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400 font-bold bg-slate-50/50 dark:bg-zinc-900/40">
        <span>
          Halaman {currentPage} dari {totalPagesCount} ({totalCount} transaksi)
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            isDisabled={currentPage <= 1 || isLoading}
            onPress={() => handlePageStep(-1)}
            aria-label="Halaman Sebelumnya"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 min-h-[36px] px-4 rounded-xl text-xs disabled:opacity-40"
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="flat"
            isDisabled={currentPage >= totalPagesCount || isLoading}
            onPress={() => handlePageStep(1)}
            aria-label="Halaman Berikutnya"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 min-h-[36px] px-4 rounded-xl text-xs disabled:opacity-40"
          >
            Berikutnya
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Safety Modal */}
      <Modal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        backdrop="blur"
        classNames={{
          base: 'bg-white dark:bg-[#141417] border border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-white rounded-[28px] shadow-2xl',
          backdrop: 'bg-black/60 backdrop-blur-md',
          closeButton: 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Konfirmasi Hapus Transaksi</h3>
              </ModalHeader>
              <ModalBody>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium">
                  Apakah Anda yakin ingin menghapus transaksi <strong className="text-slate-900 dark:text-white font-extrabold">"{txToDelete?.description}"</strong>?
                </p>
                <p className="text-xs text-slate-500 dark:text-emerald-200/70 mt-1 font-medium">
                  Saldo rekening akan otomatis dikembalikan (reversal deterministik).
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  onPress={() => setTxToDelete(null)}
                  className="text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Batal
                </Button>
                <Button
                  color="danger"
                  onPress={async () => {
                    if (txToDelete) {
                      const id = txToDelete.id;
                      setTxToDelete(null);
                      await onDelete(id);
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 font-extrabold text-white rounded-xl text-xs shadow-md"
                >
                  Ya, Hapus
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};