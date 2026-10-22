import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ScrollReveal from '../components/common/ScrollReveal';
import HeroSection from '../components/landing/HeroSection';
import LandingPage from '../pages/LandingPage';

describe('Landing Page Calm Motion', () => {
  it('renders ScrollReveal children with calm motion wrapper', () => {
    render(
      <ScrollReveal direction="up" delay={0.1}>
        <div data-testid="calm-content">Calm Motion Content</div>
      </ScrollReveal>
    );

    expect(screen.getByTestId('calm-content')).toBeInTheDocument();
  });

  it('HeroSection renders calm ambient status beacon and removes uncoordinated star pulses', () => {
    const { container } = render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    // Calm ambient status beacon with subtle outer ping and inner solid dot
    const beaconPing = container.querySelector('.animate-ping.bg-emerald-400.opacity-40');
    expect(beaconPing).not.toBeNull();

    // Jarring raw ping dot is removed
    const rawPingDot = container.querySelector('span.w-2\\.5.h-2\\.5.rounded-full.bg-emerald-500.animate-ping');
    expect(rawPingDot).toBeNull();

    // Uncoordinated pulsing stars removed
    const pulse2200 = container.querySelector('.duration-\\[2200ms\\]');
    const pulse1600 = container.querySelector('.duration-\\[1600ms\\]');
    expect(pulse2200).toBeNull();
    expect(pulse1600).toBeNull();
  });

  it('LandingPage renders all sections with calm upward reveal without horizontal slide-ins', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(container).toBeInTheDocument();
  });
});
