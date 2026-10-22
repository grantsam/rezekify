import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import HeroSection from '../components/landing/HeroSection';

describe('HeroSection Interactive Runway Demo', () => {
  it('shows baseline runway Rp 45.000 by default', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    const runwayDisplay = screen.getByTestId('hero-sim-runway');
    expect(runwayDisplay).toHaveTextContent('Rp 45.000');
    expect(screen.getByTestId('hero-sim-chips')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-sim-reset')).not.toBeInTheDocument();
  });

  it('recalculates runway to Rp 43.611 when +25rb Makan Siang is clicked', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    const chipMakan = screen.getByText(/\+25rb Makan/i);
    fireEvent.click(chipMakan);

    const runwayDisplay = screen.getByTestId('hero-sim-runway');
    expect(runwayDisplay).toHaveTextContent('Rp 43.611');
    expect(screen.getByTestId('hero-sim-reset')).toBeInTheDocument();
  });

  it('restores baseline runway Rp 45.000 when Reset is clicked', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    const chipMakan = screen.getByText(/\+25rb Makan/i);
    fireEvent.click(chipMakan);

    expect(screen.getByTestId('hero-sim-runway')).toHaveTextContent('Rp 43.611');

    const resetBtn = screen.getByTestId('hero-sim-reset');
    fireEvent.click(resetBtn);

    expect(screen.getByTestId('hero-sim-runway')).toHaveTextContent('Rp 45.000');
    expect(screen.queryByTestId('hero-sim-reset')).not.toBeInTheDocument();
  });
});
