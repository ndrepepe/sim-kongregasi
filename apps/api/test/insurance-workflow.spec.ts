import { describe, expect, it } from 'vitest';
import { canTransitionClaim } from '../src/domain/insurance.controller';

describe('alur klaim asuransi', () => {
  it('mengizinkan alur pelaporan yang sah', () => {
    expect(canTransitionClaim('DRAFT', 'REPORTED')).toBe(true);
    expect(canTransitionClaim('RECEIVED', 'CLARIFICATION')).toBe(true);
    expect(canTransitionClaim('ASSESSED', 'APPROVED')).toBe(true);
    expect(canTransitionClaim('PAID', 'RECONCILIATION')).toBe(true);
    expect(canTransitionClaim('RECONCILIATION', 'CLOSED')).toBe(true);
  });
  it('menolak lompatan tahap dan pembukaan kembali klaim tertutup', () => {
    expect(canTransitionClaim('DRAFT', 'PAID')).toBe(false);
    expect(canTransitionClaim('PAID', 'CLOSED')).toBe(false);
    expect(canTransitionClaim('CLOSED', 'DRAFT')).toBe(false);
  });
});
