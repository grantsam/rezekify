import React from 'react';
import { Button } from '@heroui/react';
import {
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { Account, User } from '../types/api';

export interface SidebarProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
  user: User | null;
  onLogout: () => void;
  onOpenCreateAccount: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  accounts,
  transactionCount,
  user,
  onLogout,
  onOpenCreateAccount,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const getUserInitials = (name?: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase() || 'U';
  };

  const navItems = [
    { id: 'overview' as const, label: 'Ringkasan', icon: LayoutDashboard },
    {
      id: 'ledger' as const,
      label: 'Buku Besar',
      icon: ReceiptText,
      badge: transactionCount !== undefined ? transactionCount : undefined,
    },
    { id: 'vaults' as const, label: 'Komitmen & Vaults', icon: ShieldCheck },
    { id: 'settings' as const, label: 'Pengaturan', icon: Settings },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col justify-between border-r border-zinc-800/80 bg-[#0c0c0e] h-screen sticky top-0 transition-all duration-200 select-none ${
        isCollapsed ? 'w-16 p-2' : 'w-60 p-4'
      }`}
    >
      <div className="flex flex-col gap-6">
        {/* Top Brand & Wordmark */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/80 shrink-0">
              <span className="font-mono font-bold text-white text-sm">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-base tracking-tight text-white truncate">
                Rezekify
              </span>
            )}
          </div>
          {onToggleCollapse && (
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="light"
              onPress={onToggleCollapse}
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              className="p-1 min-w-[32px] min-h-[32px] text-zinc-400 hover:text-white bg-transparent"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1" aria-label="Menu Utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'settings' && onOpenSettings) {
                    onOpenSettings();
                  }
                  onViewChange(item.id);
                }}
                title={item.label}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[38px] ${
                  isActive
                    ? 'bg-zinc-800/90 text-white border border-zinc-700/80 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && item.badge !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-400 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Account Balances Section */}
        {!isCollapsed && (
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Rekening Kas
              </span>
              <Button
                type="button"
                size="sm"
                variant="light"
                onPress={onOpenCreateAccount}
                aria-label="+ Rekening"
                className="p-1 min-h-[28px] text-[11px] text-zinc-400 hover:text-white bg-transparent flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Rekening</span>
              </Button>
            </div>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
              {accounts.filter((acc) => acc.is_active !== false).length === 0 ? (
                <span className="text-xs text-zinc-600 px-2 py-1">Belum ada akun</span>
              ) : (
                accounts
                  .filter((acc) => acc.is_active !== false)
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-xs"
                    >
                      <span className="text-zinc-300 truncate max-w-[100px]">{acc.name}</span>
                      <span className="text-white font-mono font-medium tabular-nums">
                        Rp {acc.current_balance.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: User profile, Telegram status, Logout */}
      <div className="flex flex-col gap-2 pt-3 border-t border-zinc-800/80">
        {!isCollapsed && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
              user?.telegram_chat_id
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                user?.telegram_chat_id ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span className="truncate">{user?.telegram_chat_id ? 'Terhubung' : 'Belum Terhubung'}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">
              {getUserInitials(user?.full_name)}
            </div>
            {!isCollapsed && (
              <span className="text-xs font-medium text-zinc-200 truncate max-w-[100px]">
                {user?.full_name || 'Pengguna'}
              </span>
            )}
          </div>
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="light"
            onPress={onLogout}
            aria-label="Keluar (Logout)"
            title="Keluar"
            className="p-1 min-w-[34px] min-h-[34px] text-zinc-400 hover:text-rose-400 bg-transparent"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
