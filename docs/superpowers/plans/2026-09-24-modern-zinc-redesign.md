# Modern Zinc Studio UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Rezekify frontend into an ultra-clean, high-density Modern Zinc Studio financial terminal inspired by Linear, Raycast, and Monarch Money, replacing the single-page doomscroll with dedicated focused views, a precision 44px command bar, and responsive navigation shells.

**Architecture:**
- **Navigation Shell Layer**: Responsive `AppLayout` orchestrating desktop collapsible `Sidebar` (240px to 64px) and mobile fixed `BottomDock` (64px) driving tab-based view switching (`overview`, `ledger`, `vaults`, `settings`).
- **Command Bar Layer**: Precision 44px `QuickCaptureBar` replacing the 300px purple glowing hero with live audio frequency visualizer, drag-and-drop receipt dropzone, client-side canvas compression, and auto-dismissing floating toast notification.
- **Dedicated View Layer**: Telemetry-pure `OverviewView` (3 Hero metric tiles, 7-day spending vs safe runway bento row, H-7 upcoming commitments, mini-vaults), `LedgerView` (pro multi-filter toolbar, high-density table, mobile cards, server pagination), and `VaultsView` (virtual envelopes, sinking funds, padlock immutability).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, HeroUI (`@heroui/react`), Lucide React icons, Framer Motion (`framer-motion`), Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-modern-zinc-redesign-design.md`

## Global Constraints

- **Theme Tokens**: Root background `#0c0c0e`, card surface `#141417`, hairline borders `border-zinc-800/80` or `border-white/[0.08]`, zero neon glow.
- **Typography & Numbers**: Monospace fallback (`font-mono`) and `tabular-nums` for all currency amounts; Indonesian Rupiah format `Rp {amount.toLocaleString('id-ID')}`; `+ Rp` emerald for income, `- Rp` zinc-100 for expenses.
- **Touch & Motion Restraint**: Minimum touch targets `>= 38px` (primary `>= 40px` or `44px`); Framer Motion transitions strictly `<= 250ms` with `easeOut`.
- **Component Standards**: HeroUI `Button` with `onPress` (zero deprecated `onClick`), `Chip` with semantic status tokens.
- **Core Invariants**: Deterministic Python ledger math with `decimal.Decimal` ($\sum \text{Debit} = \sum \text{Credit}$), multi-tenant row isolation (`user_id = current_user_id`), locked vault deletion guard.

## Review Focus

1. **Quick capture whitespace submission**: User presses Enter or Ctrl+Enter on whitespace-only input without an attached file: Silently abort without triggering network requests or error banners (tested in Task 2, Step 1).
2. **Active audio recording cancellation**: User presses Esc or clicks Cancel button while recording: Immediately stop media tracks, clear intervals, reset audio chunks without sending payload (tested in Task 2, Step 1).
3. **Safe Runway calculation with zero accounts**: Overview view with zero accounts renders welcoming onboarding card with "+ Tambah Rekening Pertama" CTA rather than dividing by zero or throwing NaN (tested in Task 3, Step 1).
4. **Locked vault deletion guard**: In `VaultsView`, vaults marked `is_locked: true` have disabled delete actions to protect locked funds from accidental deletion (tested in Task 4, Step 1).
5. **View persistence and modal isolation**: Switching views in `AppLayout` maintains modal accessibility without unmounting background data or causing layout reflow (tested in Task 1, Step 1).

---

### Task 1: Navigation Shell Components (`Sidebar.tsx`, `BottomDock.tsx`, `AppLayout.tsx`)

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/BottomDock.tsx`
- Create: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/src/__tests__/NavigationShell.test.tsx`

**Interfaces:**
- Consumes:
  - `Account`, `User` from `../types/api`
  - HeroUI `Button`
  - Lucide icons: `LayoutDashboard`, `ReceiptText`, `ShieldCheck`, `Settings`, `Plus`, `ChevronLeft`, `ChevronRight`, `LogOut`, `Building2`
- Produces:
  - `Sidebar(props: SidebarProps): JSX.Element`
  - `BottomDock(props: BottomDockProps): JSX.Element`
  - `AppLayout(props: AppLayoutProps): JSX.Element`

- [x] **Step 1: Write failing test `frontend/src/__tests__/NavigationShell.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../components/Sidebar';
import { BottomDock } from '../components/BottomDock';
import { AppLayout } from '../components/AppLayout';
import { Account, User } from '../types/api';

describe('Navigation Shell Components', () => {
  const mockUser: User = {
    id: 'usr-1',
    email: 'budi@rezekify.id',
    full_name: 'Budi Santoso',
    telegram_chat_id: 998877,
  };

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 2500000, is_active: true },
    { id: 'acc-2', name: 'GoPay', account_type: 'EWALLET', current_balance: 350000, is_active: true },
  ];

  it('renders Sidebar with brand, navigation links, and account balances', () => {
    const handleViewChange = vi.fn();
    const handleOpenCreateAccount = vi.fn();
    const handleLogout = vi.fn();

    render(
      <Sidebar
        activeView="overview"
        onViewChange={handleViewChange}
        accounts={mockAccounts}
        transactionCount={42}
        user={mockUser}
        onLogout={handleLogout}
        onOpenCreateAccount={handleOpenCreateAccount}
      />
    );

    expect(screen.getByText('Rezekify')).toBeInTheDocument();
    expect(screen.getByText('Ringkasan')).toBeInTheDocument();
    expect(screen.getByText('Buku Besar')).toBeInTheDocument();
    expect(screen.getByText('Komitmen & Vaults')).toBeInTheDocument();
    expect(screen.getByText('Pengaturan')).toBeInTheDocument();

    // Accounts
    expect(screen.getByText('BCA Utama')).toBeInTheDocument();
    expect(screen.getByText('Rp 2.500.000')).toBeInTheDocument();
    expect(screen.getByText('GoPay')).toBeInTheDocument();
    expect(screen.getByText('Rp 350.000')).toBeInTheDocument();

    // Telegram status & User
    expect(screen.getByText('Terhubung')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('BS')).toBeInTheDocument();

    // Click navigation item
    fireEvent.click(screen.getByText('Buku Besar'));
    expect(handleViewChange).toHaveBeenCalledWith('ledger');

    // Click add account
    fireEvent.click(screen.getByRole('button', { name: /\+ Rekening/i }));
    expect(handleOpenCreateAccount).toHaveBeenCalledTimes(1);

    // Click logout
    fireEvent.click(screen.getByRole('button', { name: /Keluar/i }));
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('toggles Sidebar collapse state cleanly', () => {
    const { rerender } = render(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        isCollapsed={false}
      />
    );

    expect(screen.getByText('Ringkasan')).toBeInTheDocument();

    rerender(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        isCollapsed={true}
      />
    );

    expect(screen.queryByText('Ringkasan')).not.toBeInTheDocument();
  });

  it('renders BottomDock with 4 tabs and elevated center quick capture button', () => {
    const handleViewChange = vi.fn();
    const handleQuickCapture = vi.fn();

    render(
      <BottomDock
        activeView="ledger"
        onViewChange={handleViewChange}
        onQuickCapturePress={handleQuickCapture}
      />
    );

    expect(screen.getByRole('button', { name: /Ringkasan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buku Besar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vaults/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pengaturan/i })).toBeInTheDocument();

    const quickCaptureBtn = screen.getByRole('button', { name: /Quick Capture/i });
    expect(quickCaptureBtn).toBeInTheDocument();

    fireEvent.click(quickCaptureBtn);
    expect(handleQuickCapture).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Vaults/i }));
    expect(handleViewChange).toHaveBeenCalledWith('vaults');
  });

  it('renders AppLayout with Sidebar, BottomDock, and children (Review Focus 5)', () => {
    const handleViewChange = vi.fn();

    render(
      <AppLayout
        activeView="overview"
        onViewChange={handleViewChange}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
      >
        <div data-testid="dashboard-content">Konten Dashboard</div>
      </AppLayout>
    );

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.getAllByText('Rezekify')[0]).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/NavigationShell.test.tsx`
Expected: FAIL with "Cannot find module '../components/Sidebar' or its corresponding type declarations."

