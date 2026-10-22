import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AISpotlightHero } from '../components/AISpotlightHero';

describe('AISpotlightHero Component', () => {
  it('renders title, subtitle, and prompt chips', () => {
    const onOpenChat = vi.fn();
    render(<AISpotlightHero onOpenChat={onOpenChat} />);

    expect(screen.getByText('Asisten AI Rezekify')).toBeInTheDocument();
    expect(screen.getByText(/Catat mutasi sekejap/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buka AI Copilot/i })).toBeInTheDocument();

    expect(screen.getByText('Makan siang 35rb Gopay')).toBeInTheDocument();
    expect(screen.getByText('Unggah struk kasir')).toBeInTheDocument();
    expect(screen.getByText('Catat via pesan suara')).toBeInTheDocument();
    expect(screen.getByText('Cek jatah aman hari ini')).toBeInTheDocument();
  });

  it('calls onOpenChat with prompt text when a chip is clicked', () => {
    const onOpenChat = vi.fn();
    render(<AISpotlightHero onOpenChat={onOpenChat} />);

    const foodChip = screen.getByRole('button', { name: /Makan siang 35rb Gopay/i });
    fireEvent.click(foodChip);
    expect(onOpenChat).toHaveBeenCalledWith('Makan siang 35rb Gopay');

    const ocrChip = screen.getByRole('button', { name: /Unggah struk kasir/i });
    fireEvent.click(ocrChip);
    expect(onOpenChat).toHaveBeenCalledWith('Unggah struk kasir');
  });

  it('calls onOpenChat without arguments when Buka AI Copilot button is clicked', () => {
    const onOpenChat = vi.fn();
    render(<AISpotlightHero onOpenChat={onOpenChat} />);

    const openChatBtn = screen.getByRole('button', { name: /Buka AI Copilot/i });
    fireEvent.click(openChatBtn);
    expect(onOpenChat).toHaveBeenCalledWith();
  });

  it('applies semantic emerald button styling and minimum 38px touch target on Buka AI Copilot button', () => {
    render(<AISpotlightHero onOpenChat={vi.fn()} />);

    const ctaBtn = screen.getByRole('button', { name: /Buka AI Copilot/i });
    expect(ctaBtn).toHaveClass('bg-emerald-500', 'hover:bg-emerald-600', 'min-h-[38px]');
    expect(ctaBtn.className).not.toContain('#0F766E');
    expect(ctaBtn.className).not.toContain('#10B981');
  });

  it('renders sparkles icon with semantic emerald-to-teal gradient', () => {
    const { container } = render(<AISpotlightHero onOpenChat={vi.fn()} />);
    const iconContainer = container.querySelector('.rounded-2xl.bg-gradient-to-tr');
    expect(iconContainer).toHaveClass('from-emerald-600', 'to-teal-500');
  });
});
