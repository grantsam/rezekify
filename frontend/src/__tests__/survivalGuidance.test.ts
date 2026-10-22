import { describe, it, expect } from 'vitest';
import { generateSurvivalGuidance } from '../utils/survivalGuidance';

describe('generateSurvivalGuidance utility', () => {
  it('evaluates Tier 1 CRITICAL when operational_free <= 0', () => {
    const res = generateSurvivalGuidance(0, 0, 10, 30000);
    expect(res.tone).toBe('CRITICAL');
    expect(res.headline).toBe('Mode Pertahanan Kas');
    expect(res.message).toContain('Kas operasional bebas telah habis');
    expect(res.tactical_action).toBe('Tinjau pos tabungan atau kurangi belanja non-esensial selama 10 hari ke depan.');
  });

  it('evaluates Tier 2 CRITICAL when daily_safe < 20000 and operational_free > 0', () => {
    const res = generateSurvivalGuidance(150000, 15000, 10, 30000);
    expect(res.tone).toBe('CRITICAL');
    expect(res.headline).toBe('Mode Hemat Terarah');
    expect(res.message).toContain('Rp 15.000/hari');
    expect(res.message.toLowerCase()).toContain('warteg');
    expect(res.tactical_action).toBe('Tunda pos hiburan/jajan di luar hingga siklus baru 10 hari lagi.');
  });

  it('evaluates Tier 3 WARNING when 20000 <= daily_safe < safeThreshold', () => {
    const res = generateSurvivalGuidance(250000, 25000, 10, 30000);
    expect(res.tone).toBe('WARNING');
    expect(res.headline).toBe('Mode Waspada Santai');
    expect(res.message).toContain('Rp 25.000/hari');
    expect(res.tactical_action).toBe('Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.');
  });

  it('evaluates Tier 4 HEALTHY when daily_safe >= safeThreshold', () => {
    const res = generateSurvivalGuidance(500000, 50000, 10, 30000);
    expect(res.tone).toBe('HEALTHY');
    expect(res.headline).toBe('Arus Kas Terkendali');
    expect(res.message).toContain('Rp 50.000/hari');
    expect(res.tactical_action).toBe('Kamu berada di jalur yang tepat menuju siklus baru.');
  });

  it('handles exact boundary equality (20.000 is WARNING, 30.000 is HEALTHY) (Review Focus 2)', () => {
    const at20k = generateSurvivalGuidance(200000, 20000, 10, 30000);
    expect(at20k.tone).toBe('WARNING');
    expect(at20k.headline).toBe('Mode Waspada Santai');

    const at30k = generateSurvivalGuidance(300000, 30000, 10, 30000);
    expect(at30k.tone).toBe('HEALTHY');
    expect(at30k.headline).toBe('Arus Kas Terkendali');
  });

  it('aligns with custom threshold (50k safe threshold) (Review Focus 3)', () => {
    const res = generateSurvivalGuidance(400000, 40000, 10, 50000);
    expect(res.tone).toBe('WARNING');
    expect(res.headline).toBe('Mode Waspada Santai');
  });

  it('clamps negative or zero days remaining to 1 (Review Focus 1)', () => {
    const res = generateSurvivalGuidance(0, 0, 0, 30000);
    expect(res.tactical_action).toContain('selama 1 hari ke depan');
  });
});
