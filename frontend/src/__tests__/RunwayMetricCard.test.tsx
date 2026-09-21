import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunwayMetricCard } from '../components/RunwayMetricCard';
import { DashboardSummaryResponse } from '../types/api';

describe('RunwayMetricCard Component', () => {
  const mockHealthySummary: DashboardSummaryResponse = {
    total_liquid_cash: 3000000,
    vault_locked_cash: 1000000,
    operational_free_cash: 2000000,
    days_remaining: 25,
    daily_safe_runway: 80000,
    health_status: 'HEALTHY',
    upcoming_bills: [],
  };

  const mockWarningSummary: DashboardSummaryResponse = {
    ...mockHealthySummary,
    health_status: 'WARNING',
    daily_safe_runway: 30000,
  };

  const mockCriticalSummary: DashboardSummaryResponse = {
    ...mockHealthySummary,
    health_status: 'CRITICAL',
    daily_safe_runway: 5000,
  };

  it('renders skeleton loader when summary is null and onOpenAuth is omitted', () => {
    render(<RunwayMetricCard summary={null} />);
    expect(screen.getByTestId('runway-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/Belum Terautentikasi/i)).not.toBeInTheDocument();
  });

  it('renders gentle auth prompt when summary is null and onOpenAuth is provided', () => {
    const onOpenAuth = vi.fn();
    render(<RunwayMetricCard summary={null} onOpenAuth={onOpenAuth} />);

    expect(screen.getByText('Batas Belanja Harian (Runway)')).toBeInTheDocument();
    expect(screen.getByText('Akses Telemetri Keuangan')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Masuk \/ Buat Akun/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onOpenAuth).toHaveBeenCalledTimes(1);
  });

  it('renders healthy state with "Aman Terkendali", formatted amounts, and breakdown columns', () => {
    render(<RunwayMetricCard summary={mockHealthySummary} />);

    expect(screen.getByText('Batas Belanja Harian (Runway)')).toBeInTheDocument();
    expect(screen.getByText('Aman Terkendali')).toBeInTheDocument();
    expect(screen.getByText(/Rp 80\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ hari/i)).toBeInTheDocument();
    expect(screen.getByText(/25 hari ke depan/i)).toBeInTheDocument();

    // Check breakdown columns
    expect(screen.getByText('Kas Bebas Pakai')).toBeInTheDocument();
    expect(screen.getByText(/Rp 2\.000\.000/i)).toBeInTheDocument();
    expect(screen.getByText('Cadangan Terkunci')).toBeInTheDocument();
    expect(screen.getByText(/Rp 1\.000\.000/i)).toBeInTheDocument();
  });

  it('renders warning status with "Mode Waspada"', () => {
    render(<RunwayMetricCard summary={mockWarningSummary} />);
    expect(screen.getByText('Mode Waspada')).toBeInTheDocument();
  });

  it('renders critical status with "Mode Hemat Ketat" and avoids punitive "Insolvent" jargon', () => {
    render(<RunwayMetricCard summary={mockCriticalSummary} />);
    expect(screen.getByText('Mode Hemat Ketat')).toBeInTheDocument();
    expect(screen.queryByText(/Insolvent/i)).not.toBeInTheDocument();
  });
});
