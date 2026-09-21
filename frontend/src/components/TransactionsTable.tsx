import React, { useState } from 'react';
import { Trash2, ArrowUpRight, ArrowDownLeft, Clock, Pencil } from 'lucide-react';
import { Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { Transaction } from '../types/api';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (tx: Transaction) => void;
  isLoading?: boolean;
}

export const TransactionsTable: React.FC<Props> = ({ transactions, onDelete, onEdit, isLoading }) => {
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
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

              // Channel badge mapping with HeroUI Chip
              const channelChipProps = {
                TELEGRAM: { color: 'primary' as const, label: 'Telegram' },
                AI_OMNI_INPUT: { color: 'secondary' as const, label: 'AI Omni-Input' },
                WEB_MANUAL: { color: 'default' as const, label: 'Manual' },
              }[tx.source_channel] || { color: 'default' as const, label: tx.source_channel };

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
                          <Chip size="sm" variant="flat" color={channelChipProps.color} className="text-[10px] h-5 px-1">
                            {channelChipProps.label}
                          </Chip>
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
                          variant="light"
                          onPress={() => onEdit(tx)}
                          disabled={isLoading}
                          className="min-w-[40px] min-h-[40px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
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
                        disabled={isLoading}
                        className="min-w-[40px] min-h-[40px] p-2 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                        aria-label="Hapus transaksi"
                        title="Hapus transaksi (otomatis kembalikan saldo)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
