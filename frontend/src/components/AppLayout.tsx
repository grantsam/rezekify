import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomDock } from './BottomDock';
import { NotificationBell } from './NotificationBell';
import { Account, UpcomingBill, User } from '../types/api';

export interface AppLayoutProps {
  children: React.ReactNode;
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
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
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
  isDarkMode,
  onToggleTheme,
  onOpenProfile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const upcomingBillsCount = upcomingBills.length;

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Desktop Fixed Sidebar */}
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
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onOpenProfile={onOpenProfile}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-6 relative z-10 transition-all duration-300 ${
          isCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {/* Global Header Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-white/70 dark:bg-[#141417]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-800/80">
          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">Rezekify</span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold capitalize">{activeView}</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell
              upcomingBills={upcomingBills}
              onViewChange={onViewChange}
              onNavigateToVaults={() => onViewChange('vaults')}
            />
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
