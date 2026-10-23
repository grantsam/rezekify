import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ZeroEmojiAudit', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

  function getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          results.push(...getSourceFiles(fullPath));
        }
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  it('verifies zero raw unicode emojis across all frontend source files', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = getSourceFiles(srcDir);
    const violations: { file: string; line: number; match: string; text: string }[] = [];

    for (const file of files) {
      const relativePath = path.relative(srcDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        const match = lineText.match(emojiRegex);
        if (match) {
          violations.push({
            file: relativePath,
            line: idx + 1,
            match: match[0],
            text: lineText.trim(),
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
