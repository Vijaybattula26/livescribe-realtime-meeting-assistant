import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env with override: true to get the active server key
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

describe('Security & API Key Shielding Verification', () => {
  const GOOGLE_API_KEY_PATTERNS = [
    /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    /\bAQ\.[0-9A-Za-z\-_]{40,}\b/g,
  ];

  function getAllFiles(dirPath: string, extensions: string[]): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dirPath)) return files;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          files.push(...getAllFiles(fullPath, extensions));
        }
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('fails if dist/ is missing and confirms dist/ does not contain the real key or Google key patterns', () => {
    const distPath = path.resolve(__dirname, '../dist');
    expect(fs.existsSync(distPath), 'dist/ directory must exist after build').toBe(true);

    const clientFiles = getAllFiles(distPath, ['.js', '.html', '.css', '.json']);
    expect(clientFiles.length, 'dist/ must contain built bundle files').toBeGreaterThan(0);

    const realKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
    const violations: { file: string; type: string }[] = [];

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check exact value match without printing the key
      if (realKey && realKey.length > 10 && content.includes(realKey)) {
        violations.push({ file: path.basename(file), type: 'EXACT_KEY_MATCH' });
      }

      // Check regex patterns
      for (const pattern of GOOGLE_API_KEY_PATTERNS) {
        if (pattern.test(content)) {
          violations.push({ file: path.basename(file), type: 'KEY_PATTERN_MATCH' });
        }
      }
    }

    expect(
      violations,
      'Build output (dist/) must NEVER contain secrets or Google API key patterns'
    ).toEqual([]);
  });

  it('should not contain hardcoded API keys in client source code (src/)', () => {
    const srcPath = path.resolve(__dirname, '../src');
    const sourceFiles = getAllFiles(srcPath, ['.ts', '.tsx', '.js', '.jsx', '.css']);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const violations: { file: string; type: string }[] = [];
    const realKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      if (realKey && realKey.length > 10 && content.includes(realKey)) {
        violations.push({ file: path.basename(file), type: 'EXACT_KEY_MATCH' });
      }

      for (const pattern of GOOGLE_API_KEY_PATTERNS) {
        if (pattern.test(content)) {
          violations.push({ file: path.basename(file), type: 'KEY_PATTERN_MATCH' });
        }
      }
    }

    expect(
      violations,
      'Hardcoded API key or pattern found in src/ source files'
    ).toEqual([]);
  });

  it('should strictly gitignore .env and sensitive environment files', () => {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = gitignoreContent.split('\n').map((l) => l.trim());

    expect(lines).toContain('.env');
    expect(lines).toContain('.env.local');
  });

  it('should ensure ephemeral token endpoint structure does not leak server key', () => {
    const typesPath = path.resolve(__dirname, '../src/types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf-8');

    expect(typesContent).toContain('export interface LiveTokenResponse');
    expect(typesContent).not.toMatch(/apiKey:\s*string/);
  });
});
