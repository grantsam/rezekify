import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatOmniInput } from '../components/ChatOmniInput';

describe('ChatOmniInput Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits text when Enter is pressed without Shift', () => {
    const handleSubmit = vi.fn();
    render(<ChatOmniInput onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'makan siang 30rb' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSubmit).toHaveBeenCalledWith('makan siang 30rb', null);
  });

  it('does not submit on Shift+Enter and permits newline', () => {
    const handleSubmit = vi.fn();
    render(<ChatOmniInput onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'makan siang' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits on send button click', () => {
    const handleSubmit = vi.fn();
    render(<ChatOmniInput onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'beli kopi 25rb' } });
    const sendBtn = screen.getByRole('button', { name: /kirim pesan/i });
    fireEvent.click(sendBtn);
    expect(handleSubmit).toHaveBeenCalledWith('beli kopi 25rb', null);
  });

  it('disables send button when input is empty and no file attached', () => {
    render(<ChatOmniInput onSubmit={vi.fn()} onVoiceSubmit={vi.fn()} />);
    const sendBtn = screen.getByRole('button', { name: /kirim pesan/i });
    expect(sendBtn).toBeDisabled();
  });

  it('handles image file selection and allows removing file', async () => {
    const handleSubmit = vi.fn();
    render(<ChatOmniInput onSubmit={handleSubmit} onVoiceSubmit={vi.fn()} />);
    const file = new File(['fake-img'], 'struk.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('struk.jpg')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /hapus lampiran/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText('struk.jpg')).not.toBeInTheDocument();
  });

  it('handles drag and drop of image file', async () => {
    render(<ChatOmniInput onSubmit={vi.fn()} onVoiceSubmit={vi.fn()} />);
    const file = new File(['fake-img-drop'], 'nota.png', { type: 'image/png' });
    const dropZone = screen.getByTestId('chat-omni-input-container');

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('nota.png')).toBeInTheDocument();
    });
  });

  it('prefills textarea when initialPrompt prop is provided', () => {
    render(
      <ChatOmniInput
        onSubmit={vi.fn()}
        onVoiceSubmit={vi.fn()}
        initialPrompt="Berapa sisa jatah aman hari ini?"
      />
    );
    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Berapa sisa jatah aman hari ini?');
  });

  it('disables inputs and buttons when isLoading is true', () => {
    render(<ChatOmniInput onSubmit={vi.fn()} onVoiceSubmit={vi.fn()} isLoading={true} />);
    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    expect(textarea).toBeDisabled();
    const sendBtn = screen.getByRole('button', { name: /kirim pesan/i });
    expect(sendBtn).toBeDisabled();
  });

  it('handles voice recording start, cancel, and stop flow', async () => {
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
      mimeType = 'audio/webm';
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['voice-bytes'], { type: 'audio/webm' }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported = vi.fn().mockReturnValue(true);
    }
    (window as any).MediaRecorder = MockMediaRecorder;

    render(<ChatOmniInput onSubmit={vi.fn()} onVoiceSubmit={handleVoiceSubmit} />);

    const micBtn = screen.getByRole('button', { name: /rekam pesan suara/i });
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /perekaman suara aktif/i })).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /selesai dan kirim pesan suara/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(handleVoiceSubmit).toHaveBeenCalled();
    });
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
