import { describe, expect, it } from 'vitest';
import { ROLE_DEFINITIONS, ROLE_NAMES } from '../src/domain/role-catalog';

describe('katalog role SI Kongregasi', () => {
  it('memuat semua role utama yang dipersyaratkan panduan', () => {
    expect(ROLE_NAMES).toEqual(expect.arrayContaining([
      'PIMPINAN','DEWAN','SUPERIOR_LOCAL','SEKRETARIS','BENDAHARA','MAGISTRA',
      'KESEHATAN','ARSIPARIS','SAFEGUARDING','AUDITOR','ADMIN_TI','SUSTER'
    ]));
  });

  it('memisahkan kewenangan teknis dari data sensitif', () => {
    expect(ROLE_DEFINITIONS.ADMIN_TI.permissions).toContain('identity.manage');
    expect(ROLE_DEFINITIONS.ADMIN_TI.permissions).not.toContain('health.manage');
    expect(ROLE_DEFINITIONS.ADMIN_TI.permissions).not.toContain('safeguarding.case');
  });

  it('memberi akses kesehatan hanya kepada petugas yang relevan', () => {
    expect(ROLE_DEFINITIONS.KESEHATAN.permissions).toContain('health.manage');
    expect(ROLE_DEFINITIONS.SUSTER.permissions).not.toContain('health.manage');
  });
});
