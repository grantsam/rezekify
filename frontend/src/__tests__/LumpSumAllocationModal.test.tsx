import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LumpSumAllocationModal } from '../components/LumpSumAllocationModal';
import { Vault, Account } from '../types/api';
import * as apiClient from '../services/apiClient';

const mockVaults: Vault[] = [
  {
    id: 'vault-bill',
    name: 'Listrik PLN',
    vault_type: 'FIXED_BILL',
    target_amount: 500000,
    allocated_amount: 0,
    is_locked: false,
    target_date: '2026-11-01',
  },
  {
    id: 'vault-sav',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 2000000,
    allocated_amount: 500000,
    is_locked: false,
  },
];

const mockAccounts: Account[] = [
  {
    id: 'acc-bca',
    name: 'BCA Rekening',
    account_type: 'BANK',
    current_balance: 10000000,
    is_active: true,
  },
];

describe('LumpSumAllocationModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, total input, account selector, and vault rows', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText(/Alokasi Lump-Sum Multi-Vault/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Masukkan total nominal/i)).toBeInTheDocument();
    expect(screen.getByText(/Listrik PLN/i)).toBeInTheDocument();
    expect(screen.getByText(/Dana Darurat/i)).toBeInTheDocument();
  });

  it('calculates Priority Bills distribution when total amount is entered', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1500000' } });

    // Priority bill deficit = 500.000 -> bill gets 500.000, savings deficit = 1.500.000 -> gets remainder 1.000.000
    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i) as HTMLInputElement;
    const savInput = screen.getByLabelText(/Alokasi Dana Darurat/i) as HTMLInputElement;

    expect(billInput.value).toBe('500000');
    expect(savInput.value).toBe('1000000');
    expect(screen.getByText(/Alokasi Pas/i)).toBeInTheDocument();
  });

  it('disables submit button when allocated sum does not match total amount', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1000000' } });

    // Manually edit bill input to cause mismatch
    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i);
    fireEvent.change(billInput, { target: { value: '200000' } });

    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Sisa dana belum dialokasikan/i)).toBeInTheDocument();
  });

  it('submits valid distribution request and triggers onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const distributeSpy = vi.spyOn(apiClient, 'distributeToVaults').mockResolvedValueOnce({
      total_allocated: 1500000,
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

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1500000' } });

    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(distributeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 1500000,
          allocations: [
            { vault_id: 'vault-bill', amount: 500000 },
            { vault_id: 'vault-sav', amount: 1000000 },
          ],
        })
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calculates Proportional distribution when proportional strategy is selected', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    // Switch strategy to Proportional
    const propTab = screen.getByRole('tab', { name: /Prorata Target/i });
    fireEvent.click(propTab);

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    // Total deficit: Listrik PLN deficit 500.000, Dana Darurat deficit 1.500.000. Total deficit = 2.000.000.
    // Total amount = 1.000.000
    // Proportional:
    // Listrik PLN gets 500k/2000k * 1.000.000 = 250.000
    // Dana Darurat gets 1500k/2000k * 1.000.000 = 750.000
    fireEvent.change(input, { target: { value: '1000000' } });

    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i) as HTMLInputElement;
    const savInput = screen.getByLabelText(/Alokasi Dana Darurat/i) as HTMLInputElement;

    expect(billInput.value).toBe('250000');
    expect(savInput.value).toBe('750000');
    expect(screen.getByText(/Alokasi Pas/i)).toBeInTheDocument();
  });

  it('increments total amount when quick chips are clicked', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const chip1jt = screen.getByRole('button', { name: /\+1jt/i });
    fireEvent.click(chip1jt);

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i) as HTMLInputElement;
    expect(input.value).toBe('1000000');

    // Clicking +500rb adds 500.000 -> 1.500.000
    const chip500rb = screen.getByRole('button', { name: /\+500rb/i });
    fireEvent.click(chip500rb);
    expect(input.value).toBe('1500000');
  });

  it('disables submit when selected source account balance is less than total amount', () => {
    const poorAccounts: Account[] = [
      {
        id: 'acc-wallet',
        name: 'GoPay',
        account_type: 'EWALLET',
        current_balance: 100000,
        is_active: true,
      },
    ];

    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={poorAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '500000' } });

    // Select GoPay as source account
    const select = screen.getByLabelText(/Rekening Sumber/i);
    fireEvent.change(select, { target: { value: 'acc-wallet' } });

    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Saldo rekening tidak mencukupi/i)).toBeInTheDocument();
  });

  it('clamps negative manual allocation keystroke inputs to zero', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i) as HTMLInputElement;
    fireEvent.change(billInput, { target: { value: '-25000' } });

    expect(billInput.value).toBe('0');
  });
});
