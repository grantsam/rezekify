import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthModal } from '../components/AuthModal';
import * as apiClient from '../services/apiClient';

describe('AuthModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders accessible dialog with title and inputs having correct htmlFor/id linkage', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'auth-modal-title');
    expect(screen.getByRole('heading', { level: 3, name: /Masuk ke Rezekify/i })).toHaveAttribute('id', 'auth-modal-title');

    // Email and Password inputs connected to labels
    const emailInput = screen.getByLabelText(/Alamat Email/i);
    expect(emailInput).toHaveAttribute('id', 'auth-email');

    const passwordInput = screen.getByLabelText(/Kata Sandi/i);
    expect(passwordInput).toHaveAttribute('id', 'auth-password');

    // Switch to Register
    const registerTab = screen.getByRole('button', { name: /Daftar Akun/i });
    fireEvent.click(registerTab);

    const fullNameInput = screen.getByLabelText(/Nama Lengkap/i);
    expect(fullNameInput).toHaveAttribute('id', 'auth-fullname');
  });

  it('invokes onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={handleClose} onSuccess={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('submits login successfully and calls onSuccess and onClose', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({ access_token: 'test-jwt' });
    const setAuthTokenSpy = vi.spyOn(apiClient, 'setAuthToken').mockImplementation(() => {});
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(<AuthModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Alamat Email/i), { target: { value: 'test@rezekify.id' } });
    fireEvent.change(screen.getByLabelText(/Kata Sandi/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Masuk Sekarang/i }));

    await waitFor(() => {
      expect(setAuthTokenSpy).toHaveBeenCalledWith('test-jwt');
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
