import { SurvivalGuidance } from '../types/api';
export type { SurvivalGuidance };

// ponytail: Client fallback rule engine mirrors backend RunwayService; upgrade path is consuming backend guidance directly.
export function generateSurvivalGuidance(
  operationalFree: number,
  dailySafe: number,
  daysRemaining: number,
  safeThreshold: number = 30000
): SurvivalGuidance {
  const safeDays = Math.max(1, Math.floor(daysRemaining));
  const safeDaily = Math.max(0, Math.floor(dailySafe));
  const formattedDaily = new Intl.NumberFormat('id-ID').format(safeDaily);

  if (operationalFree <= 0) {
    return {
      tone: 'CRITICAL',
      headline: 'Mode Pertahanan Kas',
      message:
        'Kas operasional bebas telah habis untuk siklus ini. Seluruh pengeluaran pokok disarankan memanfaatkan dana darurat atau pos simpanan yang tersedia.',
      tactical_action: `Tinjau pos tabungan atau kurangi belanja non-esensial selama ${safeDays} hari ke depan.`,
    };
  }

  if (dailySafe < 20000) {
    return {
      tone: 'CRITICAL',
      headline: 'Mode Hemat Terarah',
      message: `Jatah harian Rp ${formattedDaily}/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri.`,
      tactical_action: `Tunda pos hiburan/jajan di luar hingga siklus baru ${safeDays} hari lagi.`,
    };
  }

  if (dailySafe < safeThreshold) {
    return {
      tone: 'WARNING',
      headline: 'Mode Waspada Santai',
      message: `Jatah harian Rp ${formattedDaily}/hari cukup untuk kebutuhan harian, namun mendekati batas aman.`,
      tactical_action: 'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.',
    };
  }

  return {
    tone: 'HEALTHY',
    headline: 'Arus Kas Terkendali',
    message: `Jatah harian Rp ${formattedDaily}/hari berada dalam zona aman di atas ambang batas.`,
    tactical_action: 'Kamu berada di jalur yang tepat menuju siklus baru.',
  };
}
