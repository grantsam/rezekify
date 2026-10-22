import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    const statusTitle = screen.getByText('STATUS KEUANGAN HARI INI');
    expect(statusTitle).toHaveClass('text-emerald-600');

    // Jatah Belanja Hari Ini
    expect(screen.getByText('Jatah Belanja Hari Ini')).toBeInTheDocument();
    expect(screen.getAllByText(/Rp\s*133\.333/)[0]).toBeInTheDocument();

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

    // Mathematical Reconciliation Strip
    expect(screen.getByText('Total Kas:')).toBeInTheDocument();
    expect(screen.getByText('Terkunci di Pos/Tagihan:')).toBeInTheDocument();
    expect(screen.getByText('Bebas Pakai:')).toBeInTheDocument();
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
    expect(screen.getByText('STATUS KEUANGAN HARI INI')).toHaveClass('text-amber-600');
    expect(screen.getByText(/Jatah hari ini terlampaui/i)).toBeInTheDocument();
    expect(screen.getByText('Total Kas:')).toBeInTheDocument();
    expect(screen.getByText('Terkunci di Pos/Tagihan:')).toBeInTheDocument();
    expect(screen.getByText('Bebas Pakai:')).toBeInTheDocument();
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
    expect(screen.getAllByText('Rp 1.000.000')[0]).toBeInTheDocument();
    expect(screen.getByText('/ Rp 1.500.000')).toBeInTheDocument();

    const vaultProgress = screen.getByRole('progressbar', { name: /Progres Simpanan Pajak/i });
    expect(vaultProgress).toBeInTheDocument();
    expect(vaultProgress).toHaveAttribute('aria-valuenow', '67');

    // Simulate button in vaults card
    const simBtn = screen.getByRole('button', { name: /^Simulasi Belanja$/i });
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

  it('renders serene empty state directly via UpcomingBillsCard when upcoming_bills is empty', () => {
    const emptyBillsSummary: DashboardSummaryResponse = {
      ...mockSummary,
      upcoming_bills: [],
    };
    render(
      <OverviewView
        summary={emptyBillsSummary}
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
    expect(screen.getByText('Semua Komitmen Aman')).toBeInTheDocument();
  });

  it('triggers onDepositVault and onPayBillVault when action buttons are clicked in priority vaults list', () => {
    const handleDeposit = vi.fn();
    const handlePayBill = vi.fn();

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
        onDepositVault={handleDeposit}
        onPayBillVault={handlePayBill}
      />
    );

    const payBillBtn = screen.getByRole('button', { name: /Bayar Tagihan/i });
    expect(payBillBtn).toBeInTheDocument();
    fireEvent.click(payBillBtn);
    expect(handlePayBill).toHaveBeenCalledWith(mockVaults[0]);

    const depositBtn = screen.getByRole('button', { name: /\+ Nabung/i });
    expect(depositBtn).toBeInTheDocument();
    fireEvent.click(depositBtn);
    expect(handleDeposit).toHaveBeenCalledWith(mockVaults[1]);
  });

  it('renders QuickCaptureBar and handles transaction submission triggering onRefreshData', async () => {
    const handleRefreshData = vi.fn();
    const submitChatSpy = vi.spyOn(apiClient, 'submitChatMessage').mockResolvedValue({
      reply: 'Tercatat: Makan siang Rp 25.000 (GoPay)',
      message_id: 'msg-1',
      transaction: null,
    });

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
        onRefreshData={handleRefreshData}
      />
    );

    const input = screen.getByPlaceholderText('Ketik mutasi, drop foto struk kasir, atau rekam suara...');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Makan siang 25rb Gopay' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(submitChatSpy).toHaveBeenCalledWith('Makan siang 25rb Gopay');
    await waitFor(() => {
      expect(handleRefreshData).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Tercatat: Makan siang Rp 25.000 (GoPay)')).toBeInTheDocument();
  });

  describe('in-cockpit pre-purchase simulation drawer', () => {
    it('expands and collapses in-cockpit pre-purchase simulation drawer on trigger button click', () => {
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

      const toggleBtn = screen.getByRole('button', { name: /Cek Dampak Belanja/i });
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Tutup Simulasi/i })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('runway-simulation-panel')).toBeInTheDocument();

      // Collapse again
      fireEvent.click(screen.getByRole('button', { name: /Tutup Simulasi/i }));
      expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();
    });

    it('calculates projected runway and delta deterministically on client without API calls', () => {
      render(
        <OverviewView
          summary={mockSummary} // operational_free_cash: 2,000,000, days_remaining: 15, daily_safe_runway: 133,333
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
      const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

      // Type planned amount: 500,000 -> projected free cash = 1,500,000 -> projected daily = 100,000 -> delta = 33,333
      fireEvent.change(input, { target: { value: '500000' } });

      expect(screen.getByTestId('projected-daily-runway')).toHaveTextContent('Rp 100.000');
      expect(screen.getByTestId('simulation-daily-drop')).toHaveTextContent('-Rp 33.333');
      expect(screen.getByTestId('projected-free-cash')).toHaveTextContent('Rp 1.500.000');
      expect(screen.getByText(/Belanja aman/i)).toBeInTheDocument();
    });

    it('increments planned nominal cumulatively when quick chips are clicked and resets nominal on reset button click', () => {
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

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
      const input = screen.getByPlaceholderText(/Misal: 150\.000/i) as HTMLInputElement;

      // Quick chips have descriptive aria-labels
      const chip50k = screen.getByRole('button', { name: /Tambah 50 ribu rupiah/i });
      expect(chip50k).toBeInTheDocument();
      fireEvent.click(chip50k);
      expect(input.value).toBe('50.000');

      const chip100k = screen.getByRole('button', { name: /Tambah 100 ribu rupiah/i });
      expect(chip100k).toBeInTheDocument();
      fireEvent.click(chip100k);
      expect(input.value).toBe('150.000');

      // Reset button clears nominal
      fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
      expect(input.value).toBe('');
    });

    it('aligns status with dynamic safe_runway_threshold (50k vs default 30k) (Review Focus 4)', () => {
      const customSummary = {
        ...mockSummary,
        operational_free_cash: 600000,
        days_remaining: 15,
        daily_safe_runway: 40000,
        safe_runway_threshold: 50000,
      };

      render(
        <OverviewView
          summary={customSummary}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
      const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

      // Projected runway: (600,000 - 150,000) / 15 = 30,000.
      // With safe_runway_threshold = 50,000, 30,000 is WARNING (Waspada)
      fireEvent.change(input, { target: { value: '150000' } });
      expect(screen.getByTestId('simulation-status-badge')).toHaveTextContent(/Waspada/i);
    });

    it('handles deficit when planned amount exceeds operational free cash and guards against zero days remaining (Review Focus 1, 2)', () => {
      const zeroDaysSummary = {
        ...mockSummary,
        operational_free_cash: 100000,
        days_remaining: 0,
        daily_safe_runway: 100000,
      };

      render(
        <OverviewView
          summary={zeroDaysSummary}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
      const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

      // Amount exceeds free cash (200,000 > 100,000)
      fireEvent.change(input, { target: { value: '200000' } });

      expect(screen.getByTestId('simulation-status-badge')).toHaveTextContent(/Defisit/i);
      expect(screen.getByText(/Nominal melebihi saldo bebas pakai saat ini/i)).toBeInTheDocument();
      expect(screen.getByTestId('projected-free-cash')).toHaveTextContent('Rp 0');
    });

    it('sanitizes invalid or negative input strings without NaN (Review Focus 3)', () => {
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

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
      const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

      fireEvent.change(input, { target: { value: 'abc-50.000xyz' } });
      expect(screen.getByTestId('projected-daily-runway')).not.toHaveTextContent('NaN');
    });

    it('bridges planned amount into QuickCaptureBar via draftText and closes simulation drawer (Review Focus 5)', () => {
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

      fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));

      // Projected calculation card has aria-live="polite"
      const projectedCard = screen.getByTestId('projected-card');
      expect(projectedCard).toBeInTheDocument();
      expect(projectedCard).toHaveAttribute('aria-live', 'polite');

      // Bridge button is disabled when nominal <= 0
      const bridgeBtn = screen.getByRole('button', { name: /Lanjut Catat Pengeluaran/i });
      expect(bridgeBtn).toBeDisabled();

      const input = screen.getByPlaceholderText(/Misal: 150\.000/i);
      fireEvent.change(input, { target: { value: '150000' } });

      expect(bridgeBtn).not.toBeDisabled();
      fireEvent.click(bridgeBtn);

      // Drawer closed
      expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();

      // QuickCaptureBar command input populated
      const commandInput = screen.getByPlaceholderText(/Ketik mutasi/i) as HTMLInputElement;
      expect(commandInput.value).toBe('Beli Rp 150.000');
    });
  });

  describe('contextual survival guidance', () => {
    it('renders contextual survival guidance banner with headline and tactical action', () => {
      const criticalSummary: DashboardSummaryResponse = {
        ...mockSummary,
        operational_free_cash: 150000,
        daily_safe_runway: 15000,
        days_remaining: 10,
        survival_guidance: {
          tone: 'CRITICAL',
          headline: 'Mode Hemat Terarah',
          message: 'Jatah harian Rp 15.000/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri.',
          tactical_action: 'Tunda pos hiburan/jajan di luar hingga siklus baru 10 hari lagi.',
        },
      };

      render(
        <OverviewView
          summary={criticalSummary}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      expect(screen.getByText('Mode Hemat Terarah')).toBeInTheDocument();
      expect(screen.getByText(/standar makan harian/i)).toBeInTheDocument();
      expect(screen.getByText(/Tunda pos hiburan/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Buka Simulasi Belanja/i })).toBeInTheDocument();
    });

    it('invokes simulation drawer toggle when clicking Buka Simulasi Belanja in guidance banner', () => {
      const warningSummary: DashboardSummaryResponse = {
        ...mockSummary,
        daily_safe_runway: 25000,
        survival_guidance: {
          tone: 'WARNING',
          headline: 'Mode Waspada Santai',
          message: 'Jatah harian Rp 25.000/hari cukup untuk kebutuhan harian, namun mendekati batas aman.',
          tactical_action: 'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.',
        },
      };

      render(
        <OverviewView
          summary={warningSummary}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      const simBtn = screen.getByRole('button', { name: /Buka Simulasi Belanja/i });
      fireEvent.click(simBtn);

      // Verifies the in-cockpit simulation panel expands
      expect(screen.getByTestId('runway-simulation-panel')).toBeInTheDocument();
    });

    it('navigates to vaults when clicking Lihat Pos in Tier 1 Mode Pertahanan Kas', () => {
      const handleNavigateToVaults = vi.fn();
      const emptyCashSummary: DashboardSummaryResponse = {
        ...mockSummary,
        operational_free_cash: 0,
        daily_safe_runway: 0,
        survival_guidance: {
          tone: 'CRITICAL',
          headline: 'Mode Pertahanan Kas',
          message: 'Kas operasional bebas telah habis untuk siklus ini.',
          tactical_action: 'Tinjau pos tabungan atau kurangi belanja non-esensial selama 15 hari ke depan.',
        },
      };

      render(
        <OverviewView
          summary={emptyCashSummary}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={handleNavigateToVaults}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      const vaultsCta = screen.getByRole('button', { name: /Lihat Pos Simpanan/i });
      fireEvent.click(vaultsCta);
      expect(handleNavigateToVaults).toHaveBeenCalledTimes(1);
    });

    it('falls back to deterministic client calculation if summary has no survival_guidance (Review Focus 5)', () => {
      const summaryWithoutGuidance: DashboardSummaryResponse = {
        ...mockSummary,
        operational_free_cash: 180000,
        daily_safe_runway: 18000,
        days_remaining: 10,
        survival_guidance: undefined,
      };

      render(
        <OverviewView
          summary={summaryWithoutGuidance}
          vaults={mockVaults}
          accounts={mockAccounts}
          isLoading={false}
          refreshTrigger={0}
          onNavigateToVaults={vi.fn()}
          onOpenCreateAccount={vi.fn()}
          onOpenSimulateModal={vi.fn()}
        />
      );

      // Client fallback generated Mode Hemat Terarah
      expect(screen.getByText('Mode Hemat Terarah')).toBeInTheDocument();
      expect(screen.getByText(/Rp 18\.000\/hari/)).toBeInTheDocument();
    });
  });
});
