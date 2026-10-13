import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPage } from '../pages/AuthPage';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthPage Component', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();
  const mockLogout = vi.fn();
  const mockForgotPassword = vi.fn();
  const mockResetPassword = vi.fn();

  const renderAuthPage = () =>
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockRegister.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset();
    mockForgotPassword.mockReset().mockResolvedValue('Kode verifikasi telah dikirim ke email Anda.');
    mockResetPassword.mockReset().mockResolvedValue('Kata sandi Anda berhasil diperbarui.');

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      register: mockRegister,
      logout: mockLogout,
      forgotPassword: mockForgotPassword,
      resetPassword: mockResetPassword,
    });
  });

  it('renders login form by default and does not show full name input', () => {
    renderAuthPage();

    expect(screen.getByRole('heading', { name: /Rezekify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk \(Login\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daftar Akun/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nama@email.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nama Lengkap Anda/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk ke Rezekify/i })).toBeInTheDocument();
  });

  it('switches between login and register tabs', () => {
    renderAuthPage();

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
    renderAuthPage();

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
    renderAuthPage();

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

    renderAuthPage();

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

    renderAuthPage();

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

    renderAuthPage();

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

  it('switches to forgot password form when clicking "Lupa kata sandi?"', () => {
    renderAuthPage();

    const forgotPasswordLink = screen.getByRole('button', { name: /Lupa kata sandi\?/i });
    fireEvent.click(forgotPasswordLink);

    expect(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kembali ke Masuk/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nama@email.com/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/••••••••/i)).not.toBeInTheDocument();
  });

  it('submits email in forgot password form, calls forgotPassword(email), and advances to OTP entry', async () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('user@rezekify.id');
    });

    expect(screen.getByText(/user@rezekify.id/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/123456/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Kata sandi baru/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perbarui Kata Sandi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kirim ulang kode/i })).toBeInTheDocument();
  });

  it('submits OTP and new password, calls resetPassword(email, otp, newPassword), and transitions back to login with success message', async () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/123456/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/123456/i), {
      target: { value: '654321' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Kata sandi baru/i), {
      target: { value: 'NewSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Perbarui Kata Sandi/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('user@rezekify.id', '654321', 'NewSecret123!');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Masuk ke Rezekify/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Kata sandi Anda berhasil diperbarui/i)).toBeInTheDocument();
  });

  it('displays error banner when forgotPassword fails', async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error('Email tidak ditemukan.'));

    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'unknown@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByText('Email tidak ditemukan.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i })).toBeInTheDocument();
  });

  it('displays error banner when resetPassword fails', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('Kode OTP tidak valid atau sudah kedaluwarsa.'));

    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/123456/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/123456/i), {
      target: { value: '000000' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Kata sandi baru/i), {
      target: { value: 'NewSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Perbarui Kata Sandi/i }));

    await waitFor(() => {
      expect(screen.getByText('Kode OTP tidak valid atau sudah kedaluwarsa.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Perbarui Kata Sandi/i })).toBeInTheDocument();
  });

  it('calls forgotPassword again when clicking "Kirim ulang kode"', async () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kirim ulang kode/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Kirim ulang kode/i }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledTimes(2);
    });
  });

  it('switches back to login form when clicking "Kembali ke Masuk"', () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    expect(screen.getByRole('button', { name: /Kembali ke Masuk/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kembali ke Masuk/i }));

    expect(screen.getByRole('button', { name: /Masuk ke Rezekify/i })).toBeInTheDocument();
  });

  it('validates new password length >= 8 characters on reset password submit', async () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/123456/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/123456/i), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Kata sandi baru/i), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Perbarui Kata Sandi/i }));

    await waitFor(() => {
      expect(screen.getByText('Kata sandi baru minimal 8 karakter.')).toBeInTheDocument();
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('verifies accessibility and input constraints on OTP and reset password inputs', async () => {
    renderAuthPage();

    const forgotBtn = screen.getByRole('button', { name: /Lupa kata sandi\?/i });
    expect(forgotBtn.className).toContain('min-h-[38px]');

    fireEvent.click(forgotBtn);
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/123456/i)).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText(/123456/i);
    expect(otpInput).toHaveAttribute('autocomplete', 'one-time-code');

    const passwordInput = screen.getByPlaceholderText(/Kata sandi baru/i);
    expect(passwordInput).toHaveAttribute('minlength', '8');
    expect(passwordInput).toHaveAttribute('maxlength', '72');
  });

  it('activates 60-second cooldown timer on Kirim ulang kode button when clicked', async () => {
    renderAuthPage();

    fireEvent.click(screen.getByRole('button', { name: /Lupa kata sandi\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/nama@email.com/i), {
      target: { value: 'user@rezekify.id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Kode Verifikasi/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kirim ulang kode/i })).toBeInTheDocument();
    });

    const resendBtn = screen.getByRole('button', { name: /Kirim ulang kode/i });
    expect(resendBtn).not.toBeDisabled();

    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kirim ulang kode \(\d+s\)/i })).toBeDisabled();
    });
  });
});
