import React from 'react';
import { ArrowRight, Receipt, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Button } from '@heroui/react';
import { Transaction } from '../types/api';
import { formatRupiah } from '../utils/formatters';

export interface RecentTransactionsCardProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewAll?: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const RecentTransactionsCard: React.FC<RecentTransactionsCardProps> = ({
  transactions,
  isLoading = false,
  onViewAll,
}) => {
  const displayItems = transactions.slice(0, 5);

  return (
    <div className="w-full h-full bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] p-6 shadow-lg shadow-black/5 text-slate-900 dark:text-white flex flex-col justify-between select-none text-left transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-zinc-800/80 gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Transaksi Terakhir</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Mutasi pengeluaran & pemasukan terkini</p>
          </div>
        </div>

        {onViewAll && (
          <Button
            size="sm"
            variant="flat"
            onPress={onViewAll}
            endContent={<ArrowRight className="w-3.5 h-3.5" />}
            className="bg-slate-100 dark:bg-zinc-800 hover:bg-zinc-700 text-slate-700 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-zinc-800/80 min-h-[36px] rounded-xl text-xs font-bold px-3 transition-all"
          >
            Lihat Semua di Buku Besar
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/80 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
                    <div className="h-2.5 w-20 bg-slate-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                </div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center my-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Belum ada transaksi tercatat</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-xs mt-1">
              Mulai catat via AI Copilot atau menu Buku Besar.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 my-auto">
            {displayItems.map((tx) => {
              const txType = tx.type || (tx.ledger_entries?.some((e) => e.category_id) ? 'EXPENSE' : 'EXPENSE');
              const amount = tx.amount ?? tx.ledger_entries?.[0]?.amount ?? 0;
              const categoryName = tx.category_name;
              const accountName = tx.account_name;

              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        txType === 'INCOME'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : txType === 'TRANSFER'
                          ? 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {txType === 'INCOME' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : txType === 'TRANSFER' ? (
                        <ArrowLeftRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{tx.description || 'Tanpa keterangan'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {formatDate(tx.transaction_date || tx.created_at || '')}
                        </span>
                        {accountName && (
                          <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-zinc-800/80">
                            {accountName}
                          </span>
                        )}
                        {categoryName && (
                          <span className="text-[10px] bg-slate-100/80 dark:bg-zinc-900/80 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-zinc-800/60">
                            {categoryName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono tabular-nums font-bold ${
                        txType === 'INCOME'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : txType === 'TRANSFER'
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {txType === 'INCOME' ? '+ ' : txType === 'TRANSFER' ? '↔ ' : '- '}
                      {formatRupiah(Math.abs(amount))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};