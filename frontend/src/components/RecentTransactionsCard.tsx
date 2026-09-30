import React from 'react';
import { ArrowRight, Receipt, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Button } from '@heroui/react';
import { Transaction } from '../types/api';

export interface RecentTransactionsCardProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewAll?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
    <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 shadow-xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-100">Transaksi Terakhir</h3>
            <p className="text-[11px] text-zinc-400">Mutasi pengeluaran & pemasukan terkini</p>
          </div>
        </div>

        {onViewAll && (
          <Button
            size="sm"
            variant="flat"
            onPress={onViewAll}
            endContent={<ArrowRight className="w-3.5 h-3.5" />}
            className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 min-h-[38px] rounded-xl text-xs font-medium px-3"
          >
            Lihat Semua di Buku Besar
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-zinc-800/40 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-zinc-800 rounded" />
                  <div className="h-2.5 w-20 bg-zinc-800/60 rounded" />
                </div>
              </div>
              <div className="h-4 w-24 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="py-8 text-center text-zinc-400">
          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
          <p className="text-xs font-medium text-zinc-300">
            Belum ada transaksi tercatat. Mulai catat via AI Copilot atau menu Buku Besar.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {displayItems.map((tx) => {
            // Determine type and amount
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
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : txType === 'TRANSFER'
                        ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
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
                    <p className="text-xs font-medium text-zinc-200 truncate">{tx.description || 'Tanpa keterangan'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatDate(tx.transaction_date || tx.created_at || '')}
                      </span>
                      {accountName && (
                        <span className="text-[10px] bg-zinc-800/80 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700/50">
                          {accountName}
                        </span>
                      )}
                      {categoryName && (
                        <span className="text-[10px] bg-zinc-800/60 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/40">
                          {categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-mono tabular-nums font-semibold ${
                      txType === 'INCOME'
                        ? 'text-emerald-400'
                        : txType === 'TRANSFER'
                        ? 'text-sky-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {txType === 'INCOME' ? '+ ' : txType === 'TRANSFER' ? '↔ ' : '- '}
                    Rp {formatCurrency(amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
