import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulatePurchaseModal } from '../components/SimulatePurchaseModal';
import * as apiClient from '../services/apiClient';

describe('SimulatePurchaseModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SimulatePurchaseModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders form inputs and modal title when isOpen is true', () => {
    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Simulasi Rencana Belanja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nominal Rencana Belanja/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hitung Dampak Belanja/i })).toBeInTheDocument();
  });

  it('submits purchase simulation and displays safe result card', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      current_daily_runway: 150000,
      projected_daily_runway: 120000,
      daily_drop_amount: 30000,
      is_safe: true,
      advice: 'Pembelian aman. Sisa jatah harian Anda masih berada di atas ambang aman.',
    });

    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nominal Rencana Belanja/i), {
      target: { value: '450000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Hitung Dampak Belanja/i }));

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/dashboard/simulate-purchase',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ planned_amount: 450000 }),
        })
      );
    });

    // Check result metrics
    expect(await screen.findByText(/Jatah Saat Ini/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 150\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Proyeksi Setelah Belanja/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 120\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Penurunan Jatah Harian/i)).toBeInTheDocument();
    expect(screen.getByText(/-Rp 30\.000\/hari/i)).toBeInTheDocument();

    // Check AI Advice text
    expect(
      screen.getByText(/Pembelian aman\. Sisa jatah harian Anda masih berada di atas ambang aman\./i)
    ).toBeInTheDocument();
  });

  it('submits purchase simulation and displays warning/unsafe result card', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      current_daily_runway: 50000,
      projected_daily_runway: 15000,
      daily_drop_amount: 35000,
      is_safe: false,
      advice: 'Waspada! Pembelian ini akan memangkas jatah harian ke level kritis.',
    });

    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nominal Rencana Belanja/i), {
      target: { value: '800000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Hitung Dampak Belanja/i }));

    await waitFor(() => {
      expect(screen.getByText(/Waspada! Pembelian ini akan memangkas jatah harian ke level kritis\./i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Rp 50\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 15\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/-Rp 35\.000\/hari/i)).toBeInTheDocument();
  });

  it('shows error message if planned_amount is zero or negative', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch');

    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nominal Rencana Belanja/i), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Hitung Dampak Belanja/i }));

    expect(await screen.findByText(/Nominal belanja harus lebih besar dari 0/i)).toBeInTheDocument();
    expect(apiFetchSpy).not.toHaveBeenCalled();
  });

  it('handles API failure by displaying inline error message', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockRejectedValue(new Error('Koneksi server gagal'));

    render(<SimulatePurchaseModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nominal Rencana Belanja/i), {
      target: { value: '100000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Hitung Dampak Belanja/i }));

    await waitFor(() => {
      expect(screen.getByText(/Koneksi server gagal/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<SimulatePurchaseModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByLabelText(/Tutup modal/i));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders accessible dialog and closes on Escape key', () => {
    const handleClose = vi.fn();
    render(<SimulatePurchaseModal isOpen={true} onClose={handleClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'simulate-modal-title');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not apply raw HTML disabled attribute alongside HeroUI isLoading on submit button', () => {
    render(
      <SimulatePurchaseModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    const submitBtn = screen.getByRole('button', { name: /Hitung Dampak Belanja/i });
    expect(submitBtn.getAttribute('type')).toBe('submit');
    expect(submitBtn.getAttribute('disabled')).toBeNull();
  });
});
