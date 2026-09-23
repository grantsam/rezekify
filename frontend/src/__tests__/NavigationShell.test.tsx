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
