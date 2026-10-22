import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import FaqSection from '../components/landing/FaqSection';
import WorkflowSection from '../components/landing/WorkflowSection';
import BenefitSection from '../components/landing/BenefitSection';
import CtaSection from '../components/landing/CtaSection';

describe('Landing Page Motion & Interactivity', () => {
  describe('FaqSection', () => {
    it('toggles FAQ accordion and applies smooth overflow container and rotation transition', () => {
      render(<FaqSection />);

      // The first item is open by default
      const defaultAnswer = screen.getByText(/Rezekify menyediakan layanan dasar secara gratis/i);
      expect(defaultAnswer).toBeInTheDocument();

      // The answer container must have the smooth overflow-hidden motion wrapper
      const motionWrapper = defaultAnswer.closest('.overflow-hidden');
      expect(motionWrapper).not.toBeNull();

      // Icon should have 300ms ease-out rotation transition class
      const iconSpans = screen.getAllByText('+');
      const openIcon = iconSpans[0];
      expect(openIcon).toHaveClass('duration-300');
      expect(openIcon).toHaveClass('ease-out');
      expect(openIcon).toHaveClass('rotate-45');

      // Clicking second FAQ expands it
      const secondQuestionBtn = screen.getByText('Bagaimana cara menghubungkan akun bank atau e-wallet?');
      fireEvent.click(secondQuestionBtn);

      expect(screen.getByText(/Kamu dapat menambahkan akun bank dan e-wallet/i)).toBeInTheDocument();
    });
  });

  describe('WorkflowSection', () => {
    it('switches active step when step tab is clicked', () => {
      render(<WorkflowSection />);

      expect(screen.getByText('Langkah 1 dari 5')).toBeInTheDocument();

      const step2Btn = screen.getByText('Hubungkan Akun');
      fireEvent.click(step2Btn);

      expect(screen.getByText('Langkah 2 dari 5')).toBeInTheDocument();
      expect(screen.getByText(/Hubungkan berbagai dompet digital/i)).toBeInTheDocument();
    });
  });

  describe('BenefitSection', () => {
    it('switches active benefit tab when clicked', () => {
      render(<BenefitSection />);

      expect(screen.getByText('Fokus Manfaat 01')).toBeInTheDocument();

      const benefit2 = screen.getByText('Kontrol Penuh');
      fireEvent.click(benefit2);

      expect(screen.getByText('Fokus Manfaat 02')).toBeInTheDocument();
      expect(screen.getByText(/Kuasai alur pengeluaran dengan batasan budget/i)).toBeInTheDocument();
    });
  });

  describe('CtaSection', () => {
    it('renders CTA buttons with tactile motion interaction capability', () => {
      render(
        <MemoryRouter>
          <CtaSection />
        </MemoryRouter>
      );

      const ctaBtn = screen.getByRole('button', { name: /Mulai Sekarang/i });
      expect(ctaBtn).toBeInTheDocument();
    });
  });
});
