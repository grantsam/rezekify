import { test, expect } from '@playwright/test';
import { purgeUserByEmail, checkUserExists } from './db-cleanup';

test.describe('Database Cleanup & Teardown Helper', () => {
  test('safely executes purge on non-existent user without throwing', () => {
    const fakeEmail = `nonexistent_${Date.now()}@rezekify.id`;
    const result = purgeUserByEmail(fakeEmail);
    expect(result).toBe(true);
    expect(checkUserExists(fakeEmail)).toBe(false);
  });

  test('rejects invalid or unsafe email input format in purgeUserByEmail', () => {
    expect(() => purgeUserByEmail('')).toThrow();
    expect(() => purgeUserByEmail('not-an-email')).toThrow();
    expect(() => purgeUserByEmail("malicious' OR '1'='1")).toThrow();
  });

  test('safely returns false for invalid email format in checkUserExists', () => {
    expect(checkUserExists('')).toBe(false);
    expect(checkUserExists('not-an-email')).toBe(false);
    expect(checkUserExists("malicious' OR '1'='1")).toBe(false);
  });
});
