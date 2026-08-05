import { describe, expect, it } from 'vitest';
import { canMoveFormation } from '../src/domain/formation.controller';

describe('alur tahap formasi', () => {
  it('mengizinkan tahap awal dan perpindahan satu tahap', () => {
    expect(canMoveFormation(undefined, 'ASPIRANT')).toBe(true);
    expect(canMoveFormation('POSTULANT', 'NOVICE')).toBe(true);
  });

  it('menolak lompatan tahap tanpa kewenangan', () => {
    expect(canMoveFormation('ASPIRANT', 'NOVICE')).toBe(false);
    expect(canMoveFormation('NOVICE', 'SENIOR')).toBe(false);
  });

  it('mengizinkan pengecualian yang diputuskan otoritas', () => {
    expect(canMoveFormation('ASPIRANT', 'NOVICE', true)).toBe(true);
  });
});