- [x] **Step 3: Write minimal implementation**

Create `frontend/src/components/Sidebar.tsx`:
```tsx
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
  Building2,
  Wallet,
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
```

Create `frontend/src/components/BottomDock.tsx`:
```tsx
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
```

Create `frontend/src/components/AppLayout.tsx`:
```tsx
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
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/NavigationShell.test.tsx`
Expected: PASS (4 tests passed)

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/BottomDock.tsx frontend/src/components/AppLayout.tsx frontend/src/__tests__/NavigationShell.test.tsx
git commit -m "feat(frontend): implement Navigation Shell components and test suite"
```

---

### Task 2: Sleek Command Bar (`QuickCaptureBar.tsx`)

**Files:**
- Create: `frontend/src/components/QuickCaptureBar.tsx`
- Create: `frontend/src/__tests__/QuickCaptureBar.test.tsx`

**Interfaces:**
- Consumes:
  - `compressImage` from `../utils/imageCompression`
  - HeroUI `Button`
  - Lucide icons: `Terminal`, `Camera`, `Mic`, `Square`, `X`, `CheckCircle2`, `AlertCircle`, `Loader2`
  - `framer-motion` (`motion`, `AnimatePresence`)
- Produces:
  - `QuickCaptureBar(props: QuickCaptureBarProps): JSX.Element`

- [x] **Step 1: Write failing test `frontend/src/__tests__/QuickCaptureBar.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickCaptureBar } from '../components/QuickCaptureBar';

