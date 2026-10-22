import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCountUp } from '../hooks/useCountUp';

describe('useCountUp', () => {
  it('returns initial and target string formatted appropriately', async () => {
    const { result } = renderHook(() => useCountUp(100, { suffix: '%' }));

    expect(result.current.ref).toBeDefined();
    expect(result.current.count).toBe('0%');

    await waitFor(() => {
      expect(result.current.count).toBe('100%');
    });
  });

  it('formats decimals, prefix, and custom suffix correctly', async () => {
    const { result } = renderHook(() =>
      useCountUp(3.5, { decimals: 1, suffix: 'x' })
    );

    expect(result.current.count).toBe('0.0x');

    await waitFor(() => {
      expect(result.current.count).toBe('3.5x');
    });
  });

  it('formats complex suffixes such as "x Lipat" and "/7"', async () => {
    const { result: lipatResult } = renderHook(() =>
      useCountUp(2, { suffix: 'x Lipat' })
    );
    expect(lipatResult.current.count).toBe('0x Lipat');
    await waitFor(() => {
      expect(lipatResult.current.count).toBe('2x Lipat');
    });

    const { result: hoursResult } = renderHook(() =>
      useCountUp(24, { suffix: '/7' })
    );
    expect(hoursResult.current.count).toBe('0/7');
    await waitFor(() => {
      expect(hoursResult.current.count).toBe('24/7');
    });
  });
});
