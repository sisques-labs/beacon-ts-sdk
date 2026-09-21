import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'nestjs' ? [] : sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('core import isolation', () => {
  it('no source outside src/nestjs references @nestjs/*', () => {
    const offenders = sourceFiles('src').filter((file) => /@nestjs\//.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('importing the root entry does not load @nestjs/common', async () => {
    const loaded: string[] = [];
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('@nestjs/common', () => {
      loaded.push('@nestjs/common');
      return {};
    });
    await import('../src/index');
    vi.doUnmock('@nestjs/common');
    expect(loaded).toEqual([]);
  });
});