describe('QuickCaptureBar Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 44px command bar with Terminal icon and shortcut badge', () => {
    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={vi.fn()} />);

    expect(
      screen.getByPlaceholderText(/Ketik mutasi, drop foto struk kasir, atau rekam suara\.\.\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pilih struk belanja/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rekam pesan suara/i })).toBeInTheDocument();
    expect(screen.getByText('Ctrl ↵')).toBeInTheDocument();
  });

  it('submits text mutasi on Enter', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: 'Beli kopi 25rb bca' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ text: 'Beli kopi 25rb bca', file: null });
    });
  });

  it('does nothing on whitespace-only submission (Review Focus 1)', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('attaches receipt file, displays receipt indicator, and clears it on dismiss', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const file = new File(['dummy_bytes'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('struk_kopi.jpg')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Hapus struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('struk_kopi.jpg')).not.toBeInTheDocument();
  });

  it('morphs into audio telemetry visualizer during recording and cancels on Esc (Review Focus 2)', async () => {
    const handleVoiceSubmit = vi.fn();

    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      writable: true,
      configurable: true,
    });

    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported = vi.fn().mockReturnValue(true);
    }
    (window as any).MediaRecorder = MockMediaRecorder;

    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} />);

    const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /Batalkan rekaman/i });
    fireEvent.click(cancelBtn);

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(handleVoiceSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();
  });

  it('submits voice recording blob on stop button click', async () => {
    const handleVoiceSubmit = vi.fn();

    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      writable: true,
      configurable: true,
    });

    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported = vi.fn().mockReturnValue(true);
    }
    (window as any).MediaRecorder = MockMediaRecorder;

    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /Rekam pesan suara/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i }));

    await waitFor(() => {
      expect(handleVoiceSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('renders floating toast notification and dismisses on close click', () => {
    const handleDismissToast = vi.fn();

    render(
      <QuickCaptureBar
        onSubmit={vi.fn()}
        onVoiceSubmit={vi.fn()}
        toastMessage={{ text: 'Struk berhasil dicatat ke dalam ledger!', isError: false }}
        onDismissToast={handleDismissToast}
      />
    );

    expect(screen.getByText('Struk berhasil dicatat ke dalam ledger!')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup notifikasi/i });
    fireEvent.click(closeBtn);

    expect(handleDismissToast).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/QuickCaptureBar.test.tsx`
Expected: FAIL with "Cannot find module '../components/QuickCaptureBar' or its corresponding type declarations."

- [x] **Step 3: Write minimal implementation**

Create `frontend/src/components/QuickCaptureBar.tsx`:
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@heroui/react';
import {
  Terminal,
  Camera,
  Mic,
  Square,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../utils/imageCompression';

export interface QuickCaptureBarProps {
  onSubmit: (input: string | { text: string; file: File | null }, file?: File | null) => Promise<void> | void;
  onVoiceSubmit: (blob: Blob, caption?: string) => Promise<void> | void;
  isLoading?: boolean;
  toastMessage?: { text: string; isError?: boolean } | null;
  onDismissToast?: () => void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const QuickCaptureBar: React.FC<QuickCaptureBarProps> = ({
  onSubmit,
  onVoiceSubmit,
  isLoading = false,
  toastMessage = null,
  onDismissToast,
}) => {
  const [text, setText] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toastMessage || !onDismissToast) return;
    const timer = setTimeout(() => {
      onDismissToast();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage, onDismissToast]);

  // Clean up media resources on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatDuration = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      return;
    }
    try {
      const compressed = await compressImage(selectedFile);
      setFile(compressed);
    } catch {
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const submitPayload = () => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    if (isLoading) return;

    if (onSubmit.length === 1) {
      (onSubmit as (p: { text: string; file: File | null }) => void)({ text: trimmed, file });
    } else {
      (onSubmit as (t: string, f: File | null) => void)(trimmed, file);
    }

    setText('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPayload();
    }
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size > 0) {
          onVoiceSubmit(audioBlob, text.trim() || undefined);
        }
        cleanupRecordingState();
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      cleanupRecordingState();
    }
  };

  const cleanupRecordingState = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    audioChunksRef.current = [];
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    cleanupRecordingState();
  };

  return (
    <div
      className="relative w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sleek 44px Command Strip */}
      <div
        className={`h-11 rounded-xl bg-[#141417] border px-3 flex items-center gap-2.5 transition-all ${
          isDraggingOver
            ? 'border-zinc-500 bg-zinc-900/80 ring-1 ring-zinc-500'
            : isRecording
            ? 'border-rose-500/50 bg-rose-950/20'
            : 'border-zinc-800/80 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600'
        }`}
      >
        {isRecording ? (
          <div
            role="region"
            aria-label="Perekaman suara aktif"
            className="flex-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-xs font-mono font-medium text-rose-400 tabular-nums">
                {formatDuration(recordingSeconds)}
              </span>
              {/* 5 Equalizer frequency bars */}
              <div className="flex items-center gap-1 h-4 px-1" aria-hidden="true">
                {[0.4, 0.9, 0.5, 1.0, 0.6].map((scale, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ scaleY: [scale, 1.0, 0.2, scale] }}
                    transition={{
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 0.4 + idx * 0.1,
                      ease: 'easeInOut',
                    }}
                    className="w-1 h-3.5 bg-rose-500 rounded-full origin-center"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleCancelRecording}
                aria-label="Batalkan rekaman"
                className="p-1 min-w-[32px] min-h-[32px] text-zinc-400 hover:text-white bg-transparent"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                onPress={handleStopRecording}
                aria-label="Selesai dan kirim pesan suara"
                className="min-w-[32px] min-h-[32px] bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center justify-center"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Terminal className="w-4 h-4 text-zinc-500 shrink-0" />

            {/* Attached receipt chip preview */}
            {file && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-300 shrink-0 max-w-[140px] sm:max-w-[200px] truncate">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Hapus struk"
                  className="text-zinc-400 hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ketik mutasi, drop foto struk kasir, atau rekam suara..."
              className="bg-transparent flex-1 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none min-w-0"
            />

            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />

              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => fileInputRef.current?.click()}
                isDisabled={isLoading}
                aria-label="Pilih struk belanja"
                className="p-1 min-w-[34px] min-h-[34px] text-zinc-400 hover:text-zinc-200 bg-transparent rounded-lg"
              >
                <Camera className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleStartRecording}
                isDisabled={isLoading}
                aria-label="Rekam pesan suara"
                className="p-1 min-w-[34px] min-h-[34px] text-zinc-400 hover:text-zinc-200 bg-transparent rounded-lg"
              >
                <Mic className="w-4 h-4" />
              </Button>

              {isLoading ? (
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin ml-1" />
              ) : (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400 font-mono ml-1">
                  Ctrl ↵
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Notification Toast (Bottom-Right) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-20 md:bottom-6 right-6 z-50 p-4 rounded-xl border flex items-start gap-3 shadow-xl max-w-sm sm:max-w-md ${
              toastMessage.isError
                ? 'bg-[#181014] border-rose-500/30 text-rose-300'
                : 'bg-[#101714] border-emerald-500/30 text-emerald-300'
            }`}
          >
            {toastMessage.isError ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-zinc-400 mb-0.5">
                {toastMessage.isError ? 'Gagal Memproses' : 'Hasil Konfirmasi AI'}
              </p>
              <p className="text-zinc-200 whitespace-pre-line">{toastMessage.text}</p>
            </div>
            {onDismissToast && (
              <button
                type="button"
                onClick={onDismissToast}
                aria-label="Tutup notifikasi"
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/40"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/QuickCaptureBar.test.tsx`
Expected: PASS (7 tests passed)

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/QuickCaptureBar.tsx frontend/src/__tests__/QuickCaptureBar.test.tsx
git commit -m "feat(frontend): implement sleek 44px QuickCaptureBar with visualizer and toast"
```

---

### Task 3: Overview Pure Telemetry Cockpit (`OverviewView.tsx`)

**Files:**
- Create: `frontend/src/components/OverviewView.tsx`
- Create: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Consumes:
  - `DashboardSummaryResponse`, `Vault`, `Account` from `../types/api`
  - `RunwayMetricCard` from `./RunwayMetricCard`
  - `ExpenseCharts` from `./ExpenseCharts`
  - `UpcomingBillsCard` from `./UpcomingBillsCard`
  - HeroUI `Button`, `Chip`
  - Lucide icons: `Building2`, `ShieldCheck`, `ArrowRight`, `Lock`, `Unlock`, `Calculator`, `PiggyBank`
- Produces:
  - `OverviewView(props: OverviewViewProps): JSX.Element`

- [x] **Step 1: Write failing test `frontend/src/__tests__/OverviewView.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverviewView } from '../components/OverviewView';
import { DashboardSummaryResponse, Vault, Account } from '../types/api';

describe('OverviewView Component', () => {
  const mockSummary: DashboardSummaryResponse = {
    total_liquid_cash: 3000000,
    vault_locked_cash: 1000000,
    operational_free_cash: 2000000,
    days_remaining: 15,
    daily_safe_runway: 133333,
    health_status: 'HEALTHY',
    upcoming_bills: [
      {
        name: 'Listrik PLN',
        target_amount: 300000,
        allocated_amount: 100000,
        target_date: '2026-09-30',
        days_until_due: 6,
      },
    ],
  };

  const mockVaults: Vault[] = [
    {
      id: 'v-1',
      name: 'Simpanan Pajak',
      vault_type: 'FIXED_BILL',
      target_amount: 1500000,
      allocated_amount: 1000000,
      target_date: '2026-10-15',
      is_locked: true,
    },
    {
      id: 'v-2',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 5000000,
      allocated_amount: 2500000,
      is_locked: false,
    },
  ];

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 3000000, is_active: true },
  ];

  it('renders 3 telemetry hero tiles with formatted currency amounts and health badge', () => {
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    // Tile 1: Daily Safe Runway
    expect(screen.getByText('DAILY SAFE RUNWAY')).toBeInTheDocument();
    expect(screen.getByText('Rp 133.333')).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/15 hari tersisa dalam siklus bulanan/i)).toBeInTheDocument();

    // Tile 2: Kas Bebas Operasional
    expect(screen.getByText('KAS BEBAS OPERASIONAL')).toBeInTheDocument();
    expect(screen.getByText('Rp 2.000.000')).toBeInTheDocument();

    // Tile 3: Cadangan Terkunci
    expect(screen.getByText('CADANGAN TERKUNCI (VAULTS)')).toBeInTheDocument();
    expect(screen.getByText('Rp 1.000.000')).toBeInTheDocument();
  });

  it('renders friendly onboarding card when accounts is empty (Review Focus 3)', () => {
    const handleOpenCreateAccount = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={[]}
        accounts={[]}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={handleOpenCreateAccount}
        onOpenSimulateModal={vi.fn()}
      />
    );

    expect(screen.getByText('Mulai Hitung Batas Belanja Harian')).toBeInTheDocument();
    const ctaBtn = screen.getByRole('button', { name: /\+ Tambah Rekening Pertama/i });
    fireEvent.click(ctaBtn);
    expect(handleOpenCreateAccount).toHaveBeenCalledTimes(1);
  });

  it('renders mini-vaults section and navigates to full vaults view on link click', () => {
    const handleNavigateToVaults = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={handleNavigateToVaults}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    expect(screen.getByText('Komitmen & Vaults Prioritas')).toBeInTheDocument();
    expect(screen.getByText('Simpanan Pajak')).toBeInTheDocument();
    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();

    const viewAllBtn = screen.getByRole('button', { name: /Lihat Semua Vault/i });
    fireEvent.click(viewAllBtn);
    expect(handleNavigateToVaults).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenSimulateModal from simulation quick button', () => {
    const handleOpenSimulate = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={handleOpenSimulate}
      />
    );

    const simBtn = screen.getByRole('button', { name: /Simulasi Belanja/i });
    fireEvent.click(simBtn);
    expect(handleOpenSimulate).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/OverviewView.test.tsx`
Expected: FAIL with "Cannot find module '../components/OverviewView' or its corresponding type declarations."

- [x] **Step 3: Write minimal implementation**

Create `frontend/src/components/OverviewView.tsx`:
```tsx
import React from 'react';
import { Button, Chip } from '@heroui/react';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Lock,
  Unlock,
  Calculator,
  Wallet,
  PiggyBank,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSummaryResponse, Vault, Account } from '../types/api';
import { RunwayMetricCard } from './RunwayMetricCard';
import { ExpenseCharts } from './ExpenseCharts';
import { UpcomingBillsCard } from './UpcomingBillsCard';

export interface OverviewViewProps {
  summary: DashboardSummaryResponse | null;
  vaults: Vault[];
  accounts: Account[];
  isLoading: boolean;
  refreshTrigger: number;
  onNavigateToVaults: () => void;
  onOpenCreateAccount: () => void;
  onOpenSimulateModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  vaults,
  accounts,
  isLoading,
  refreshTrigger,
  onNavigateToVaults,
  onOpenCreateAccount,
  onOpenSimulateModal,
}) => {
  const activeAccounts = accounts.filter((acc) => acc.is_active !== false);

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'CRITICAL':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Banner when no accounts */}
      {!isLoading && activeAccounts.length === 0 && (
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-zinc-800 border border-zinc-700/80 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Mulai Hitung Batas Belanja Harian
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-1">
                Tambahkan rekening atau dompet pertama Anda (BCA, GoPay, atau Tunai) untuk mengaktifkan telemetri runway otomatis dan kalkulasi belanja harian bebas risiko.
              </p>
            </div>
          </div>
          <Button
            type="button"
            color="primary"
            onPress={onOpenCreateAccount}
            startContent={<Building2 className="w-4 h-4" />}
            className="font-semibold text-xs py-2.5 px-4 min-h-[40px] rounded-xl shrink-0 bg-white text-zinc-950 hover:bg-zinc-200"
          >
            + Tambah Rekening Pertama
          </Button>
        </div>
      )}

      {/* 3 Telemetry Hero Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tile 1: Daily Safe Runway */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              DAILY SAFE RUNWAY
            </span>
            <Chip
              size="sm"
              variant="flat"
              color={getStatusBadgeColor(summary?.health_status)}
              className="text-[11px] font-bold uppercase tracking-wider"
            >
              {summary?.health_status || 'UNKNOWN'}
            </Chip>
          </div>
          <div className="my-2">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
              Rp {(summary?.daily_safe_runway ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {summary?.days_remaining ?? 0} hari tersisa dalam siklus bulanan
          </p>
        </div>

        {/* Tile 2: Kas Bebas Operasional */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              KAS BEBAS OPERASIONAL
            </span>
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-200 tabular-nums">
              Rp {(summary?.operational_free_cash ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Total kas cair (Rp {(summary?.total_liquid_cash ?? 0).toLocaleString('id-ID')}) dikurangi pos vault
          </p>
        </div>

        {/* Tile 3: Cadangan Terkunci (Vaults) */}
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              CADANGAN TERKUNCI (VAULTS)
            </span>
            <Button
              type="button"
              size="sm"
              variant="flat"
              onPress={onOpenSimulateModal}
              startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[32px] rounded-lg text-xs"
            >
              Simulasi Belanja
            </Button>
          </div>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-200 tabular-nums">
              Rp {(summary?.vault_locked_cash ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Dana komitmen & tabungan aman dari belanja harian
          </p>
        </div>
      </div>

      {/* Bento Telemetry Row (12-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Col 7: 7-Day Spending Chart */}
        <div className="lg:col-span-7 w-full">
          <ExpenseCharts refreshTrigger={refreshTrigger} />
        </div>

        {/* Col 5: Upcoming Bills Card */}
        <div className="lg:col-span-5 w-full space-y-6">
          <UpcomingBillsCard bills={summary?.upcoming_bills} isLoading={isLoading} />
          <RunwayMetricCard summary={summary} />
        </div>
      </div>

      {/* Mini-Vaults Section */}
      <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Komitmen & Vaults Prioritas</h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="light"
            onPress={onNavigateToVaults}
            endContent={<ArrowRight className="w-3.5 h-3.5" />}
            className="text-xs text-zinc-400 hover:text-white bg-transparent p-1"
          >
            Lihat Semua Vault
          </Button>
        </div>

        {vaults.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            Belum ada pos komitmen atau vault aktif.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vaults.slice(0, 3).map((vault) => {
              const pct = vault.target_amount > 0
                ? Math.min(100, Math.round((vault.allocated_amount / vault.target_amount) * 100))
                : 100;
              return (
                <div
                  key={vault.id}
                  className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                      {vault.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {vault.is_locked ? (
                        <Lock className="w-3 h-3 text-zinc-400" />
                      ) : (
                        <Unlock className="w-3 h-3 text-zinc-500" />
                      )}
                      <span className="text-[10px] font-mono text-zinc-400">{pct}%</span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden my-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="h-full bg-emerald-400 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Rp {vault.allocated_amount.toLocaleString('id-ID')}</span>
                    <span className="text-zinc-500">/ Rp {vault.target_amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/OverviewView.test.tsx`
Expected: PASS (4 tests passed)

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "feat(frontend): implement OverviewView telemetry cockpit with mini-vaults"
```

---

### Task 4: Dedicated Full Ledger & Vaults Views (`LedgerView.tsx`, `VaultsView.tsx`)

**Files:**
- Create: `frontend/src/components/LedgerView.tsx`
- Create: `frontend/src/components/VaultsView.tsx`
- Create: `frontend/src/__tests__/DedicatedViews.test.tsx`

**Interfaces:**
- Consumes:
  - `Transaction`, `Account`, `Category`, `Vault`, `TransactionFilterParams` from `../types/api`
  - `TransactionsTable` from `./TransactionsTable`
  - `VaultCard` from `./VaultCard`
  - HeroUI `Button`, `Chip`
  - Lucide icons: `ReceiptText`, `PlusCircle`, `Calculator`, `Tag`, `ShieldCheck`, `PiggyBank`, `AlertCircle`
- Produces:
  - `LedgerView(props: LedgerViewProps): JSX.Element`
  - `VaultsView(props: VaultsViewProps): JSX.Element`

- [x] **Step 1: Write failing test `frontend/src/__tests__/DedicatedViews.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LedgerView } from '../components/LedgerView';
import { VaultsView } from '../components/VaultsView';
import { Transaction, Account, Category, Vault } from '../types/api';

describe('Dedicated Ledger & Vaults Views', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Soto Lamongan',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-24T12:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT', amount: 25000 },
        { id: 'le-2', entry_type: 'CREDIT', amount: 25000 },
      ],
    },
  ];

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA', account_type: 'BANK', current_balance: 1000000, is_active: true },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Kuliner', category_type: 'EXPENSE' },
  ];

  const mockVaults: Vault[] = [
    {
      id: 'v-1',
      name: 'Listrik & WiFi',
      vault_type: 'FIXED_BILL',
      target_amount: 500000,
      allocated_amount: 500000,
      target_date: '2026-09-30',
      is_locked: true,
    },
    {
      id: 'v-2',
      name: 'Liburan Akhir Tahun',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 2500000,
      is_locked: false,
    },
  ];

  describe('LedgerView', () => {
    it('renders title, subtitle, action buttons and embeds TransactionsTable', () => {
      const handleOpenManual = vi.fn();
      const handleOpenSimulate = vi.fn();
      const handleOpenCategory = vi.fn();

      render(
        <LedgerView
          transactions={mockTransactions}
          accounts={mockAccounts}
          categories={mockCategories}
          total={1}
          page={1}
          pageSize={20}
          totalPages={1}
          onParamsChange={vi.fn()}
          onPageChange={vi.fn()}
          onDeleteTransaction={vi.fn()}
          onEditTransaction={vi.fn()}
          onOpenManualModal={handleOpenManual}
          onOpenSimulateModal={handleOpenSimulate}
          onOpenCategoryModal={handleOpenCategory}
        />
      );

      expect(screen.getByText('Buku Besar (Ledger)')).toBeInTheDocument();
      expect(screen.getByText('Makan Soto Lamongan')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /\+ Catat Manual/i }));
      expect(handleOpenManual).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Simulasi Belanja/i }));
      expect(handleOpenSimulate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /\+ Kategori/i }));
      expect(handleOpenCategory).toHaveBeenCalledTimes(1);
    });
  });

  describe('VaultsView', () => {
    it('renders title, filters tabs, and renders vault cards', () => {
      const handleOpenCreateVault = vi.fn();

      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={handleOpenCreateVault}
        />
      );

      expect(screen.getByText('Komitmen & Vaults')).toBeInTheDocument();
      expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
      expect(screen.getByText('Liburan Akhir Tahun')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /\+ Tambah Vault/i }));
      expect(handleOpenCreateVault).toHaveBeenCalledTimes(1);
    });

    it('filters vaults by tab: Semua, Tagihan Tetap, Tabungan', () => {
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Tagihan Tetap/i }));
      expect(screen.getByText('Listrik & WiFi')).toBeInTheDocument();
      expect(screen.queryByText('Liburan Akhir Tahun')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Tabungan/i }));
      expect(screen.getByText('Liburan Akhir Tahun')).toBeInTheDocument();
      expect(screen.queryByText('Listrik & WiFi')).not.toBeInTheDocument();
    });

    it('guards locked vaults by disabling delete button (Review Focus 4)', () => {
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage={null}
          onDismissError={vi.fn()}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /Hapus vault/i });
      // First vault is locked: delete button must be disabled
      expect(deleteButtons[0]).toBeDisabled();
      // Second vault is unlocked: delete button must be enabled
      expect(deleteButtons[1]).not.toBeDisabled();
    });

    it('renders dismissible error banner when errorMessage is provided', () => {
      const handleDismiss = vi.fn();
      render(
        <VaultsView
          vaults={mockVaults}
          isLoading={false}
          errorMessage="Gagal menghapus vault dari server."
          onDismissError={handleDismiss}
          onToggleLock={vi.fn()}
          onEditVault={vi.fn()}
          onDeleteVault={vi.fn()}
          onOpenCreateVault={vi.fn()}
        />
      );

      expect(screen.getByText('Gagal menghapus vault dari server.')).toBeInTheDocument();
      const dismissBtn = screen.getByRole('button', { name: /Tutup pesan kesalahan/i });
      fireEvent.click(dismissBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/DedicatedViews.test.tsx`
Expected: FAIL with "Cannot find module '../components/LedgerView' or its corresponding type declarations."

- [x] **Step 3: Write minimal implementation**

Create `frontend/src/components/LedgerView.tsx`:
```tsx
import React from 'react';
import { Button } from '@heroui/react';
import { PlusCircle, Calculator, Tag } from 'lucide-react';
import { Transaction, Account, Category, TransactionFilterParams } from '../types/api';
import { TransactionsTable } from './TransactionsTable';

export interface LedgerViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onParamsChange: (params: TransactionFilterParams) => void;
  onPageChange: (page: number) => void;
  onDeleteTransaction: (id: string) => Promise<void> | void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenManualModal: () => void;
  onOpenSimulateModal: () => void;
  onOpenCategoryModal: () => void;
  isLoading?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  accounts,
  categories,
  total,
  page,
  pageSize,
  totalPages,
  onParamsChange,
  onPageChange,
  onDeleteTransaction,
  onEditTransaction,
  onOpenManualModal,
  onOpenSimulateModal,
  onOpenCategoryModal,
  isLoading = false,
}) => {
  return (
    <div className="space-y-6">
      {/* Header with Title and Pro Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Buku Besar (Ledger)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pencatatan mutasi double-entry immutable dengan audit trail lengkap.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            onPress={onOpenCategoryModal}
            startContent={<Tag className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            + Kategori
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={onOpenSimulateModal}
            startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            Simulasi Belanja
          </Button>

          <Button
            size="sm"
            onPress={onOpenManualModal}
            startContent={<PlusCircle className="w-3.5 h-3.5" />}
            className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold min-h-[38px] rounded-xl text-xs"
          >
            + Catat Manual
          </Button>
        </div>
      </div>

      {/* High-density Ledger Table with Multi-filter Toolbar */}
      <TransactionsTable
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onParamsChange={onParamsChange}
        onPageChange={onPageChange}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
        isLoading={isLoading}
      />
    </div>
  );
};
```

Create `frontend/src/components/VaultsView.tsx`:
```tsx
import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { ShieldCheck, Plus, AlertCircle, PiggyBank } from 'lucide-react';
import { Vault } from '../types/api';
import { VaultCard } from './VaultCard';

export interface VaultsViewProps {
  vaults: Vault[];
  isLoading: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onToggleLock: (id: string, is_locked: boolean) => Promise<void> | void;
  onEditVault: (vault: Vault) => void;
  onDeleteVault: (id: string) => Promise<void> | void;
  onOpenCreateVault: () => void;
}

export const VaultsView: React.FC<VaultsViewProps> = ({
  vaults,
  isLoading,
  errorMessage,
  onDismissError,
  onToggleLock,
  onEditVault,
  onDeleteVault,
  onOpenCreateVault,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIXED_BILL' | 'SAVINGS'>('ALL');

  const filteredVaults = vaults.filter((vault) => {
    if (activeTab === 'FIXED_BILL') return vault.vault_type === 'FIXED_BILL';
    if (activeTab === 'SAVINGS') return vault.vault_type === 'SAVINGS';
    return true;
  });

  const countAll = vaults.length;
  const countBills = vaults.filter((v) => v.vault_type === 'FIXED_BILL').length;
  const countSavings = vaults.filter((v) => v.vault_type === 'SAVINGS').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Komitmen & Vaults
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Alokasi pos dana aman dan sinking funds untuk mengunci kas operasional.
          </p>
        </div>

        <Button
          size="sm"
          onPress={onOpenCreateVault}
          startContent={<Plus className="w-4 h-4" />}
          className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold min-h-[38px] rounded-xl text-xs"
        >
          + Tambah Vault
        </Button>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-xs sm:text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-zinc-400">
                Gagal Memproses Vault
              </p>
              <p className="text-zinc-200">{errorMessage}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="light"
            onPress={onDismissError}
            aria-label="Tutup pesan kesalahan"
            className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-lg bg-transparent"
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
            activeTab === 'ALL'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Semua</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countAll}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FIXED_BILL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
            activeTab === 'FIXED_BILL'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Tagihan Tetap</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countBills}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SAVINGS')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
            activeTab === 'SAVINGS'
              ? 'bg-zinc-800 text-white border border-zinc-700/80 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Tabungan</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-900 font-mono text-zinc-400">
            {countSavings}
          </span>
        </button>
      </div>

      {/* Bento Grid */}
      {filteredVaults.length === 0 ? (
        <div className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <PiggyBank className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-white mb-1">
            Belum ada komitmen atau vault aktif
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Buat pos tagihan rutin bulanan atau tabungan masa depan untuk mengamankan kas operasional Anda.
          </p>
          <Button
            size="sm"
            onPress={onOpenCreateVault}
            className="bg-white text-zinc-950 font-semibold rounded-xl text-xs min-h-[38px] px-4"
          >
            + Buat Vault Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVaults.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              onToggleLock={onToggleLock}
              onEdit={onEditVault}
              onDelete={onDeleteVault}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/DedicatedViews.test.tsx`
Expected: PASS (5 tests passed)

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/LedgerView.tsx frontend/src/components/VaultsView.tsx frontend/src/__tests__/DedicatedViews.test.tsx
git commit -m "feat(frontend): implement dedicated LedgerView and VaultsView components"
```

---

### Task 5: App Integration in `DashboardPage.tsx`, Design Tokens in `DESIGN.md`, and End-to-End Verification Gate

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `DESIGN.md`
- Modify: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes:
  - `AppLayout` from `../components/AppLayout`
  - `QuickCaptureBar` from `../components/QuickCaptureBar`
  - `OverviewView` from `../components/OverviewView`
  - `LedgerView` from `../components/LedgerView`
  - `VaultsView` from `../components/VaultsView`
  - Domain hooks: `useAuth`, `useDashboardModals`, `useTransactionsLedger`, `useDashboardData`
- Produces:
  - Complete, unified, tab-navigated `DashboardPage` adhering to Modern Zinc Studio specifications.

- [x] **Step 1: Write integration tests in `frontend/src/__tests__/DashboardPage.test.tsx`**

Update `frontend/src/__tests__/DashboardPage.test.tsx` to test the new layout, command bar, and navigation switching:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import { App } from '../App';
import * as apiClient from '../services/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('DashboardPage Component', () => {
  const mockLogout = vi.fn();
  const mockUser = {
    id: 'usr-101',
    email: 'user@rezekify.id',
    full_name: 'Budi Santoso',
    telegram_chat_id: 12345,
  };

  const mockSummary = {
    total_liquid_cash: 2500000,
    vault_locked_cash: 500000,
    operational_free_cash: 2000000,
    days_remaining: 20,
    daily_safe_runway: 100000,
    health_status: 'HEALTHY' as const,
    upcoming_bills: [
      {
        name: 'Internet & WiFi',
        target_amount: 350000,
        allocated_amount: 150000,
        target_date: '2026-09-22',
        days_until_due: 4,
      },
    ],
  };

  const mockTransactions = [
    {
      id: 'tx-101',
      description: 'Makan Siang Soto Ayam',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-18T13:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT' as const, amount: 25000 },
        { id: 'le-2', entry_type: 'CREDIT' as const, amount: 25000 },
      ],
    },
  ];

  const mockAccounts = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK' as const, current_balance: 2000000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogout.mockReset();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
    });

    vi.spyOn(apiClient, 'getTransactions').mockImplementation(async () => {
      const res = await apiClient.apiFetch('/transactions');
      if (Array.isArray(res)) {
        return {
          items: res,
          total: res.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };
      }
      return res as any;
    });
  });

  it('renders dashboard with navigation shell and overview cockpit', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 25000, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/DAILY SAFE RUNWAY/i)).toBeInTheDocument();
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
      expect(screen.getByText(/Internet & WiFi/i)).toBeInTheDocument();
    });
  });

  it('switches views between Ringkasan, Buku Besar, and Vaults', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return [];
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('DAILY SAFE RUNWAY')).toBeInTheDocument();
    });

    // Switch to Buku Besar
    const ledgerNavBtn = screen.getByRole('button', { name: /Buku Besar/i });
    fireEvent.click(ledgerNavBtn);

    await waitFor(() => {
      expect(screen.getByText('Buku Besar (Ledger)')).toBeInTheDocument();
      expect(screen.getAllByText(/Makan Siang Soto Ayam/i)[0]).toBeInTheDocument();
    });

    // Switch to Komitmen & Vaults
    const vaultsNavBtn = screen.getByRole('button', { name: /Komitmen & Vaults/i });
    fireEvent.click(vaultsNavBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Tambah Vault/i })).toBeInTheDocument();
    });
  });

  it('handles text submission via QuickCaptureBar to /dashboard/ai-chat', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 35000, items: [] };
      }
      if (endpoint === '/dashboard/ai-chat' && options?.method === 'POST') {
        return { reply: 'Berhasil mencatat pengeluaran bensin Rp 35.000 dari BCA.' };
      }
      return null;
    });

    render(<DashboardPage />);

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Berhasil mencatat pengeluaran bensin Rp 35.000/i)).toBeInTheDocument();
    });
  });

  it('opens and closes AccountModal from sidebar + Rekening action', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('DAILY SAFE RUNWAY')).toBeInTheDocument();
    });

    const openBtn = screen.getByRole('button', { name: /\+ Rekening/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Tambah Akun Baru')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Tambah Akun Baru')).not.toBeInTheDocument();
  });

  it('opens SettingsModal from sidebar Pengaturan button', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/categories') return [];
      if (endpoint === '/vaults') return [];
      if (endpoint === '/settings') {
        return {
          telegram: { is_connected: false, telegram_chat_id: null, bot_username: 'RezekifyBot' },
          ai: {
            is_custom_ai_enabled: false,
            provider: 'SYSTEM',
            model: 'gemini-2.5-flash',
            has_api_key: false,
            available_models: {},
          },
        };
      }
      return {};
    });

    render(<DashboardPage />);

    const settingsBtn = screen.getByRole('button', { name: /Pengaturan/i });
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Pengaturan Akun & Sistem')).toBeInTheDocument();
    });
  });
});

describe('App Component Auth Gating', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner when auth is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText(/Memuat sesi Rezekify\.\.\./i)).toBeInTheDocument();
  });

  it('renders AuthPage when user is not authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    expect(screen.getByRole('button', { name: /Masuk \(Login\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daftar Akun/i })).toBeInTheDocument();
  });

  it('renders DashboardPage when user is authenticated', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(null);
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'a@b.com', full_name: 'Alex' },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails before modification**

Run: `cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx`
Expected: FAIL until `DashboardPage.tsx` integrates the new navigation shell and command bar.

- [x] **Step 3: Update `DashboardPage.tsx` and `DESIGN.md`**

Modify `frontend/src/pages/DashboardPage.tsx`:
```tsx
import React, { useState } from 'react';
import { apiFetch, submitVoice } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { ChatResponse } from '../types/api';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useTransactionsLedger } from '../hooks/useTransactionsLedger';
import { useDashboardData } from '../hooks/useDashboardData';
import { AppLayout } from '../components/AppLayout';
import { QuickCaptureBar } from '../components/QuickCaptureBar';
import { OverviewView } from '../components/OverviewView';
import { LedgerView } from '../components/LedgerView';
import { VaultsView } from '../components/VaultsView';
import { ManualTransactionModal } from '../components/ManualTransactionModal';
import { AccountModal } from '../components/AccountModal';
import { VaultModal } from '../components/VaultModal';
import { SimulatePurchaseModal } from '../components/SimulatePurchaseModal';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { EditVaultModal } from '../components/EditVaultModal';
import { SettingsModal } from '../components/SettingsModal';
import { CategoryManagerModal } from '../components/CategoryManagerModal';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

  const modals = useDashboardModals();
  const ledger = useTransactionsLedger();
  const dashboard = useDashboardData();

  const [activeView, setActiveView] = useState<'overview' | 'ledger' | 'vaults' | 'settings'>('overview');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);

  const activeTxError = txErrorMessage || ledger.error;

  const handleDismissTxError = () => {
    setTxErrorMessage(null);
    ledger.clearError();
  };

  const refreshAllData = async () => {
    await Promise.all([dashboard.refreshAll(), ledger.loadTransactions()]);
  };

  const handleAiSubmit = async (
    input: string | { text: string; file: File | null },
    fileArg?: File | null
  ) => {
    let text = '';
    let file: File | null = null;
    if (typeof input === 'object' && input !== null) {
      text = input.text || '';
      file = input.file || null;
    } else {
      text = input || '';
      file = fileArg ?? null;
    }

    setIsAiLoading(true);
    setAiMessage(null);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (text.trim()) {
          formData.append('message', text.trim());
        }
        const res = await apiFetch<ChatResponse>('/dashboard/ai-receipt', {
          method: 'POST',
          body: formData,
        });
        const isError = !res.reply || res.reply.startsWith('❌') || res.reply.includes('Gagal');
        setAiMessage({
          text: res.reply || (isError ? 'Gagal mencatat struk belanja.' : 'Struk berhasil dicatat ke dalam ledger!'),
          isError,
        });
      } else {
        const res = await apiFetch<ChatResponse>('/dashboard/ai-chat', {
          method: 'POST',
          body: JSON.stringify({ message: text.trim() }),
        });
        setAiMessage({ text: res.reply || 'Berhasil dicatat ke dalam ledger!' });
      }

      await refreshAllData();
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses input AI. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleVoiceSubmit = async (blob: Blob, caption?: string) => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const res = await submitVoice(blob, caption);
      const isError = !res.reply || res.reply.startsWith('❌') || res.reply.includes('Gagal');
      setAiMessage({
        text: res.reply || (isError ? 'Gagal memproses pesan suara.' : 'Pesan suara berhasil dicatat ke dalam ledger!'),
        isError,
      });
      await refreshAllData();
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses pesan suara. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setTxErrorMessage(null);
    ledger.clearError();
    try {
      const success = await ledger.deleteTransaction(id);
      if (success) {
        await dashboard.refreshAll();
      }
    } catch (err: any) {
      setTxErrorMessage(err?.message || 'Gagal menghapus transaksi.');
    }
  };

  return (
    <AppLayout
      activeView={activeView}
      onViewChange={(view) => {
        if (view === 'settings') {
          modals.openSettingsModal();
        } else {
          setActiveView(view);
        }
      }}
      accounts={dashboard.accounts}
      transactionCount={ledger.pagination.total}
      user={user}
      onLogout={logout}
      onOpenCreateAccount={modals.openCreateAccount}
      onOpenSettings={modals.openSettingsModal}
      onQuickCapturePress={() => {
        // Mobile quick capture focus or scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <h1 className="sr-only">Dashboard Keuangan Rezekify</h1>

        {/* Precision 44px Command Bar */}
        <QuickCaptureBar
          onSubmit={handleAiSubmit}
          onVoiceSubmit={handleVoiceSubmit}
          isLoading={isAiLoading}
          toastMessage={aiMessage}
          onDismissToast={() => setAiMessage(null)}
        />

        {/* In-surface Transaction Error Banner */}
        {activeTxError && (
          <div
            role="alert"
            className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-sm"
          >
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-zinc-400">
                Gagal Menghapus Transaksi
              </p>
              <p className="text-zinc-200 text-xs md:text-sm">{activeTxError}</p>
            </div>
            <button
              type="button"
              onClick={handleDismissTxError}
              aria-label="Tutup pesan kesalahan transaksi"
              className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 min-h-[32px] rounded-lg bg-transparent"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Active Dedicated View */}
        {activeView === 'overview' && (
          <OverviewView
            summary={dashboard.summary}
            vaults={dashboard.vaults}
            accounts={dashboard.accounts}
            isLoading={dashboard.isLoading}
            refreshTrigger={dashboard.refreshTrigger}
            onNavigateToVaults={() => setActiveView('vaults')}
            onOpenCreateAccount={modals.openCreateAccount}
            onOpenSimulateModal={modals.openSimulateModal}
          />
        )}

        {activeView === 'ledger' && (
          <LedgerView
            transactions={ledger.transactions}
            accounts={dashboard.accounts}
            categories={dashboard.categories}
            total={ledger.pagination.total}
            page={ledger.pagination.page}
            pageSize={ledger.filters.page_size ?? 20}
            totalPages={ledger.pagination.total_pages}
            onParamsChange={ledger.handleParamsChange}
            onPageChange={ledger.handlePageChange}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={modals.openEditTx}
            onOpenManualModal={modals.openManualModal}
            onOpenSimulateModal={modals.openSimulateModal}
            onOpenCategoryModal={modals.openCategoryModal}
            isLoading={ledger.isDeleting}
          />
        )}

        {activeView === 'vaults' && (
          <VaultsView
            vaults={dashboard.vaults}
            isLoading={dashboard.isLoading}
            errorMessage={dashboard.vaultErrorMessage}
            onDismissError={dashboard.clearVaultError}
            onToggleLock={dashboard.handleToggleVaultLock}
            onEditVault={modals.openEditVault}
            onDeleteVault={dashboard.handleDeleteVault}
            onOpenCreateVault={modals.openVaultModal}
          />
        )}
      </main>

      {/* Domain Modals */}
      <EditTransactionModal
        isOpen={modals.isEditTxModalOpen}
        onClose={modals.closeEditTxModal}
        onSuccess={() => {
          modals.closeEditTxModal();
          refreshAllData();
        }}
        transaction={modals.selectedTxForEdit}
        accounts={dashboard.accounts}
        categories={dashboard.categories}
      />

      <AccountModal
        isOpen={modals.isAccountModalOpen}
        onClose={modals.closeAccountModal}
        accountToEdit={modals.selectedAccountForEdit}
        onSuccess={() => {
          refreshAllData();
        }}
      />

      <VaultModal
        isOpen={modals.isVaultModalOpen}
        onClose={modals.closeVaultModal}
        onSuccess={() => {
          refreshAllData();
        }}
      />

      <EditVaultModal
        isOpen={modals.isEditVaultModalOpen}
        onClose={modals.closeEditVaultModal}
        onSuccess={() => {
          modals.closeEditVaultModal();
          refreshAllData();
        }}
        vault={modals.selectedVaultForEdit}
      />

      <SimulatePurchaseModal
        isOpen={modals.isSimulateModalOpen}
        onClose={modals.closeSimulateModal}
      />

      <ManualTransactionModal
        isOpen={modals.isManualModalOpen}
        onClose={modals.closeManualModal}
        accounts={dashboard.accounts}
        categories={dashboard.categories}
        onSuccess={() => {
          refreshAllData();
        }}
      />

      <SettingsModal
        isOpen={modals.isSettingsModalOpen}
        onClose={modals.closeSettingsModal}
        onSettingsUpdated={() => {
          refreshAllData();
        }}
      />

      <CategoryManagerModal
        isOpen={modals.isCategoryModalOpen}
        onClose={modals.closeCategoryModal}
        onSuccess={() => {
          refreshAllData();
        }}
        categories={dashboard.categories}
      />
    </AppLayout>
  );
};
```

Update `DESIGN.md` Section 1 to document Modern Zinc Studio color tokens:
- Background Root: `#0c0c0e`
- Card Surface: `#141417`
- Border: `border-zinc-800/80` or `border-white/[0.08]`
- Accent focus: `focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600`
- Monochromatic text hierarchy: `text-white` primary, `text-zinc-400` secondary, `text-zinc-500` caption.
- Navigation Shell tokens: Sidebar 240px/64px desktop, Bottom Dock 64px mobile.
- Command Bar tokens: 44px strip (`QuickCaptureBar.tsx`), 5-bar audio visualizer, floating toast.

- [x] **Step 4: Run full test and build verification**

Run: `cd frontend && npm test -- --run`
Expected: PASS across all test suites with exit code 0.

Run: `cd frontend && npm run build`
Expected: PASS with zero TypeScript or Vite bundle errors.

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx DESIGN.md frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): integrate Modern Zinc Studio navigation shell, command bar, and dedicated views"
```
