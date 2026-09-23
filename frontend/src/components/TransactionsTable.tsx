import React, { useState, useEffect, useRef } from 'react';
import { Trash2, ArrowUpRight, ArrowDownLeft, Clock, Pencil, Search, X } from 'lucide-react';
import { Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, Category, Transaction, TransactionFilterParams } from '../types/api';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (tx: Transaction) => void;
  isLoading?: boolean;
  accounts?: Account[];
  categories?: Category[];
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

  // Fallback client-side filtering when onParamsChange is not provided
  // ponytail: client-side filter ceiling is ~500 items; server-side queries handle larger volumes.
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Belum ada transaksi.</p>
        <p className="text-xs text-slate-400 mt-1">
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
    const formattedAmount = Number(amount).toLocaleString('id-ID');

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

    return {
      dateStr,
      formattedAmount,
      isIncome,
      channelChipProps,
      category,
    };
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden text-white shadow-xl">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Riwayat Transaksi Ledger</h3>
          <p className="text-xs text-slate-400 mt-0.5">Pencatatan ganda deterministik & reversal otomatis</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
          {totalCount} mutasi
        </span>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center bg-slate-950/20">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari transaksi atau channel..."
              aria-label="Cari transaksi"
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors min-h-[38px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md min-w-[28px] min-h-[28px] flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {accounts !== undefined && (
            <select
              aria-label="Filter Akun"
              value={selectedAccount}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:border-indigo-500 outline-none min-h-[38px] transition-colors cursor-pointer"
            >
              <option value="">Semua Akun</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.name}
                </option>
              ))}
            </select>
          )}

          {categories !== undefined && (
            <select
              aria-label="Filter Kategori"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:border-indigo-500 outline-none min-h-[38px] transition-colors cursor-pointer"
            >
              <option value="">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                  {cat.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl self-start lg:self-auto shrink-0">
          {DATE_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={dateFilter === filter.key ? 'solid' : 'flat'}
              color={dateFilter === filter.key ? 'primary' : 'default'}
              aria-pressed={dateFilter === filter.key}
              onPress={() => handleDateFilterChange(filter.key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all min-h-[38px] flex items-center justify-center ${
                dateFilter === filter.key
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Mobile Card-View Mode (<640px) */}
      <div data-testid="transactions-mobile-cards" className="block sm:hidden divide-y divide-slate-800/60">
        {displayTransactions.length === 0 ? (
          <div className="py-10 px-4 text-center text-slate-400 text-sm">
            {hasActiveFilters
              ? 'Tidak ada transaksi yang sesuai dengan filter pencarian.'
              : 'Belum ada transaksi.'}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayTransactions.map((tx) => {
              const { dateStr, formattedAmount, isIncome, channelChipProps, category } = getTxDetails(tx);

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 border border-slate-700/50 text-slate-300'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-white truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap shrink-0">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          isIncome ? 'text-emerald-400' : 'text-slate-100'
                        }`}
                      >
                        {isIncome ? `+ Rp ${formattedAmount}` : `- Rp ${formattedAmount}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="flat" color={channelChipProps.color} className="text-[10px] h-5 px-1">
                        {channelChipProps.label}
                      </Chip>
                      {category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/50">
                          {category.name}
                        </span>
                      )}
                      <Chip
                        size="sm"
                        variant="flat"
                        color={isIncome ? 'success' : 'default'}
                        className="text-[10px] h-5 px-1"
                      >
                        {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                      </Chip>
                    </div>

                    <div className="inline-flex items-center gap-1 shrink-0">
                      {onEdit && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={() => onEdit(tx)}
                          isDisabled={isLoading}
                          disabled={isLoading}
                          className="min-w-[38px] min-h-[38px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                          aria-label="Edit transaksi"
                          title="Edit transaksi"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        onPress={() => setTxToDelete(tx)}
                        isDisabled={isLoading}
                        disabled={isLoading}
                        className="min-w-[38px] min-h-[38px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                        aria-label="Hapus transaksi"
                        title="Hapus transaksi (otomatis kembalikan saldo)"
                      >
                        <Trash2 className="w-4 h-4" />
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
          <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/85 text-xs font-semibold text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold">Transaksi</th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold text-right">Nominal</th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {displayTransactions.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-10 px-4 text-center text-slate-400 text-sm">
                  {hasActiveFilters
                    ? 'Tidak ada transaksi yang sesuai dengan filter pencarian.'
                    : 'Belum ada transaksi.'}
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {displayTransactions.map((tx) => {
                  const { dateStr, formattedAmount, isIncome, channelChipProps, category } = getTxDetails(tx);

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isIncome
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 border border-slate-700/50 text-slate-300'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-white">{tx.description}</p>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 text-xs text-slate-400">
                              <span>{dateStr}</span>
                              <Chip size="sm" variant="flat" color={channelChipProps.color} className="text-[10px] h-5 px-1">
                                {channelChipProps.label}
                              </Chip>
                              {category && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/50">
                                  {category.name}
                                </span>
                              )}
                              <Chip
                                size="sm"
                                variant="flat"
                                color={isIncome ? 'success' : 'default'}
                                className="text-[10px] h-5 px-1"
                              >
                                {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                              </Chip>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isIncome ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isIncome ? `+ Rp ${formattedAmount}` : `- Rp ${formattedAmount}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 sm:gap-2">
                          {onEdit && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              onPress={() => onEdit(tx)}
                              isDisabled={isLoading}
                              disabled={isLoading}
                              className="min-w-[38px] min-h-[38px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                              aria-label="Edit transaksi"
                              title="Edit transaksi"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() => setTxToDelete(tx)}
                            isDisabled={isLoading}
                            disabled={isLoading}
                            className="min-w-[38px] min-h-[38px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
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
      <div className="p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/20">
        <span>
          Halaman {currentPage} dari {totalPagesCount} ({totalCount} transaksi)
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            isDisabled={currentPage <= 1 || isLoading}
            disabled={currentPage <= 1 || isLoading}
            onPress={() => handlePageStep(-1)}
            aria-label="Halaman Sebelumnya"
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 min-h-[38px] px-3.5 rounded-xl text-xs font-medium disabled:opacity-40 disabled:pointer-events-none"
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="flat"
            isDisabled={currentPage >= totalPagesCount || isLoading}
            disabled={currentPage >= totalPagesCount || isLoading}
            onPress={() => handlePageStep(1)}
            aria-label="Halaman Berikutnya"
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 min-h-[38px] px-3.5 rounded-xl text-xs font-medium disabled:opacity-40 disabled:pointer-events-none"
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
          base: 'bg-slate-900 border border-slate-800 text-white',
          backdrop: 'bg-black/75',
          closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <h3 className="font-semibold text-lg text-slate-100">Konfirmasi Hapus Transaksi</h3>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-slate-300">
                  Apakah Anda yakin ingin menghapus transaksi <strong className="text-white">"{txToDelete?.description}"</strong>?
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Saldo rekening akan otomatis dikembalikan (reversal deterministik).
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  onPress={() => setTxToDelete(null)}
                  className="text-slate-400 hover:text-white"
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
                  className="bg-rose-600 hover:bg-rose-500 font-medium text-white"
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
