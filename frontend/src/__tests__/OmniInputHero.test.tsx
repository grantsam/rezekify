import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  set src(val: string) {
    this._src = val;
    queueMicrotask(() => {
      if (this.onload) this.onload();
    });
  }
  get src() {
    return this._src;
  }
}
vi.stubGlobal('Image', MockImage);

describe('OmniInputHero Component', () => {
  it('calls onSubmit with text and null file when submitted with text only, and resets text', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith('beli bensin 35rb bca', null);
    expect(input).toHaveValue('');
  });

  it('stages file and renders thumbnail pill on file input selection', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Hapus lampiran struk/i })).toBeInTheDocument();
    });
  });

  it('removes staged file and clears file input value when Hapus button is clicked', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Hapus lampiran struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
    expect(fileInput.value).toBe('');
  });

  it('submits with raw File object and text, then clears text and file state', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'kopi kenangan 48rb' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith('kopi kenangan 48rb', file);
    expect(input).toHaveValue('');
    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
  });

  it('disables submit button when both text and file are empty', () => {
    const handleSubmit = vi.fn();
    const { container } = render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn).toBeDisabled();

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.submit(input);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('handles drag-over and dropzone file staging', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const dropzone = screen.getByTestId('omni-dropzone');
    const file = new File(['mock_bytes'], 'struk_makan.png', { type: 'image/png' });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/struk_makan.png/i)).toBeInTheDocument();
    });
  });

  it('shows inline error message for unsupported file types and avoids native alert', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const invalidFile = new File(['pdf_content'], 'invoice.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Format file tidak didukung/i)).toBeInTheDocument();
    expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Tutup pesan kesalahan/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays visual drop overlay when dragging file over dropzone', () => {
    render(<OmniInputHero onSubmit={vi.fn()} isLoading={false} />);
    const dropzone = screen.getByTestId('omni-dropzone');

    fireEvent.dragOver(dropzone);
    expect(screen.getByText(/Lepaskan foto struk belanja di sini\.\.\./i)).toBeInTheDocument();

    fireEvent.dragLeave(dropzone);
    expect(screen.queryByText(/Lepaskan foto struk belanja di sini\.\.\./i)).not.toBeInTheDocument();
  });

  it('removes staged file attachment when Escape key is pressed', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
    expect(fileInput.value).toBe('');
  });

  it('submits form via Ctrl+Enter shortcut when text is present', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'makan siang 30rb' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(handleSubmit).toHaveBeenCalledWith('makan siang 30rb', null);
    expect(input).toHaveValue('');
  });

  it('clears error message when Escape key is pressed', () => {
    render(<OmniInputHero onSubmit={vi.fn()} isLoading={false} />);
    const invalidFile = new File(['pdf_content'], 'invoice.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('compresses selected image files using compressImage before staging and submission', async () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const originalFile = new File(['original-large-bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [originalFile] } });

    await waitFor(() => {
      expect(screen.getByText(/receipt/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Kirim/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  describe('Voice Recording functionality', () => {
    let mockTrack: { stop: any };
    let mockStream: any;
    let originalMediaDevices: any;
    let originalMediaRecorder: any;

    beforeEach(() => {
      mockTrack = { stop: vi.fn() };
      mockStream = { getTracks: () => [mockTrack] };

      originalMediaDevices = navigator.mediaDevices;
      originalMediaRecorder = (window as any).MediaRecorder;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        writable: true,
        configurable: true,
      });

      class MockMediaRecorder {
        state: 'inactive' | 'recording' = 'inactive';
        ondataavailable: ((e: any) => void) | null = null;
        onstop: (() => void) | null = null;
        mimeType = 'audio/webm';
        static isTypeSupported = vi.fn().mockReturnValue(true);

        start() {
          this.state = 'recording';
        }

        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['audio-content'], { type: 'audio/webm' }) });
          }
          if (this.onstop) {
            this.onstop();
          }
        }
      }

      (window as any).MediaRecorder = MockMediaRecorder;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
        configurable: true,
      });
      (window as any).MediaRecorder = originalMediaRecorder;
      vi.restoreAllMocks();
    });

    it('renders microphone button with proper aria-label', () => {
      render(<OmniInputHero onSubmit={vi.fn()} isLoading={false} />);
      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      expect(micBtn).toBeInTheDocument();
    });

    it('clicking mic button initiates recording state', async () => {
      const handleVoiceSubmit = vi.fn();
      render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
        expect(screen.getByText(/Merekam suara\.\.\./i)).toBeInTheDocument();
        expect(screen.getByText(/00:00/)).toBeInTheDocument();
      });
    });

    it('stopping recording invokes onVoiceSubmit with recorded blob and clears text', async () => {
      const handleVoiceSubmit = vi.fn();
      render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i })).toBeInTheDocument();
      });

      const stopBtn = screen.getByRole('button', { name: /Selesai dan kirim pesan suara/i });
      fireEvent.click(stopBtn);

      await waitFor(() => {
        expect(handleVoiceSubmit).toHaveBeenCalledTimes(1);
        const [blobArg] = handleVoiceSubmit.mock.calls[0];
        expect(blobArg).toBeInstanceOf(Blob);
        expect(mockTrack.stop).toHaveBeenCalled();
      });

      // Recording UI should close
      expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();
    });

    it('cancelling recording does not invoke onVoiceSubmit', async () => {
      const handleVoiceSubmit = vi.fn();
      render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Batalkan rekaman/i })).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole('button', { name: /Batalkan rekaman/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(mockTrack.stop).toHaveBeenCalled();
      });

      expect(handleVoiceSubmit).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();
    });

    it('cancelling recording with Escape key stops recorder without submitting', async () => {
      const handleVoiceSubmit = vi.fn();
      render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
      });

      const dropzone = screen.getByTestId('omni-dropzone');
      fireEvent.keyDown(dropzone, { key: 'Escape' });

      await waitFor(() => {
        expect(mockTrack.stop).toHaveBeenCalled();
      });

      expect(handleVoiceSubmit).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();
    });

    it('displays error message when microphone permission is denied', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(new Error('Permission denied'));

      render(<OmniInputHero onSubmit={vi.fn()} isLoading={false} />);
      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Izin mikrofon ditolak atau mikrofon tidak tersedia/i)).toBeInTheDocument();
      });
    });

    it('automatically stops recording when timer reaches 60 seconds', async () => {
      vi.useFakeTimers();
      const handleVoiceSubmit = vi.fn();
      render(<OmniInputHero onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} isLoading={false} />);

      const micBtn = screen.getByRole('button', { name: /Rekam pesan suara/i });
      fireEvent.click(micBtn);

      // Fast-forward initial microtasks to allow getUserMedia promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByRole('region', { name: /Perekaman suara aktif/i })).toBeInTheDocument();
      expect(screen.getByText(/00:00 \/ 01:00/i)).toBeInTheDocument();

      // Advance by 60 seconds
      vi.advanceTimersByTime(60000);
      await vi.runOnlyPendingTimersAsync();

      // The recorder should automatically stop and invoke onVoiceSubmit
      expect(handleVoiceSubmit).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('region', { name: /Perekaman suara aktif/i })).not.toBeInTheDocument();

      vi.useRealTimers();
    });
  });
});
