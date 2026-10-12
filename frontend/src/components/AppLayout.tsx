import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomDock } from './BottomDock';
import { NotificationBell } from './NotificationBell';
import { Account, UpcomingBill, User } from '../types/api';

export interface AppLayoutProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
  upcomingBills?: UpcomingBill[];
  user: User | null;
  onLogout: () => void;
  onOpenCreateAccount: () => void;
  onOpenSettings?: () => void;
  onQuickCapturePress?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeView,
  onViewChange,
  accounts,
  transactionCount,
  upcomingBills = [],
  user,
  onLogout,
  onOpenCreateAccount,
  onOpenSettings,
  onQuickCapturePress,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const upcomingBillsCount = upcomingBills.length;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-zinc-800 selection:text-white">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        accounts={accounts}
        transactionCount={transactionCount}
        upcomingBillsCount={upcomingBillsCount}
        user={user}
        onLogout={onLogout}
        onOpenCreateAccount={onOpenCreateAccount}
        onOpenSettings={onOpenSettings}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Global Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-[#0c0c0e]/80 backdrop-blur-md border-b border-zinc-800/60">
          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/80">
              <span className="font-mono font-bold text-white text-xs">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">Rezekify</span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs text-zinc-500 font-medium capitalize">{activeView}</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell upcomingBills={upcomingBills} onViewChange={onViewChange} />
          </div>
        </header>

        {children}
      </div>

      {/* Mobile Fixed Bottom Dock */}
      <BottomDock
        activeView={activeView}
        onViewChange={onViewChange}
        upcomingBillsCount={upcomingBillsCount}
        onQuickCapturePress={onQuickCapturePress}
      />
    </div>
  );
};
