import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecentTransactionsCard } from '../components/RecentTransactionsCard';
import { Transaction } from '../types/api';

describe('RecentTransactionsCard Component', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Nasi Padang',
      source_channel: 'WEB_MANUAL',
      amount: 35000,
      type: 'EXPENSE',
      category_name: 'Makanan',
      account_name: 'BCA',
      transaction_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      description: 'Transfer Gaji',
      source_channel: 'WEB_MANUAL',
      amount: 5000000,
      type: 'INCOME',
      category_name: 'Gaji',
      account_name: 'BCA',
      transaction_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  it('renders title, transaction list with formatted amounts, and view all button', () => {
    const handleViewAll = vi.fn();
    render(<RecentTransactionsCard transactions={sampleTransactions} isLoading={false} onViewAll={handleViewAll} />);

    expect(screen.getByText('Transaksi Terakhir')).toBeInTheDocument();
    expect(screen.getByText('Makan Nasi Padang')).toBeInTheDocument();
    expect(screen.getByText('Transfer Gaji')).toBeInTheDocument();
    expect(screen.getByText(/- Rp\s*35[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Rp\s*5[.,]000[.,]000/)).toBeInTheDocument();

    const viewAllBtn = screen.getByRole('button', { name: /lihat semua di buku besar/i });
    fireEvent.click(viewAllBtn);
    expect(handleViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders friendly empty state when no transactions exist', () => {
    render(<RecentTransactionsCard transactions={[]} isLoading={false} onViewAll={vi.fn()} />);
    expect(screen.getByText(/belum ada transaksi/i)).toBeInTheDocument();
  });
});
