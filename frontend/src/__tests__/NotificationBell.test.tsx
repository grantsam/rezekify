import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotificationBell } from '../components/NotificationBell';
import { UpcomingBill } from '../types/api';

describe('NotificationBell Component & Popover', () => {
  const sampleBills: UpcomingBill[] = [
    {
      name: 'Kost Bulanan',
      target_amount: 850000,
      allocated_amount: 0,
      target_date: '2026-10-16',
      days_until_due: 3,
    },
    {
      name: 'WiFi Indihome',
      target_amount: 320000,
      allocated_amount: 150000,
      target_date: '2026-10-18',
      days_until_due: 5,
    },
  ];

  it('renders notification bell button without badge when upcomingBills is empty', () => {
    render(<NotificationBell upcomingBills={[]} onViewChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Notifikasi Tagihan/i })).toBeInTheDocument();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('renders amber badge with count when bills exist', () => {
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={vi.fn()} />);
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
    expect(badge.className).toContain('bg-amber-500');
  });

  it('opens popover showing list of impending bills on click', () => {
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={vi.fn()} />);
    const bellBtn = screen.getByRole('button', { name: /Notifikasi Tagihan/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText('Tagihan Mendatang (H-7)')).toBeInTheDocument();
    expect(screen.getByText('Kost Bulanan')).toBeInTheDocument();
    expect(screen.getByText('WiFi Indihome')).toBeInTheDocument();
    expect(screen.getByText(/Rp 850\.000/)).toBeInTheDocument();
  });

  it('triggers onViewChange("vaults") when clicking "Buka Komitmen & Vaults" shortcut', () => {
    const handleViewChange = vi.fn();
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={handleViewChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Notifikasi Tagihan/i }));

    const shortcutBtn = screen.getByRole('button', { name: /Buka Komitmen & Vaults/i });
    fireEvent.click(shortcutBtn);

    expect(handleViewChange).toHaveBeenCalledWith('vaults');
  });

  it('displays reassurance empty state when opened with 0 upcoming bills', () => {
    render(<NotificationBell upcomingBills={[]} onViewChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Notifikasi Tagihan/i }));

    expect(screen.getByText('Semua Komitmen Aman')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tagihan mendesak dalam 7 hari ke depan.')).toBeInTheDocument();
  });
});
