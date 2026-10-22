import React from 'react';
import { Button } from '@heroui/react';
import {
  LayoutDashboard,
  Sparkles,
  ReceiptText,
  ShieldCheck,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Building2,
  Wallet,
  Coins,
  CreditCard,
} from 'lucide-react';
import { Account, User } from '../types/api';
import { formatRupiah } from '../utils/formatters';

// @ts-ignore
import rezekifyLogo from '../assets/icon_text_rezekify.png';
// @ts-ignore
import rezekifyIcon from '../assets/icon_rezekify.png';

export interface SidebarProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
  upcomingBillsCount?: number;
  user: User | null;
  onLogout: () => void;
  onOpenCreateAccount: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  accounts,
  transactionCount,
  upcomingBillsCount,
  user,
  onLogout,
  onOpenCreateAccount,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  isDarkMode = true,
  onToggleTheme,
  onOpenProfile,
}) => {
  const getUserInitials = (name?: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase() || 'U';
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK':
        return Building2;
      case 'EWALLET':
        return Wallet;
      case 'CASH':
        return Coins;
      case 'LIABILITY':
        return CreditCard;
      default:
        return Wallet;
    }
  };

  const navItems = [
    { id: 'overview' as const, label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'chat' as const, label: 'AI Copilot', icon: Sparkles },
    {
      id: 'ledger' as const,
      label: 'Buku Besar',
      icon: ReceiptText,
      badge: transactionCount !== undefined ? transactionCount : undefined,
    },
    {
      id: 'vaults' as const,
      label: 'Komitmen & Vaults',
      icon: ShieldCheck,
      badge: upcomingBillsCount !== undefined && upcomingBillsCount > 0 ? upcomingBillsCount : undefined,
    },
    { id: 'settings' as const, label: 'Pengaturan', icon: Settings },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col justify-between border-r border-slate-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-[#141417]/90 backdrop-blur-2xl fixed top-0 left-0 bottom-0 h-screen transition-all duration-300 select-none z-30 shrink-0 overflow-hidden ${
        isCollapsed ? 'w-24 p-3' : 'w-64 p-4'
      }`}
    >
      <div className="flex flex-col gap-5 overflow-y-auto overflow-x-hidden no-scrollbar flex-1 w-full">
        {/* Top Brand Logo & Toggle Button */}
        <div
          className={`flex items-center pb-3 border-b border-slate-200/60 dark:border-zinc-800/80 shrink-0 w-full ${
            isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center justify-center overflow-hidden">
            <span className="sr-only">Rezekify</span>
            {!isCollapsed ? (
              <img
                src={rezekifyLogo}
                alt="Rezekify Logo"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = rezekifyIcon;
                }}
              />
            ) : (
              <img
                src={rezekifyIcon}
                alt="Rezekify Icon"
                className="w-9 h-9 object-contain drop-shadow-sm"
              />
            )}
          </div>

          {onToggleCollapse && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onToggleCollapse}
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              className="p-1 min-w-[32px] min-h-[32px] text-slate-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-transparent rounded-xl"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2 shrink-0 items-center w-full" aria-label="Menu Utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <Button
                key={item.id}
                variant="light"
                onPress={() => {
                  if (item.id === 'settings' && onOpenSettings) {
                    onOpenSettings();
                  }
                  onViewChange(item.id);
                }}
                title={item.label}
                className={`transition-all duration-200 font-bold ${
                  isCollapsed
                    ? 'w-12 h-12 min-w-[48px] p-0 rounded-2xl flex items-center justify-center mx-auto'
                    : 'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-xs min-h-[42px] h-auto'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20 border border-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-white hover:bg-zinc-800/50 bg-transparent'
                }`}
              >
                <div className="flex items-center justify-center gap-3 truncate">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] py-0.5 px-2 rounded-lg font-mono font-bold ${
                      item.id === 'vaults'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Account Balances Section */}
        {!isCollapsed ? (
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 flex-1 min-h-0">
            <div className="flex items-center justify-between px-1 shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Rekening Kas
              </span>
              <Button
                size="sm"
                variant="light"
                onPress={onOpenCreateAccount}
                aria-label="+ Rekening"
                className="p-1 min-h-[26px] text-[10px] font-extrabold text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 bg-transparent flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Rekening</span>
              </Button>
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-1 no-scrollbar">
              {accounts.filter((acc) => acc.is_active !== false).length === 0 ? (
                <span className="text-xs text-slate-400 italic px-2 py-1">Belum ada akun</span>
              ) : (
                accounts
                  .filter((acc) => acc.is_active !== false)
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 text-xs shadow-2xs shrink-0"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[100px]">
                        {acc.name}
                      </span>
                      <span className="text-slate-900 dark:text-emerald-400 font-mono font-bold tabular-nums">
                        Rp {acc.current_balance.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          /* Collapsed Mini Pips with Tooltip / Title */
          /* ponytail: Collapsed sidebar shows up to 4 active accounts. Upgrade to popover or expandable rail if accounts exceed 4. */
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 w-full" aria-label="Daftar Rekening Ringkas">
            {accounts.filter((a) => a.is_active !== false).slice(0, 4).map((acc) => {
              const Icon = getAccountIcon(acc.account_type);
              return (
                <div
                  key={acc.id}
                  title={`${acc.name}: ${formatRupiah(acc.current_balance)}`}
                  aria-label={`${acc.name}: ${formatRupiah(acc.current_balance)}`}
                  className="w-10 h-10 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-all relative group"
                >
                  <Icon className="w-4 h-4 text-emerald-500" />
                  <span className="sr-only">{acc.name}: {formatRupiah(acc.current_balance)}</span>
                </div>
              );
            })}
            {onOpenCreateAccount && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onOpenCreateAccount}
                title="Tambah Rekening"
                aria-label="Tambah Rekening Baru"
                className="w-8 h-8 min-w-[32px] min-h-[32px] text-slate-400 hover:text-emerald-500 rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer: User profile, Theme Toggle, & Logout */}
      <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 shrink-0 w-full overflow-hidden">
        {!isCollapsed && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border ${
              user?.telegram_chat_id
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                user?.telegram_chat_id ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="truncate">{user?.telegram_chat_id ? 'Telegram Terhubung' : 'Telegram Off'}</span>
          </div>
        )}

        <div
          className={`flex items-center w-full ${
            isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between gap-1'
          }`}
        >
          {/* User Profile Trigger */}
          <div
            onClick={onOpenProfile}
            role="button"
            tabIndex={0}
            title="Buka Profil Pengguna"
            className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity p-1 rounded-xl"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
              {getUserInitials(user?.full_name)}
            </div>
            {!isCollapsed && (
              <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[90px]">
                {user?.full_name || 'Pengguna'}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-0.5'}`}>
            {onToggleTheme && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onToggleTheme}
                aria-label="Ubah Tema"
                title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
                className="p-1 min-w-[32px] min-h-[32px] text-slate-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-transparent rounded-xl"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </Button>
            )}

            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onLogout}
              aria-label="Keluar (Logout)"
              title="Keluar"
              className="p-1 min-w-[32px] min-h-[32px] text-slate-400 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 bg-transparent rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};