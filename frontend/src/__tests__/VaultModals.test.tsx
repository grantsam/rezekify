import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepositVaultModal } from '../components/DepositVaultModal';
import { PayBillModal } from '../components/PayBillModal';
import { Account, Vault } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('VaultModals Components', () => {
  const sampleSavingsVault: Vault = {
    id: 'vault-sav-1',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 5000000,
    allocated_amount: 1000000,
    is_locked: false,
  };

  const sampleBillVault: Vault = {
    id: 'vault-bill-1',
    name: 'Internet IndiHome',
    vault_type: 'FIXED_BILL',
    target_amount: 450000,
    allocated_amount: 450000,
    target_date: '2026-10-25',
    is_locked: true,
  };

  const sampleAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 2000000, is_active: true },
    { id: 'acc-2', name: 'Dompet Cash', account_type: 'CASH', current_balance: 50000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DepositVaultModal', () => {
    it('returns null when vault is null or isOpen is false', () => {
      const { container: c1 } = render(
        <DepositVaultModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={null}
          accounts={sampleAccounts}
        />
      );
      expect(c2.firstChild).toBeNull();
    });

    it('renders vault name, current progress, and quick nominal chips', () => {
      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      expect(screen.getByText(/Nabung ke Dana Darurat/i)).toBeInTheDocument();
      expect(screen.getByText('+50rb')).toBeInTheDocument();
      expect(screen.getByText('+100rb')).toBeInTheDocument();
      expect(screen.getByText('+250rb')).toBeInTheDocument();
      expect(screen.getByText('+500rb')).toBeInTheDocument();
    });

    it('increments amount when quick chips are clicked', () => {
      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      const input = screen.getByLabelText(/Nominal Tambahan/i) as HTMLInputElement;
      expect(input.value).toBe('');

      fireEvent.click(screen.getByText('+50rb'));
      expect(input.value).toBe('50000');

      fireEvent.click(screen.getByText('+100rb'));
      expect(input.value).toBe('150000');
    });

    it('submits deposit successfully and calls onSuccess', async () => {
      const handleSuccess = vi.fn();
      const depositSpy = vi.spyOn(apiClient, 'depositVault').mockResolvedValue({
        ...sampleSavingsVault,
        allocated_amount: 1100000,
        is_locked: true,
      });

      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      fireEvent.click(screen.getByText('+100rb'));
      const submitBtn = screen.getByRole('button', { name: /Simpan Alokasi/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(depositSpy).toHaveBeenCalledWith('vault-sav-1', {
          amount: 100000,
          source_account_id: null,
        });
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('submits deposit with selected source account', async () => {
      const handleSuccess = vi.fn();
      const depositSpy = vi.spyOn(apiClient, 'depositVault').mockResolvedValue({
        ...sampleSavingsVault,
        allocated_amount: 1050000,
        is_locked: true,
      });

      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      const select = screen.getByLabelText(/Verifikasi Saldo Rekening/i);
      fireEvent.change(select, { target: { value: 'acc-1' } });

      fireEvent.click(screen.getByText('+50rb'));
      const submitBtn = screen.getByRole('button', { name: /Simpan Alokasi/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(depositSpy).toHaveBeenCalledWith('vault-sav-1', {
          amount: 50000,
          source_account_id: 'acc-1',
        });
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('displays error message when deposit API fails', async () => {
      vi.spyOn(apiClient, 'depositVault').mockRejectedValue(new Error('Saldo akun tidak cukup'));

      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      fireEvent.click(screen.getByText('+50rb'));
      const submitBtn = screen.getByRole('button', { name: /Simpan Alokasi/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Saldo akun tidak cukup')).toBeInTheDocument();
      });
    });

    it('configures aria-labelledby correctly for accessibility', () => {
      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'deposit-vault-modal-title');
      expect(document.getElementById('deposit-vault-modal-title')).toBeInTheDocument();
    });
  });

  describe('PayBillModal', () => {
    it('returns null when vault is null or isOpen is false', () => {
      const { container: c1 } = render(
        <PayBillModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={null}
          accounts={sampleAccounts}
        />
      );
      expect(c2.firstChild).toBeNull();
    });

    it('renders bill details, rollover explanation, and default amount', () => {
      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      expect(screen.getByText(/Bayar Tagihan: Internet IndiHome/i)).toBeInTheDocument();
      expect(screen.getByText(/buku besar/i)).toBeInTheDocument();
      expect(screen.getByText(/bulan depan/i)).toBeInTheDocument();

      const input = screen.getByLabelText(/Nominal Pembayaran/i) as HTMLInputElement;
      expect(input.value).toBe('450000');
    });

    it('submits bill payment with selected account and triggers onSuccess', async () => {
      const handleSuccess = vi.fn();
      const paySpy = vi.spyOn(apiClient, 'payBillVault').mockResolvedValue({
        vault: { ...sampleBillVault, allocated_amount: 0, target_date: '2026-11-25' },
        transaction: { id: 'tx-1', description: 'Pembayaran tagihan', source_channel: 'WEB_UI', transaction_date: '2026-10-25' },
      });

      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      const select = screen.getByLabelText(/Sumber Rekening Pembayaran/i);
      fireEvent.change(select, { target: { value: 'acc-1' } });

      const submitBtn = screen.getByRole('button', { name: /Konfirmasi & Bayar Tagihan/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(paySpy).toHaveBeenCalledWith('vault-bill-1', {
          account_id: 'acc-1',
          amount: 450000,
          notes: '',
        });
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('displays error message when pay bill API fails', async () => {
      vi.spyOn(apiClient, 'payBillVault').mockRejectedValue(new Error('Saldo rekening tidak mencukupi untuk pembayaran tagihan'));

      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      const select = screen.getByLabelText(/Sumber Rekening Pembayaran/i);
      fireEvent.change(select, { target: { value: 'acc-1' } });

      const submitBtn = screen.getByRole('button', { name: /Konfirmasi & Bayar Tagihan/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Saldo rekening tidak mencukupi untuk pembayaran tagihan')).toBeInTheDocument();
      });
    });

    it('configures aria-labelledby correctly for accessibility', () => {
      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'pay-bill-modal-title');
      expect(document.getElementById('pay-bill-modal-title')).toBeInTheDocument();
    });
  });
});
