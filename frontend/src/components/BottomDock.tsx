import React from 'react';
import { Button } from '@heroui/react';
import { LayoutDashboard, ReceiptText, ShieldCheck, Settings, Sparkles } from 'lucide-react';

export interface BottomDockProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  upcomingBillsCount?: number;
  onQuickCapturePress?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeView,
  onViewChange,
  upcomingBillsCount,
  onQuickCapturePress,
}) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md bg-zinc-950/90 border-t border-zinc-800/80 h-16 px-4 flex items-center justify-between"
      aria-label="Navigasi Bawah"
    >
      <Button
        variant="light"
        onPress={() => onViewChange('overview')}
        aria-label="Ringkasan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'overview' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Ringkasan</span>
      </Button>

      <Button
        variant="light"
        onPress={() => onViewChange('ledger')}
        aria-label="Buku Besar"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'ledger' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ReceiptText className="w-5 h-5" />
        <span className="text-[10px]">Buku Besar</span>
      </Button>

      {/* Elevated center AI Copilot button */}
      <div className="relative -top-3">
        <Button
          isIconOnly
          onPress={() => {
            if (onQuickCapturePress) {
              onQuickCapturePress();
            } else {
              onViewChange('chat');
            }
          }}
          aria-label="AI Copilot"
          className="w-12 h-12 min-w-[48px] rounded-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform flex items-center justify-center border border-emerald-400/50"
        >
          <Sparkles className="w-6 h-6" />
        </Button>
      </div>

      <Button
        variant="light"
        onPress={() => onViewChange('vaults')}
        aria-label="Vaults"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'vaults' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <div className="relative">
          <ShieldCheck className="w-5 h-5" />
          {upcomingBillsCount !== undefined && upcomingBillsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-zinc-950" />
          )}
        </div>
        <span className="text-[10px]">Vaults</span>
      </Button>

      <Button
        variant="light"
        onPress={() => onViewChange('settings')}
        aria-label="Pengaturan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'settings' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">Pengaturan</span>
      </Button>
    </nav>
  );
};
