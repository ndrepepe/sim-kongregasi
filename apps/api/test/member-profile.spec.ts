import { describe, expect, it } from 'vitest';
import { calculateCompleteness, maskIdentifier } from '../src/domain/member.controller';

describe('profil master anggota', () => {
  it('menghitung kelengkapan dari sepuluh kelompok data panduan', () => {
    expect(calculateCompleteness({
      member_number:'K-001', religious_name:'Sr. Maria', legal_name:'Maria', birth_date:'1980-01-01', nationality:'Indonesia',
      phone:'0812', family_count:1, sacrament_count:1, vow_count:1, education_count:1, skill_count:1, legal_count:1,
      status_dimension_count:4, verification_status:'VERIFIED'
    })).toBe(100);
    expect(calculateCompleteness({member_number:'K-001',religious_name:'Sr. Maria'})).toBe(0);
  });

  it('tidak membuka nomor identitas sensitif', () => {
    expect(maskIdentifier('7890')).toBe('•••• •••• 7890');
    expect(maskIdentifier(null)).toBe('Tersimpan terenkripsi');
  });
});
