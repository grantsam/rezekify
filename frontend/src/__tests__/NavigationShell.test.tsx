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

    // AI Copilot navigation item
    expect(screen.getByRole('button', { name: /AI Copilot/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AI Copilot/i }));
    expect(handleViewChange).toHaveBeenCalledWith('chat');

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

  it('renders BottomDock with 4 tabs and elevated center AI Copilot button with onQuickCapturePress', () => {
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

    const quickCaptureBtn = screen.getByRole('button', { name: /ai copilot/i });
    expect(quickCaptureBtn).toBeInTheDocument();

    fireEvent.click(quickCaptureBtn);
    expect(handleQuickCapture).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Vaults/i }));
    expect(handleViewChange).toHaveBeenCalledWith('vaults');
  });

  it('renders Sidebar "AI Copilot" navigation item and triggers onViewChange("chat") when clicked', () => {
    const handleViewChange = vi.fn();
    render(
      <Sidebar
        activeView="overview"
        onViewChange={handleViewChange}
        accounts={[]}
        user={null}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
      />
    );

    const copilotBtn = screen.getByRole('button', { name: /ai copilot/i });
    expect(copilotBtn).toBeInTheDocument();
    fireEvent.click(copilotBtn);
    expect(handleViewChange).toHaveBeenCalledWith('chat');
  });

  it('triggers onViewChange("chat") when BottomDock center elevated button is clicked without onQuickCapturePress', () => {
    const handleViewChange = vi.fn();
    render(
      <BottomDock
        activeView="overview"
        onViewChange={handleViewChange}
      />
    );

    const copilotBtn = screen.getByRole('button', { name: /ai copilot/i });
    expect(copilotBtn).toBeInTheDocument();
    fireEvent.click(copilotBtn);
    expect(handleViewChange).toHaveBeenCalledWith('chat');
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

  it('applies indigo active styling and enforces 38px collapse toggle in Sidebar', () => {
    const handleToggleCollapse = vi.fn();
    render(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onToggleCollapse={handleToggleCollapse}
      />
    );

    const activeNavBtn = screen.getByRole('button', { name: /Ringkasan/i });
    expect(activeNavBtn).toHaveClass('bg-indigo-500/10');
    expect(activeNavBtn).toHaveClass('border-indigo-500/30');

    const activeIcon = activeNavBtn.querySelector('svg');
    expect(activeIcon).toHaveClass('text-indigo-400');
    expect(activeIcon).not.toHaveClass('text-emerald-400');

    const collapseBtn = screen.getByRole('button', { name: /Ciutkan sidebar/i });
    expect(collapseBtn).toHaveClass('min-w-[38px]');
    expect(collapseBtn).toHaveClass('min-h-[38px]');
  });

  it('applies indigo active styling to BottomDock active navigation item', () => {
    render(
      <BottomDock
        activeView="ledger"
        onViewChange={vi.fn()}
      />
    );

    const activeBtn = screen.getByRole('button', { name: /Buku Besar/i });
    expect(activeBtn).toHaveClass('text-indigo-400');
    expect(activeBtn).toHaveClass('font-semibold');
    expect(activeBtn).not.toHaveClass('text-emerald-400');

    const inactiveBtn = screen.getByRole('button', { name: /Ringkasan/i });
    expect(inactiveBtn).not.toHaveClass('text-indigo-400');
  });

  it('renders badge for upcoming bills on vaults menu in Sidebar when upcomingBillsCount > 0', () => {
    render(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        upcomingBillsCount={3}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
      />
    );

    const vaultsBtn = screen.getByRole('button', { name: /Komitmen & Vaults/i });
    expect(vaultsBtn).toBeInTheDocument();
    expect(vaultsBtn).toHaveTextContent('3');
  });

  it('renders amber indicator dot on Vaults tab in BottomDock when upcomingBillsCount > 0', () => {
    const { container } = render(
      <BottomDock
        activeView="overview"
        onViewChange={vi.fn()}
        upcomingBillsCount={2}
      />
    );

    const vaultsBtn = screen.getByRole('button', { name: /Vaults/i });
    expect(vaultsBtn).toBeInTheDocument();
    const dot = container.querySelector('.bg-amber-400');
    expect(dot).toBeInTheDocument();
  });
});
