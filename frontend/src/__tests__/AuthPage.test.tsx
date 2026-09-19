import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPage } from '../pages/AuthPage';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthPage Component', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockRegister.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      register: mockRegister,
      logout: mockLogout,
    });
  });

  it('renders login form by default and does not show full name input', () => {
    render(<AuthPage />);

    expect(screen.getByRole('heading', { name: /Rezekify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk \(Login\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daftar Akun/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nama@email.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nama Lengkap Anda/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk ke Rezekify/i })).toBeInTheDocument();
  });

  it('switches between login and register tabs', () => {
    render(<AuthPage />);

    // Switch to register tab
    const registerTab = screen.getByRole('button', { name: /Daftar Akun/i });
    fireEvent.click(registerTab);

    expect(screen.getByPlaceholderText(/Nama Lengkap Anda/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buat Akun Sekarang/i })).toBeInTheDocument();

    // Switch back to login tab
    const loginTab = screen.getByRole('button', { name: /Masuk \(Login\)/i });
    fireEvent.click(loginTab);

    expect(screen.queryByPlaceholderText(/Nama Lengkap Anda/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk ke Rezekify/i })).toBeInTheDocument();
  });

  it('submits login form calling login(email, password)', async () => {
    render(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'SecretPassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Masuk ke Rezekify/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@rezekify.id', 'SecretPassword123');
    });
  });

  it('submits register form calling register(email, password, fullName)', async () => {
    render(<AuthPage />);

    // Switch to register tab
    fireEvent.click(screen.getByRole('button', { name: /Daftar Akun/i }));

    fireEvent.change(screen.getByPlaceholderText(/Nama Lengkap Anda/i), {
      target: { value: 'Ahmad Dahlan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'ahmad@rezekify.id' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'AhmadSecure99' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Buat Akun Sekarang/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('ahmad@rezekify.id', 'AhmadSecure99', 'Ahmad Dahlan');
    });
  });

  it('displays error banner when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Kombinasi email atau password salah.'));

    render(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'wrong@rezekify.id' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'WrongPass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Masuk ke Rezekify/i }));

    await waitFor(() => {
      expect(screen.getByText('Kombinasi email atau password salah.')).toBeInTheDocument();
    });
  });

  it('displays error banner when register fails', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email sudah terdaftar.'));

    render(<AuthPage />);

    fireEvent.click(screen.getByRole('button', { name: /Daftar Akun/i }));

    fireEvent.change(screen.getByPlaceholderText(/Nama Lengkap Anda/i), {
      target: { value: 'Budi Hartono' },
    });
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'existing@rezekify.id' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'BudiPass123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Buat Akun Sekarang/i }));

    await waitFor(() => {
      expect(screen.getByText('Email sudah terdaftar.')).toBeInTheDocument();
    });
  });

  it('clears error banner when switching tabs', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Kredensial salah'));

    render(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Masuk ke Rezekify/i }));

    await waitFor(() => {
      expect(screen.getByText('Kredensial salah')).toBeInTheDocument();
    });

    // Switch to register tab clears error
    fireEvent.click(screen.getByRole('button', { name: /Daftar Akun/i }));
    expect(screen.queryByText('Kredensial salah')).not.toBeInTheDocument();
  });
});
