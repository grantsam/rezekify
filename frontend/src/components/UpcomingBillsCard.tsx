import React from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, ShieldCheck } from 'lucide-react';
import { UpcomingBill } from '../types/api';

interface Props {
  bills?: UpcomingBill[];
  isLoading?: boolean;
}

export const UpcomingBillsCard: React.FC<Props> = ({ bills = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        data-testid="upcoming-bills-skeleton"
        aria-busy="true"
        className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-3xl p-5 mb-6 animate-pulse select-none"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-64 bg-slate-200 dark:bg-[#042421] rounded-xl" />
          <div className="h-5 w-32 bg-slate-200 dark:bg-[#042421] rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-16 bg-slate-100 dark:bg-[#021D17]/60 border border-slate-200 dark:border-white/10 rounded-2xl" />
          <div className="h-16 bg-slate-100 dark:bg-[#021D17]/60 border border-slate-200 dark:border-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  const urgentBills = bills.filter((b) => b.days_until_due <= 7);
  if (urgentBills.length === 0) {
    return (
      <div
        data-testid="upcoming-bills-empty"
        className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 mb-6 text-zinc-300 shadow-sm flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">Semua Komitmen Aman</h4>
            <p className="text-xs text-zinc-400 mt-0.5">Tidak ada tagihan atau komitmen jatuh tempo dalam 7 hari kedepan.</p>
          </div>
        </div>
        <Chip size="sm" variant="flat" color="success" className="text-xs font-medium shrink-0">
          H-7 Bersih
        </Chip>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6 select-none"
    >
      <Card className="bg-amber-500/10 dark:bg-amber-950/40 border-2 border-amber-500/30 rounded-[28px] text-slate-900 dark:text-amber-200 shadow-xl shadow-amber-500/5 relative overflow-hidden text-left">
        <CardBody className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-amber-700 dark:text-amber-300 text-xs sm:text-sm uppercase tracking-wide">
                Pengingat Tagihan & Komitmen Mendesak (H-7)
              </h3>
            </div>
            <Chip
              size="sm"
              variant="flat"
              className="border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold"
            >
              {urgentBills.length} tagihan butuh perhatian
            </Chip>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentBills.map((bill) => {
              const shortage = bill.target_amount - bill.allocated_amount;
              const isUrgent = bill.days_until_due <= 3;
              return (
                <div
                  key={bill.name}
                  className={`bg-white/80 dark:bg-[#021D17]/70 backdrop-blur-md border p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs transition-all ${
                    isUrgent ? 'border-rose-500/50 shadow-rose-500/5' : 'border-slate-200/80 dark:border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{bill.name}</p>
                      {isUrgent ? (
                        <span className="inline-flex items-center bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-lg shrink-0">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse inline-block mr-1.5" />
                          H-{bill.days_until_due}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-lg shrink-0">
                          H-{bill.days_until_due}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-amber-200/80 font-medium flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      Jatuh tempo: <strong className={isUrgent ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'font-extrabold text-slate-700 dark:text-slate-200'}>{bill.days_until_due} hari lagi</strong> ({bill.target_date})
                    </p>
                  </div>

                  <div className="text-right whitespace-nowrap shrink-0">
                    <span
                      className={`text-xs block font-extrabold font-mono tabular-nums ${
                        shortage > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#0F766E] dark:text-[#10B981]'
                      }`}
                    >
                      {shortage > 0
                        ? `Kurang Rp ${shortage.toLocaleString('id-ID')}`
                        : 'Teralokasi Penuh'}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium tabular-nums block mt-0.5">
                      Target: Rp {bill.target_amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
};