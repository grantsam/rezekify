import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { TransactionSummary } from '../types/api';

export interface ChatTransactionCardProps {
  transaction: TransactionSummary;
  onCancel: (id: string) => Promise<void> | void;
  onViewLedger?: () => void;
  isInitiallyCancelled?: boolean;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const ChatTransactionCard: React.FC<ChatTransactionCardProps> = ({
  transaction,
  onCancel,
  onViewLedger,
  isInitiallyCancelled = false,
}) => {
  const [isCancelled, setIsCancelled] = useState(Boolean(isInitiallyCancelled));
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    setIsCancelled(Boolean(isInitiallyCancelled));
  }, [isInitiallyCancelled]);

  const handleCancel = async () => {
    if (isCanceling || isCancelled) return;
    setIsCanceling(true);
    try {
      await onCancel(transaction.id);
      setIsCancelled(true);
    } catch (err) {
      console.error('Failed to cancel transaction:', err);
    } finally {
      setIsCanceling(false);
    }
  };

  const normalizedType = (transaction.type || 'EXPENSE').toUpperCase();
  let prefix = '- ';
  let amountColor = 'text-rose-600 dark:text-rose-400';

  if (normalizedType === 'INCOME') {
    prefix = '+ ';
    amountColor = 'text-[#0F766E] dark:text-[#10B981]';
  } else if (normalizedType === 'TRANSFER') {
    prefix = '↔ ';
    amountColor = 'text-sky-600 dark:text-sky-400';
  }

  return (
    <div className="bg-white/80 dark:bg-[#021D17]/80 backdrop-blur-md border border-slate-200/80 dark:border-[#10B981]/30 rounded-2xl p-4 space-y-3 transition-all shadow-md shadow-[#10B981]/5 max-w-sm text-left select-none">
      {/* Category and Account Pills */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-slate-100 dark:bg-[#021D17] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10">
            {transaction.category_name}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100/80 dark:bg-[#021D17]/60 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/5">
            {transaction.account_name}
          </span>
        </div>
        {isCancelled && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            Dibatalkan
          </span>
        )}
      </div>

      {/* Amount and Description */}
      <div>
        <div className={`text-lg sm:text-xl font-extrabold font-mono tabular-nums tracking-tight ${amountColor}`}>
          {prefix}{formatCurrency(transaction.amount)}
        </div>
        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 break-words">
          {transaction.description}
        </p>
      </div>

      {/* Sisa Saldo */}
      {transaction.account_balance_after != null && (
        <div className="text-xs text-slate-500 dark:text-emerald-200/80 font-medium flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-white/10">
          <span>Sisa saldo {transaction.account_name}:</span>
          <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(transaction.account_balance_after)}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {!isCancelled ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCanceling}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold min-h-[38px] text-rose-600 dark:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Batalkan Transaksi"
          >
            {isCanceling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Membatalkan...</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                <span>Batalkan Transaksi</span>
              </>
            )}
          </button>
        ) : null}

        {onViewLedger && (
          <button
            type="button"
            onClick={onViewLedger}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold min-h-[38px] text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#021D17] hover:bg-[#10B981]/15 hover:text-[#0F766E] dark:hover:text-[#10B981] border border-slate-200/80 dark:border-white/10 active:scale-[0.98] transition-all ml-auto"
            aria-label="Buka di Buku Besar"
          >
            <span>Buka di Buku Besar</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>
    </div>
  );
};