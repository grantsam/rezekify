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
    expect(screen.getAllByText('Rp 133.333')[0]).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/15 hari tersisa dalam siklus bulanan/i)).toBeInTheDocument();

    // Tile 2: Kas Bebas Operasional
    expect(screen.getByText('KAS BEBAS OPERASIONAL')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 2.000.000')[0]).toBeInTheDocument();

    // Tile 3: Cadangan Terkunci
    expect(screen.getByText('CADANGAN TERKUNCI (VAULTS)')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 1.000.000')[0]).toBeInTheDocument();
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
