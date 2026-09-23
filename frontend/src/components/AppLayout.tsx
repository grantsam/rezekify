import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomDock } from './BottomDock';
import { Account, User } from '../types/api';

export interface AppLayoutProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
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
  user,
  onLogout,
  onOpenCreateAccount,
  onOpenSettings,
  onQuickCapturePress,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-zinc-800 selection:text-white">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        accounts={accounts}
        transactionCount={transactionCount}
        user={user}
        onLogout={onLogout}
        onOpenCreateAccount={onOpenCreateAccount}
        onOpenSettings={onOpenSettings}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {children}
      </div>

      {/* Mobile Fixed Bottom Dock */}
      <BottomDock
        activeView={activeView}
        onViewChange={onViewChange}
        onQuickCapturePress={onQuickCapturePress}
      />
    </div>
  );
};
