import React from 'react';
import { Button } from '@heroui/react';
import { LayoutDashboard, ReceiptText, ShieldCheck, Settings, Plus } from 'lucide-react';

export interface BottomDockProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'settings') => void;
  onQuickCapturePress?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeView,
  onViewChange,
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
          activeView === 'overview' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
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
          activeView === 'ledger' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ReceiptText className="w-5 h-5" />
        <span className="text-[10px]">Buku Besar</span>
      </Button>

      {/* Elevated center quick capture button */}
      <div className="relative -top-3">
        <Button
          isIconOnly
          onPress={onQuickCapturePress}
          aria-label="Quick Capture"
          className="w-12 h-12 min-w-[48px] rounded-full bg-white text-zinc-950 shadow-lg shadow-white/10 hover:bg-zinc-200 active:scale-95 transition-transform flex items-center justify-center border border-zinc-200"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </Button>
      </div>

      <Button
        variant="light"
        onPress={() => onViewChange('vaults')}
        aria-label="Vaults"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'vaults' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ShieldCheck className="w-5 h-5" />
        <span className="text-[10px]">Vaults</span>
      </Button>

      <Button
        variant="light"
        onPress={() => onViewChange('settings')}
        aria-label="Pengaturan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'settings' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">Pengaturan</span>
      </Button>
    </nav>
  );
};
