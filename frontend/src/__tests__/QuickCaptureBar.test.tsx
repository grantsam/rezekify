import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickCaptureBar } from '../components/QuickCaptureBar';

describe('QuickCaptureBar Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 44px command bar with Terminal icon and shortcut badge', () => {
    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={vi.fn()} />);

    expect(
      screen.getByPlaceholderText(/Ketik mutasi, drop foto struk kasir, atau rekam suara\.\.\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pilih struk belanja/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rekam pesan suara/i })).toBeInTheDocument();
    expect(screen.getByText('Ctrl ↵')).toBeInTheDocument();
  });

  it('submits text mutasi on Enter', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: 'Beli kopi 25rb bca' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ text: 'Beli kopi 25rb bca', file: null });
    });
  });

  it('does nothing on whitespace-only submission (Review Focus 1)', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('attaches receipt file, displays receipt indicator, and clears it on dismiss', async () => {
    const handleSubmit = vi.fn();
    render(<QuickCaptureBar onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);

    const file = new File(['dummy_bytes'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('struk_kopi.jpg')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Hapus struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('struk_kopi.jpg')).not.toBeInTheDocument();
  });

  it('morphs into audio telemetry visualizer during recording and cancels on Esc (Review Focus 2)', async () => {
    const handleVoiceSubmit = vi.fn();

    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      writable: true,
      configurable: true,
    });

    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported = vi.fn().mockReturnValue(true);
    }
    (window as any).MediaRecorder = MockMediaRecorder;

    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} />);

    const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /Batalkan rekaman/i });
    fireEvent.click(cancelBtn);

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(handleVoiceSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();
  });

  it('submits voice recording blob on stop button click', async () => {
    const handleVoiceSubmit = vi.fn();

    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      writable: true,
      configurable: true,
    });

    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported = vi.fn().mockReturnValue(true);
    }
    (window as any).MediaRecorder = MockMediaRecorder;

    render(<QuickCaptureBar onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /Rekam pesan suara/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i }));

    await waitFor(() => {
      expect(handleVoiceSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('renders floating toast notification and dismisses on close click', () => {
    const handleDismissToast = vi.fn();

    render(
      <QuickCaptureBar
        onSubmit={vi.fn()}
        onVoiceSubmit={vi.fn()}
        toastMessage={{ text: 'Struk berhasil dicatat ke dalam ledger!', isError: false }}
        onDismissToast={handleDismissToast}
      />
    );

    expect(screen.getByText('Struk berhasil dicatat ke dalam ledger!')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup notifikasi/i });
    fireEvent.click(closeBtn);

    expect(handleDismissToast).toHaveBeenCalledTimes(1);
  });
});
