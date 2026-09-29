import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatTransactionCard } from '../components/ChatTransactionCard';
import { TransactionSummary } from '../types/api';

describe('ChatTransactionCard Component', () => {
  const sampleTx: TransactionSummary = {
    id: 'tx-123',
    amount: 45000,
    account_name: 'BCA',
    category_name: 'Makanan',
    description: 'Makan siang padang',
    type: 'EXPENSE',
    account_balance_after: 955000,
  };

  it('renders amount, account, category, description, and balance after', () => {
    render(<ChatTransactionCard transaction={sampleTx} onCancel={vi.fn()} onViewLedger={vi.fn()} />);
    expect(screen.getByText(/Rp\s*45[.,]000/)).toBeInTheDocument();
    expect(screen.getByText('BCA')).toBeInTheDocument();
    expect(screen.getByText('Makanan')).toBeInTheDocument();
    expect(screen.getByText('Makan siang padang')).toBeInTheDocument();
    expect(screen.getByText(/955[.,]000/)).toBeInTheDocument();
  });

  it('handles cancel transaction action and displays loading and cancelled state', async () => {
    const handleCancel = vi.fn().mockResolvedValue(undefined);
    render(<ChatTransactionCard transaction={sampleTx} onCancel={handleCancel} onViewLedger={vi.fn()} />);
    const cancelBtn = screen.getByRole('button', { name: /batalkan transaksi/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(handleCancel).toHaveBeenCalledWith('tx-123');
      expect(screen.getByText(/dibatalkan/i)).toBeInTheDocument();
    });
  });

  it('handles view in ledger action', () => {
    const handleViewLedger = vi.fn();
    render(<ChatTransactionCard transaction={sampleTx} onCancel={vi.fn()} onViewLedger={handleViewLedger} />);
    const ledgerBtn = screen.getByRole('button', { name: /buka di buku besar/i });
    fireEvent.click(ledgerBtn);
    expect(handleViewLedger).toHaveBeenCalledTimes(1);
  });

  it('displays initial cancelled state properly when isInitiallyCancelled is true', () => {
    render(<ChatTransactionCard transaction={sampleTx} onCancel={vi.fn()} isInitiallyCancelled={true} />);
    expect(screen.getByText(/dibatalkan/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /batalkan transaksi/i })).not.toBeInTheDocument();
  });

  it('renders correct prefix and colors for income and transfer types', () => {
    const incomeTx: TransactionSummary = {
      ...sampleTx,
      id: 'tx-inc',
      type: 'INCOME',
      amount: 150000,
    };
    const { rerender } = render(<ChatTransactionCard transaction={incomeTx} onCancel={vi.fn()} />);
    expect(screen.getByText(/\+\s*Rp\s*150[.,]000/)).toBeInTheDocument();

    const transferTx: TransactionSummary = {
      ...sampleTx,
      id: 'tx-trf',
      type: 'TRANSFER',
      amount: 50000,
    };
    rerender(<ChatTransactionCard transaction={transferTx} onCancel={vi.fn()} />);
    expect(screen.getByText(/↔\s*Rp\s*50[.,]000/)).toBeInTheDocument();
  });
});
