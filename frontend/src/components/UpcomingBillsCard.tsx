import React from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';
import { UpcomingBill } from '../types/api';

interface Props {
  bills: UpcomingBill[];
}

export const UpcomingBillsCard: React.FC<Props> = ({ bills }) => {
  const urgentBills = bills.filter((b) => b.days_until_due <= 7);
  if (urgentBills.length === 0) return null;

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-5 mb-6 text-amber-200 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-amber-300 text-sm uppercase tracking-wide">
            Pengingat Tagihan & Komitmen Mendesak (H-7)
          </h3>
        </div>
        <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-medium">
          {urgentBills.length} tagihan butuh perhatian
        </span>
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
                <p className="font-medium text-white text-sm">{bill.name}</p>
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
    </div>
  );
};
