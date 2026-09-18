import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

describe('OmniInputHero Component', () => {
  it('calls onSubmit with user natural language input when submitted', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith({ text: 'beli bensin 35rb bca', file: null });
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

  it('removes staged file when Hapus button is clicked', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: /Hapus lampiran struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
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
});
