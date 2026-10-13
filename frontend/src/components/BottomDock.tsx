import React from 'react';
import { Button } from '@heroui/react';
import { LayoutDashboard, ReceiptText, ShieldCheck, Settings, Sparkles } from 'lucide-react';

export interface BottomDockProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  onQuickCapturePress?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeView,
  onViewChange,
  onQuickCapturePress,
}) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-white/80 dark:bg-[#042421]/90 border-t border-slate-200/80 dark:border-[#10B981]/20 h-16 px-4 flex items-center justify-between shadow-lg"
      aria-label="Navigasi Bawah"
    >
      <Button
        variant="light"
        onPress={() => onViewChange('overview')}
        aria-label="Ringkasan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent rounded-xl transition-all ${
          activeView === 'overview'
            ? 'text-[#10B981] font-extrabold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-[#10B981]'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Ringkasan</span>
      </Button>

      <Button
        variant="light"
        onPress={() => onViewChange('ledger')}
        aria-label="Buku Besar"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent rounded-xl transition-all ${
          activeView === 'ledger'
            ? 'text-[#10B981] font-extrabold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-[#10B981]'
        }`}
      >
        <ReceiptText className="w-5 h-5" />
        <span className="text-[10px]">Buku Besar</span>
      </Button>

      {/* Elevated center AI Copilot floating button */}
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
          className="w-13 h-13 min-w-[50px] min-h-[50px] rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white shadow-xl shadow-[#10B981]/30 active:scale-95 transition-all flex items-center justify-center border-2 border-white dark:border-[#021D17]"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
        </Button>
      </div>

      <Button
        variant="light"
        onPress={() => onViewChange('vaults')}
        aria-label="Vaults"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent rounded-xl transition-all ${
          activeView === 'vaults'
            ? 'text-[#10B981] font-extrabold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-[#10B981]'
        }`}
      >
        <ShieldCheck className="w-5 h-5" />
        <span className="text-[10px]">Vaults</span>
      </Button>

      <Button
        variant="light"
        onPress={() => onViewChange('settings')}
        aria-label="Pengaturan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent rounded-xl transition-all ${
          activeView === 'settings'
            ? 'text-[#10B981] font-extrabold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-[#10B981]'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">Pengaturan</span>
      </Button>
    </nav>
  );
};