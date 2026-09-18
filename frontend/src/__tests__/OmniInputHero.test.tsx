import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

describe('OmniInputHero Component', () => {
  it('calls onSubmit with user natural language input', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith('beli bensin 35rb bca', null);
  });
});
