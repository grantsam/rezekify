import React from 'react';
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
      <button
        type="button"
        onClick={() => onViewChange('overview')}
        aria-label="Ringkasan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-1 ${
          activeView === 'overview' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Ringkasan</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('ledger')}
        aria-label="Buku Besar"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-1 ${
          activeView === 'ledger' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ReceiptText className="w-5 h-5" />
        <span className="text-[10px]">Buku Besar</span>
      </button>

      {/* Elevated center quick capture button */}
      <div className="relative -top-3">
        <button
          type="button"
          onClick={onQuickCapturePress}
          aria-label="Quick Capture"
          className="w-12 h-12 rounded-full bg-white text-zinc-950 shadow-lg shadow-white/10 hover:bg-zinc-200 active:scale-95 transition-transform flex items-center justify-center border border-zinc-200"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onViewChange('vaults')}
        aria-label="Vaults"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-1 ${
          activeView === 'vaults' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ShieldCheck className="w-5 h-5" />
        <span className="text-[10px]">Vaults</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('settings')}
        aria-label="Pengaturan"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-1 ${
          activeView === 'settings' ? 'text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">Pengaturan</span>
      </button>
    </nav>
  );
};
