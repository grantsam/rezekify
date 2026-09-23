import React from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar } from 'lucide-react';
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
        className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5 mb-6 animate-pulse"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-64 bg-slate-800 rounded" />
          <div className="h-5 w-32 bg-slate-800 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-16 bg-slate-900/60 border border-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-900/60 border border-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const urgentBills = bills.filter((b) => b.days_until_due <= 7);
  if (urgentBills.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6"
    >
      <Card className="bg-amber-950/40 border border-amber-500/30 rounded-2xl text-amber-200 shadow-lg relative overflow-hidden">
        <CardBody className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-amber-300 text-sm uppercase tracking-wide">
                Pengingat Tagihan & Komitmen Mendesak (H-7)
              </h3>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="border border-amber-500/30 text-amber-300 font-medium"
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
                  className={`bg-slate-900/90 border p-3.5 rounded-xl flex items-center justify-between gap-3 ${
                    isUrgent ? 'border-rose-500/40' : 'border-amber-500/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">{bill.name}</p>
                      {isUrgent ? (
                        <span className="inline-flex items-center bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse inline-block mr-1.5" />
                          H-{bill.days_until_due}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          H-{bill.days_until_due}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-300/90 flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Jatuh tempo: <strong className={isUrgent ? 'text-rose-400 font-bold' : ''}>{bill.days_until_due} hari lagi</strong> ({bill.target_date})
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span
                      className={`text-xs block font-bold tabular-nums ${
                        shortage > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {shortage > 0
                        ? `Kurang Rp ${shortage.toLocaleString('id-ID')}`
                        : 'Teralokasi Penuh'}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums block mt-0.5">
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
