import { describe, expect, it } from 'vitest';
import { rupiah } from './api';

describe('format Indonesia', () => {
  it('menampilkan nilai sebagai rupiah', () => {
    const formatted = rupiah(1250000);
    expect(formatted).toContain('Rp');
    expect(formatted.replace(/\D/g, '')).toContain('1250000');
  });
});
