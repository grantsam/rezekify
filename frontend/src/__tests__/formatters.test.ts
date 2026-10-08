import { describe, it, expect } from 'vitest';
import { formatRupiah } from '../utils/formatters';

describe('formatRupiah utility', () => {
  it('formats standard positive amount with Rp prefix and thousand separators without decimals', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000');
    expect(formatRupiah(45000)).toBe('Rp 45.000');
  });

  it('formats zero correctly', () => {
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('formats negative amounts with minus sign before Rp or number', () => {
    expect(formatRupiah(-250000)).toBe('-Rp 250.000');
  });

  it('allows omitting Rp prefix when showPrefix is false', () => {
    expect(formatRupiah(1500000, { showPrefix: false })).toBe('1.500.000');
  });
});
