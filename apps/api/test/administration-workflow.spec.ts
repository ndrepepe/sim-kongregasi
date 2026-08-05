import { describe, expect, it } from 'vitest';
import { isBalancedJournal } from '../src/domain/finance.controller';
import { canTransitionWorkflow } from '../src/domain/workflow.controller';
import { jakartaCalendarDate } from '../src/domain/calendar.controller';

describe('kontrol administrasi',()=>{
  it('menerima jurnal debit-kredit yang seimbang',()=>{
    expect(isBalancedJournal([{debit:250000,credit:0},{debit:0,credit:250000}])).toBe(true);
  });
  it('menolak jurnal tidak seimbang atau baris dua sisi',()=>{
    expect(isBalancedJournal([{debit:250000,credit:0},{debit:0,credit:200000}])).toBe(false);
    expect(isBalancedJournal([{debit:250000,credit:250000},{debit:0,credit:0}])).toBe(false);
  });
  it('mengizinkan alur review dan keputusan yang sah',()=>{
    expect(canTransitionWorkflow('DRAFT','SUBMITTED')).toBe(true);
    expect(canTransitionWorkflow('SUBMITTED','IN_REVIEW')).toBe(true);
    expect(canTransitionWorkflow('IN_REVIEW','APPROVED')).toBe(true);
    expect(canTransitionWorkflow('APPROVED','COMPLETED')).toBe(true);
  });
  it('menolak lompatan dan membuka kembali proses selesai',()=>{
    expect(canTransitionWorkflow('DRAFT','APPROVED')).toBe(false);
    expect(canTransitionWorkflow('COMPLETED','DRAFT')).toBe(false);
  });
  it('menjaga tanggal agenda sepanjang hari dalam zona waktu Jakarta',()=>{
    expect(jakartaCalendarDate('2026-08-21T17:00:00.000Z')).toBe('2026-08-22');
  });
});
