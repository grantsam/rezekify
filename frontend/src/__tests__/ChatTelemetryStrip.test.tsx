import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatTelemetryStrip } from '../components/ChatTelemetryStrip';
import { TelemetrySnapshot } from '../types/api';

describe('ChatTelemetryStrip Component', () => {
  const sampleTelemetry: TelemetrySnapshot = {
    operational_free_cash: 1740000,
    daily_safe_runway: 145000,
    days_remaining: 12,
    health_status: 'HEALTHY',
  };

  it('renders operational free cash, daily safe runway, days remaining, and health badge', () => {
    render(<ChatTelemetryStrip telemetry={sampleTelemetry} onResetChat={vi.fn()} />);
    expect(screen.getByText(/Rp\s*1[.,]740[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*145[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/12 hari/i)).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
  });

  it('triggers onResetChat when reset button is clicked', async () => {
    const handleReset = vi.fn().mockResolvedValue(undefined);
    render(<ChatTelemetryStrip telemetry={sampleTelemetry} onResetChat={handleReset} />);
    const resetBtn = screen.getByRole('button', { name: /bersihkan riwayat/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('renders provider badge when provided', () => {
    render(<ChatTelemetryStrip telemetry={sampleTelemetry} onResetChat={vi.fn()} providerLabel="CUSTOM BYOK" />);
    expect(screen.getByText('CUSTOM BYOK')).toBeInTheDocument();
  });

  it('renders placeholder or fallback values when telemetry is null', () => {
    render(<ChatTelemetryStrip telemetry={null} onResetChat={vi.fn()} />);
    expect(screen.getByText(/memuat data/i)).toBeInTheDocument();
  });
});
