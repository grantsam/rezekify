import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

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

  it('stages file and renders thumbnail pill on file input selection', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hapus lampiran struk/i })).toBeInTheDocument();
  });

  it('removes staged file and clears file input value when Hapus button is clicked', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: /Hapus lampiran struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
    expect(fileInput.value).toBe('');
  });

  it('submits with raw File object and text, then clears text and file state', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

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

  it('handles drag-over and dropzone file staging', () => {
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

    expect(screen.getByText(/struk_makan.png/i)).toBeInTheDocument();
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
});
