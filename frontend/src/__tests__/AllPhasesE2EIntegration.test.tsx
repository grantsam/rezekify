import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OverviewView } from '../components/OverviewView';
import { LumpSumAllocationModal } from '../components/LumpSumAllocationModal';
import { DashboardSummaryResponse, Vault, Account } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('All Phases (6, 7, 8, 9, 10) End-to-End Frontend Integration', () => {
  const mockSummary: DashboardSummaryResponse = {
    total_liquid_cash: 5000000,
    vault_locked_cash: 4500000,
    operational_free_cash: 500000,
    days_remaining: 20,
    daily_safe_runway: 25000,
    today_spent: 0,
    safe_runway_threshold: 30000,
    health_status: 'WARNING',
    survival_guidance: {
      tone: 'WARNING',
      headline: 'Mode Waspada Santai',
      message: 'Jatah harian Rp 25.000/hari cukup untuk kebutuhan harian, namun mendekati batas aman.',
      tactical_action: 'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.',
    },
    upcoming_bills: [
      {
        name: 'Listrik PLN',
        target_amount: 500000,
        allocated_amount: 0,
        target_date: '2026-10-27',
        days_until_due: 3,
      },
    ],
  };

  const mockVaults: Vault[] = [
    {
      id: 'vault-listrik',
      name: 'Listrik PLN',
      vault_type: 'FIXED_BILL',
      target_amount: 500000,
      allocated_amount: 0,
      target_date: '2026-10-27',
      is_locked: false,
    },
    {
      id: 'vault-darurat',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 1000000,
      is_locked: false,
    },
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc-bca',
      name: 'BCA Rekening',
      account_type: 'BANK',
      current_balance: 5000000,
      is_active: true,
    },
  ];

  const mockDailySpending = {
    period: 'daily' as const,
    daily_safe_runway: 25000,
    total_spent_in_period: 35000,
    items: [
      {
        date: '2026-10-22',
        day_label: 'Kam',
        amount: 35000,
        safe_runway_threshold: 30000,
        is_over_budget: true,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return mockDailySpending;
      }
      return null;
    });
  });

  it('completes the entire end-to-end user story across Phases 6, 8, 9, and 10', async () => {
    // 1. Render OverviewView with comprehensive summary
    render(
      <OverviewView
        summary={mockSummary}
        vaults={mockVaults}
        accounts={mockAccounts}
        transactions={[]}
        isLoading={false}
        refreshTrigger={0}
        onNavigateToVaults={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onOpenSimulateModal={vi.fn()}
      />
    );

    // 2. Phase 9 Test: Verify survival-guidance-banner renders headline, message, and action button
    const banner = screen.getByTestId('survival-guidance-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Mode Waspada Santai');
    expect(banner).toHaveTextContent(
      'Jatah harian Rp 25.000/hari cukup untuk kebutuhan harian, namun mendekati batas aman.'
    );
    expect(banner).toHaveTextContent(
      'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.'
    );

    const simulationActionBtn = screen.getByRole('button', { name: /Buka Simulasi Belanja/i });
    expect(simulationActionBtn).toBeInTheDocument();

    // 3. Phase 6 Test: Expand simulation panel, type planned amount, verify projection and quick-capture prefill
    const expandSimBtn = screen.getByRole('button', { name: /^Simulasi Belanja$/i });
    fireEvent.click(expandSimBtn);

    const simPanel = await screen.findByTestId('runway-simulation-panel');
    expect(simPanel).toBeInTheDocument();

    const nominalInput = screen.getByPlaceholderText(/Misal: 150\.000/i);
    fireEvent.change(nominalInput, { target: { value: '150000' } });

    // Verify side-by-side projected runway and daily drop delta
    // Free cash = 500k, planned = 150k -> projected free = 350k. Days = 20 -> projected runway = 17.500. Drop = 25.000 - 17.500 = 7.500
    const projectedRunwayEl = screen.getByTestId('projected-daily-runway');
    expect(projectedRunwayEl).toHaveTextContent(/Rp\s*17\.500/);

    const dropEl = screen.getByTestId('simulation-daily-drop');
    expect(dropEl).toHaveTextContent(/-Rp\s*7\.500/);

    // Click "Lanjut Catat Pengeluaran" and verify prefill in QuickCaptureBar
    const recordBtn = screen.getByRole('button', { name: /Lanjut Catat Pengeluaran/i });
    fireEvent.click(recordBtn);

    const quickCaptureInput = screen.getByPlaceholderText(/Ketik mutasi, drop foto struk kasir/i);
    expect(quickCaptureInput).toHaveValue('Beli Rp 150.000');

    // 4. Phase 10 Test: Verify elevated safe runway badge renders in ExpenseCharts with zero tooltip collision
    const headerBadge = await screen.findByTestId('safe-runway-header-badge');
    expect(headerBadge).toBeInTheDocument();
    expect(headerBadge).toHaveTextContent(/Batas Aman: Rp 25\.000\/hari/i);

    // Verify badge is positioned in the chart header outside the bar/tooltip canvas region
    const chartRegion = screen.getByRole('region', {
      name: /Grafik pengeluaran 7 hari terakhir vs ambang batas aman runway/i,
    });
    expect(chartRegion).not.toContainElement(headerBadge);
  });

  it('Phase 8 Test: LumpSumAllocationModal computes priority bills distribution, enforces conservation, and calls distributeToVaults', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const distributeSpy = vi.spyOn(apiClient, 'distributeToVaults').mockResolvedValueOnce({
      total_allocated: 2000000,
      source_account_id: 'acc-bca',
      vaults: mockVaults,
    });

    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    // Enter 2000000
    const totalInput = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(totalInput, { target: { value: '2000000' } });

    // Select source account
    const sourceSelect = screen.getByLabelText(/Rekening Sumber/i);
    fireEvent.change(sourceSelect, { target: { value: 'acc-bca' } });

    // Select PRIORITY_BILLS strategy tab
    const priorityTab = screen.getByRole('tab', { name: /Prioritas Tagihan/i });
    fireEvent.click(priorityTab);

    // Assert exact sum conservation: Listrik PLN gets 500.000, Dana Darurat gets remainder 1.500.000
    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i) as HTMLInputElement;
    const savInput = screen.getByLabelText(/Alokasi Dana Darurat/i) as HTMLInputElement;

    expect(billInput.value).toBe('500000');
    expect(savInput.value).toBe('1500000');
    expect(screen.getByText(/Alokasi Pas/i)).toBeInTheDocument();

    // Submit and assert apiClient.distributeToVaults call
    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(distributeSpy).toHaveBeenCalledTimes(1);
      expect(distributeSpy).toHaveBeenCalledWith({
        total_amount: 2000000,
        source_account_id: 'acc-bca',
        allocations: [
          { vault_id: 'vault-listrik', amount: 500000 },
          { vault_id: 'vault-darurat', amount: 1500000 },
        ],
      });
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
