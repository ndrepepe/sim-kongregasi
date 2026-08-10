import { describe, expect, it } from 'vitest';
import { isPublishedMemory } from '../src/domain/memory.controller';
import { requiresReportExportApproval } from '../src/domain/reporting.controller';

describe('kontrol memori dan laporan',()=>{
  it('mengunci kronik setelah publikasi internal maupun publik',()=>{
    expect(isPublishedMemory('PUBLISHED_INTERNAL')).toBe(true);
    expect(isPublishedMemory('PUBLISHED_PUBLIC')).toBe(true);
    expect(isPublishedMemory('IN_REVIEW')).toBe(false);
  });
  it('mengirim ekspor data sensitif terstruktur ke persetujuan',()=>{
    expect(requiresReportExportApproval('FINANCE','XLSX')).toBe(true);
    expect(requiresReportExportApproval('CLAIMS','CSV')).toBe(true);
    expect(requiresReportExportApproval('DATA_QUALITY','PDF')).toBe(false);
    expect(requiresReportExportApproval('LEADERSHIP','XLSX')).toBe(false);
  });
});
