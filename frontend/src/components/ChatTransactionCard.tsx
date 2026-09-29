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
  let amountColor = 'text-rose-400';

  if (normalizedType === 'INCOME') {
    prefix = '+ ';
    amountColor = 'text-emerald-400';
  } else if (normalizedType === 'TRANSFER') {
    prefix = '↔ ';
    amountColor = 'text-sky-400';
  }

  return (
    <div className="bg-[#18181b] sm:bg-[#141417] border border-zinc-800 rounded-xl p-3.5 space-y-3 transition-colors shadow-sm max-w-sm">
      {/* Category and Account Pills */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
            {transaction.category_name}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
            {transaction.account_name}
          </span>
        </div>
        {isCancelled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800/90 text-zinc-400 border border-zinc-700/60">
            <CheckCircle2 className="w-3 h-3 text-zinc-400" />
            Dibatalkan
          </span>
        )}
      </div>

      {/* Amount and Description */}
      <div>
        <div className={`text-lg sm:text-xl font-bold tracking-tight ${amountColor}`}>
          {prefix}{formatCurrency(transaction.amount)}
        </div>
        <p className="text-sm font-medium text-zinc-200 mt-0.5 break-words">
          {transaction.description}
        </p>
      </div>

      {/* Sisa Saldo */}
      {transaction.account_balance_after != null && (
        <div className="text-xs text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-800/70">
          <span>Sisa saldo {transaction.account_name}:</span>
          <span className="font-semibold text-zinc-200">
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
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[38px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
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
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[38px] text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 hover:text-white border border-zinc-700/70 active:scale-[0.98] transition-all ml-auto"
            aria-label="Buka di Buku Besar"
          >
            <span>Buka di Buku Besar</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  );
};
