import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import LandingPage from '../pages/LandingPage';

describe('LandingPage Icon and Emoji Harmonization', () => {
  it('contains zero unicode emoji characters across all rendered landing components', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const textContent = container.textContent || '';
    const innerHTML = container.innerHTML || '';

    expect(emojiRegex.test(textContent)).toBe(false);
    expect(emojiRegex.test(innerHTML)).toBe(false);
  });

  it('renders key Lucide SVG icons in place of legacy emojis', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const expectedIconClasses = [
      'lucide-wallet',
      'lucide-sparkles',
      'lucide-zap',
      'lucide-bot',
      'lucide-shield-check',
      'lucide-camera',
      'lucide-arrow-right',
      'lucide-laptop',
      'lucide-message-circle',
      'lucide-banknote',
      'lucide-circle-check',
      'lucide-map-pin',
      'lucide-mail',
      'lucide-phone',
    ];

    for (const iconClass of expectedIconClasses) {
      const iconEl = container.querySelector(`svg.${iconClass}`);
      expect(iconEl).not.toBeNull();
    }
  });
});
