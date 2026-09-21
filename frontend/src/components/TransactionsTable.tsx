import React from 'react';
import { Trash2, ArrowUpRight, ArrowDownLeft, Clock, Pencil } from 'lucide-react';
import { Transaction } from '../types/api';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (tx: Transaction) => void;
  isLoading?: boolean;
}

export const TransactionsTable: React.FC<Props> = ({ transactions, onDelete, onEdit, isLoading }) => {
  if (transactions.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Belum ada transaksi.</p>
        <p className="text-xs text-slate-500 mt-1">
          Gunakan Omni-Input bar di atas atau catat manual untuk memulai mutasi ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden text-white shadow-xl">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Riwayat Transaksi Ledger</h3>
          <p className="text-xs text-slate-400 mt-0.5">Pencatatan ganda deterministik & reversal otomatis</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
          {transactions.length} mutasi
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/50 text-xs font-semibold text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold">Transaksi</th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold text-right">Nominal</th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {transactions.map((tx) => {
              const dateStr = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              const channelBadge = {
                TELEGRAM: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                AI_OMNI_INPUT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                WEB_MANUAL: 'bg-slate-700/50 text-slate-300 border-slate-600/30',
              }[tx.source_channel] || 'bg-slate-800 text-slate-400 border-slate-700/40';

              // Derive amount from ledger entries
              const amount = tx.ledger_entries?.[0]?.amount ?? 0;
              const formattedAmount = Number(amount).toLocaleString('id-ID');

              // Distinguish income vs expense
              const isAccountDebit = tx.ledger_entries?.some((e) => Boolean(e.account_id) && e.entry_type === 'DEBIT') ?? false;
              const isTransfer = (tx.ledger_entries?.filter((e) => Boolean(e.account_id)).length ?? 0) >= 2;
              const isSourceIncome =
                /gaji|income|pemasukan|terima|bonus|investasi|topup|salary/i.test(tx.description || '') ||
                /income/i.test(tx.source_channel || '');
              const isIncome = (isAccountDebit && !isTransfer) || isSourceIncome;

              return (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
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
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>{dateStr}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] border ${channelBadge}`}>
                            {tx.source_channel}
                          </span>
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
                        <button
                          type="button"
                          onClick={() => onEdit(tx)}
                          disabled={isLoading}
                          className="min-w-[36px] min-h-[36px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                          aria-label="Edit transaksi"
                          title="Edit transaksi"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(tx.id)}
                        disabled={isLoading}
                        className="min-w-[36px] min-h-[36px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                        aria-label="Hapus transaksi"
                        title="Hapus transaksi (otomatis kembalikan saldo)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
