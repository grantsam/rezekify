import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OverviewView } from '../components/OverviewView';
import { DashboardSummaryResponse, Vault, Account, Transaction } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('OverviewView Component', () => {
  const mockSummary: DashboardSummaryResponse = {
    total_liquid_cash: 3000000,
    vault_locked_cash: 1000000,
    operational_free_cash: 2000000,
    days_remaining: 15,
    daily_safe_runway: 133333,
    today_spent: 35000,
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

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Nasi Padang',
      source_channel: 'WEB_MANUAL',
      amount: 35000,
      type: 'EXPENSE',
      category_name: 'Makanan',
      account_name: 'BCA Utama',
      transaction_date: '2026-09-28T12:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return {
          period: 'daily',
          daily_safe_runway: 133333,
          total_spent_in_period: 35000,
          items: [],
        };
      }
      return null;
    });
  });

  it('renders Tier 1 Status Keuangan Hari Ini hero card with correct telemetry', async () => {
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    // Health badge
    expect(screen.getByText('Aman Terkendali')).toBeInTheDocument();

    // Jatah Belanja Hari Ini
    expect(screen.getByText('Jatah Belanja Hari Ini')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*133\.333/)).toBeInTheDocument();

    // Pengeluaran Hari Ini & Sisa Jatah Hari Ini
    expect(screen.getByText(/Pengeluaran Hari Ini/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Rp\s*35\.000/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Sisa Jatah Hari Ini/i)).toBeInTheDocument();
    // 133333 - 35000 = 98333
    expect(screen.getByText(/Rp\s*98\.333/)).toBeInTheDocument();

    // Saldo Bebas Pakai
    expect(screen.getByText(/Saldo Bebas Pakai/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Rp\s*2\.000\.000/)[0]).toBeInTheDocument();

    // Sisa hari siklus
    expect(screen.getByText(/15 hari lagi menuju siklus baru/i)).toBeInTheDocument();
  });

  it('renders negative remaining budget correctly when today_spent exceeds daily runway', () => {
    const overspentSummary: DashboardSummaryResponse = {
      ...mockSummary,
      daily_safe_runway: 100000,
      today_spent: 150000,
      health_status: 'WARNING',
    };

    render(
      <OverviewView
        summary={overspentSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    expect(screen.getByText('Waspada')).toBeInTheDocument();
    expect(screen.getByText(/Melebihi jatah:\s*Rp\s*50\.000/i)).toBeInTheDocument();
  });

  it('renders Tier 2 side-by-side: ExpenseCharts and RecentTransactionsCard and handles navigation to ledger', () => {
    const handleNavigateToLedger = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToLedger={handleNavigateToLedger}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    // RecentTransactionsCard rendered with transaction item
    expect(screen.getByText('Transaksi Terakhir')).toBeInTheDocument();
    expect(screen.getByText('Makan Nasi Padang')).toBeInTheDocument();

    // Clicking "Lihat Semua di Buku Besar" invokes onNavigateToLedger
    const viewAllBtn = screen.getByRole('button', { name: /Lihat Semua di Buku Besar/i });
    fireEvent.click(viewAllBtn);
    expect(handleNavigateToLedger).toHaveBeenCalledTimes(1);
  });

  it('renders Tier 3 side-by-side: UpcomingBillsCard and Priority Vaults card', () => {
    const handleNavigateToVaults = vi.fn();
    const handleOpenSimulate = vi.fn();

    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={handleNavigateToVaults}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={handleOpenSimulate}
      />
    );

    // Upcoming bills
    expect(screen.getByText('Listrik PLN')).toBeInTheDocument();

    // Priority Vaults
    expect(screen.getByText('Komitmen & Vaults Prioritas')).toBeInTheDocument();
    expect(screen.getByText('Simpanan Pajak')).toBeInTheDocument();
    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();

    // Simulate button in vaults card
    const simBtn = screen.getByRole('button', { name: /Simulasi Belanja/i });
    fireEvent.click(simBtn);
    expect(handleOpenSimulate).toHaveBeenCalledTimes(1);

    // View all vaults button
    const viewAllVaultsBtn = screen.getByRole('button', { name: /Lihat Semua Vault/i });
    fireEvent.click(viewAllVaultsBtn);
    expect(handleNavigateToVaults).toHaveBeenCalledTimes(1);
  });

  it('does NOT render RunwayMetricCard in OverviewView', () => {
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    // RunwayMetricCard has text "Batas Belanja Harian (Runway)" and "DAILY SAFE RUNWAY"
    expect(screen.queryByText('Batas Belanja Harian (Runway)')).not.toBeInTheDocument();
    expect(screen.queryByText('DAILY SAFE RUNWAY')).not.toBeInTheDocument();
  });

  it('renders friendly onboarding card when accounts is empty', () => {
    const handleOpenCreateAccount = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={[]}
        accounts={[]}
        transactions={[]}
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

  it('renders AISpotlightHero and invokes onOpenChat when prompt chips or copilot button clicked', () => {
    const handleOpenChat = vi.fn();
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={mockTransactions}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
        onOpenChat={handleOpenChat}
      />
    );

    expect(screen.getByText('Asisten AI Rezekify')).toBeInTheDocument();
    const promptBtn = screen.getByRole('button', { name: /Makan siang 35rb Gopay/i });
    fireEvent.click(promptBtn);
    expect(handleOpenChat).toHaveBeenCalledWith('Makan siang 35rb Gopay');

    const openCopilotBtn = screen.getByRole('button', { name: /Buka AI Copilot/i });
    fireEvent.click(openCopilotBtn);
    expect(handleOpenChat).toHaveBeenCalledTimes(2);
  });
});
