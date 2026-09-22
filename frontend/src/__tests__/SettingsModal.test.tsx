import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal } from '../components/SettingsModal';
import * as apiClient from '../services/apiClient';

describe('SettingsModal Component', () => {
  const mockSettings = {
    telegram: {
      is_connected: false,
      telegram_chat_id: null,
      bot_username: 'RezekifyBot',
    },
    ai: {
      is_custom_ai_enabled: false,
      provider: 'SYSTEM' as const,
      model: 'gemini-2.5-flash',
      has_api_key: false,
      key_hint: null,
      available_models: {
        GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        GROQ: ['llama-4-scout-17b', 'llama-3.3-70b'],
      },
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getSettings').mockResolvedValue(mockSettings);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header and tab triggers when open', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Pengaturan Akun & Sistem')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Integrasi Telegram/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i })).toBeInTheDocument();
    });
  });

  it('generates telegram pairing code and displays 1-click deep link', async () => {
    vi.spyOn(apiClient, 'getTelegramPairingCode').mockResolvedValue({
      pairing_code: 'DK-7788',
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dapatkan Kode Pairing/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Dapatkan Kode Pairing/i }));

    await waitFor(() => {
      expect(screen.getByText('DK-7788')).toBeInTheDocument();
      const deepLink = screen.getByRole('link', { name: /Buka Telegram/i });
      expect(deepLink).toHaveAttribute('href', 'https://t.me/RezekifyBot?start=DK-7788');
      expect(deepLink).toHaveAttribute('target', '_blank');
    });
  });

  it('unlinks telegram when connected', async () => {
    vi.spyOn(apiClient, 'getSettings').mockResolvedValue({
      ...mockSettings,
      telegram: { is_connected: true, telegram_chat_id: 12345, bot_username: 'RezekifyBot' },
    });
    const unlinkSpy = vi.spyOn(apiClient, 'unlinkTelegram').mockResolvedValue({
      success: true,
      message: 'Unlinked',
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Terhubung: ID 12345/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Putuskan Hubungan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Putuskan Hubungan/i }));

    await waitFor(() => {
      expect(unlinkSpy).toHaveBeenCalled();
    });
  });

  it('switches to AI BYOK tab, validates key and saves settings', async () => {
    const validateSpy = vi.spyOn(apiClient, 'validateAIKey').mockResolvedValue({
      valid: true,
      message: 'Koneksi ke Google Gemini berhasil diverifikasi.',
    });
    const updateSpy = vi.spyOn(apiClient, 'updateAISettings').mockResolvedValue({
      is_custom_ai_enabled: true,
      provider: 'GEMINI',
      model: 'gemini-2.5-flash',
      has_api_key: true,
      key_hint: '...9999',
      available_models: mockSettings.ai.available_models,
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i }));

    // Toggle BYOK
    const byokCard = screen.getByRole('button', { name: /Bring Your Own Key/i });
    fireEvent.click(byokCard);

    // Fill API key
    const keyInput = screen.getByLabelText(/Kunci API/i);
    fireEvent.change(keyInput, { target: { value: 'AIzaSyD-TestKey9999' } });

    // Test connection
    const testBtn = screen.getByRole('button', { name: /Uji Koneksi/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith({
        provider: 'GEMINI',
        api_key: 'AIzaSyD-TestKey9999',
        model: 'gemini-2.5-flash',
      });
      expect(screen.getByText(/Koneksi ke Google Gemini berhasil diverifikasi/i)).toBeInTheDocument();
    });

    // Save settings
    const saveBtn = screen.getByRole('button', { name: /Simpan Pengaturan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        is_custom_ai_enabled: true,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        api_key: 'AIzaSyD-TestKey9999',
      });
    });
  });
});
