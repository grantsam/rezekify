import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';
import { Vault } from '../types/api';

describe('UpcomingBillsCard Component', () => {
  it('renders upcoming bill warning when bills due within 7 days exist with calm badge for >3 days', () => {
    const mockBills = [
      {
        name: 'Sewa Kos',
        target_amount: 1500000,
        allocated_amount: 500000,
        target_date: '2026-09-23',
        days_until_due: 5,
      },
    ];
    render(<UpcomingBillsCard bills={mockBills} />);
    expect(screen.getByText(/Sewa Kos/i)).toBeInTheDocument();
    expect(screen.getByText(/5 hari lagi/i)).toBeInTheDocument();
    expect(screen.getByText(/Kurang Rp 1.000.000/i)).toBeInTheDocument();
    expect(screen.getByText('H-5')).toBeInTheDocument();
  });

  it('renders high-priority urgency badge with pulsing dot when days_until_due <= 3', () => {
    const mockBills = [
      {
        name: 'Listrik & Air',
        target_amount: 500000,
        allocated_amount: 200000,
        target_date: '2026-09-21',
        days_until_due: 2,
      },
    ];
    render(<UpcomingBillsCard bills={mockBills} />);
    expect(screen.getByText(/Listrik & Air/i)).toBeInTheDocument();
    expect(screen.getByText(/2 hari lagi/i)).toBeInTheDocument();
    const badge = screen.getByText('H-2');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-rose-300');
    expect(badge.className).toContain('bg-rose-500/20');
  });

  it('renders skeleton loader when isLoading is true', () => {
    render(<UpcomingBillsCard isLoading={true} />);
    const skeleton = screen.getByTestId('upcoming-bills-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('renders reassurance card when bills list is empty', () => {
    render(<UpcomingBillsCard bills={[]} />);
    expect(screen.getByTestId('upcoming-bills-empty')).toBeInTheDocument();
    expect(screen.getByText('Semua Komitmen Aman')).toBeInTheDocument();
    expect(
      screen.getByText('Tidak ada tagihan atau komitmen jatuh tempo dalam 7 hari kedepan.')
    ).toBeInTheDocument();
    expect(screen.getByText('H-7 Bersih')).toBeInTheDocument();
  });

  it('renders reassurance card when all bills are due beyond 7 days', () => {
    const nonUrgentBills = [
      {
        name: 'Asuransi Tahunan',
        target_amount: 3000000,
        allocated_amount: 3000000,
        target_date: '2026-10-30',
        days_until_due: 14,
      },
    ];
    render(<UpcomingBillsCard bills={nonUrgentBills} />);
    expect(screen.getByTestId('upcoming-bills-empty')).toBeInTheDocument();
    expect(screen.getByText('Semua Komitmen Aman')).toBeInTheDocument();
  });

  it('renders in-place action buttons and triggers callbacks with matching vault when provided', () => {
    const mockBills = [
      {
        name: 'Listrik & Air',
        target_amount: 500000,
        allocated_amount: 200000,
        target_date: '2026-09-21',
        days_until_due: 2,
      },
    ];
    const mockVaults: Vault[] = [
      {
        id: 'v-1',
        name: 'Listrik & Air',
        vault_type: 'FIXED_BILL',
        target_amount: 500000,
        allocated_amount: 200000,
        target_date: '2026-09-21',
        is_locked: false,
      },
    ];
    const onDepositVault = vi.fn();
    const onPayBillVault = vi.fn();

    render(
      <UpcomingBillsCard
        bills={mockBills}
        vaults={mockVaults}
        onDepositVault={onDepositVault}
        onPayBillVault={onPayBillVault}
      />
    );

    const alokasiBtn = screen.getByRole('button', { name: /Nabung ke Listrik & Air/i });
    const bayarBtn = screen.getByRole('button', { name: /Bayar tagihan Listrik & Air/i });
    expect(alokasiBtn).toBeInTheDocument();
    expect(bayarBtn).toBeInTheDocument();

    fireEvent.click(alokasiBtn);
    expect(onDepositVault).toHaveBeenCalledWith(mockVaults[0]);

    fireEvent.click(bayarBtn);
    expect(onPayBillVault).toHaveBeenCalledWith(mockVaults[0]);
  });
});
