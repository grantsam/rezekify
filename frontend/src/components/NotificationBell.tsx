import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react';
import { Bell, ShieldCheck, ArrowRight } from 'lucide-react';
import { UpcomingBill } from '../types/api';
import { formatRupiah } from '../utils/formatters';

export interface NotificationBellProps {
  upcomingBills?: UpcomingBill[];
  onViewChange?: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  onNavigateToVaults?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  upcomingBills = [],
  onViewChange,
  onNavigateToVaults,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const count = upcomingBills.length;

  const handleShortcutClick = () => {
    setIsOpen(false);
    if (onNavigateToVaults) {
      onNavigateToVaults();
    } else if (onViewChange) {
      onViewChange('vaults');
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      placement="bottom-end"
      offset={10}
      showArrow
    >
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          aria-label={
            count > 0
              ? `Notifikasi Tagihan: ${count} belum dibayar`
              : 'Notifikasi Tagihan: Tidak ada tagihan mendesak'
          }
          className="relative min-w-[38px] min-h-[38px] text-zinc-400 hover:text-white bg-transparent transition-colors"
        >
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span
              data-testid="notification-badge"
              className="absolute -top-1 -right-1 bg-amber-500 text-amber-950 font-bold text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ring-2 ring-[#0c0c0e]"
            >
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-4 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl">
        <div className="w-full space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="font-semibold text-xs text-white">
              Tagihan Mendatang (H-7)
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                count > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {count > 0 ? `${count} Perlu Perhatian` : 'Semua Aman'}
            </span>
          </div>

          {/* Content */}
          {count === 0 ? (
            <div data-testid="notification-empty" className="flex flex-col items-center justify-center py-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-200">Semua Komitmen Aman</p>
              <p className="text-[11px] text-zinc-400">Tidak ada tagihan mendesak dalam 7 hari ke depan.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {upcomingBills.map((bill, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">{bill.name}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span>Terkumpul: {formatRupiah(bill.allocated_amount)}</span>
                      <span>/</span>
                      <span>{formatRupiah(bill.target_amount)}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border shrink-0 ${
                      bill.days_until_due <= 1
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {bill.days_until_due === 0 ? 'Hari ini' : `H-${bill.days_until_due}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer Shortcut */}
          <div className="pt-2 border-t border-zinc-800">
            <Button
              size="sm"
              onPress={handleShortcutClick}
              endContent={<ArrowRight className="w-3.5 h-3.5" />}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[38px] rounded-xl text-xs font-semibold"
            >
              Buka Komitmen & Vaults
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
