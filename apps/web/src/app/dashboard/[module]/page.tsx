'use client';
import { use, useEffect, useState } from 'react';
import { api, dateId } from '@/lib/api';
import { Empty, PageHead, Status } from '@/components/ui';
type Dataset={columns:string[];rows:Record<string,unknown>[]};
const info:Record<string,[string,string,string]>={
  formasi:['Formasi','Formasi & Pendidikan','Tahapan pembinaan, studi, pendamping, dan hasil evaluasi anggota.'],
  karya:['Pelayanan','Unit Karya','Daftar lembaga dan unit pelayanan yang dikelola kongregasi.'],
  dokumen:['Arsip digital','Dokumen & Arsip','Berkas terklasifikasi dengan checksum, masa berlaku, dan hak akses.'],
  workflow:['Kendali proses','Persetujuan','Permohonan dan keputusan berjenjang dengan alasan serta jejak waktu.'],
  kalender:['Pengingat','Kalender Kongregasi','Hari penting, ulang tahun, akhir tugas, dan tenggat klaim.'],
  memorial:['Kenangan','Memorial','Riwayat saudari yang telah wafat dan jadwal peringatan.'],
  laporan:['Analitik','Laporan','Ikhtisar operasional untuk kebutuhan pimpinan dan rapat.'],
  audit:['Keamanan','Audit & Keamanan','Jejak perubahan penting untuk akuntabilitas dan investigasi.']
};
export default function ModulePage({params}:{params:Promise<{module:string}>}){const{module}=use(params);const[data,setData]=useState<Dataset|null>(null);const[error,setError]=useState('');const meta=info[module]??['Modul','Informasi','Modul tidak ditemukan.'];useEffect(()=>{api<Dataset>(`/modules/${module}`).then(setData).catch(e=>setError(e.message))},[module]);return <><PageHead eyebrow={meta[0]} title={meta[1]} description={meta[2]}/>{error&&<p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr>{data?.columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{data?.rows.map((row,i)=><tr key={String(row.id??i)}>{data.columns.map(c=><td key={c}>{render(row[c],c)}</td>)}</tr>)}</tbody></table>{data&&!data.rows.length&&<Empty text="Belum ada data pada modul ini."/>}</div></>}
function render(value:unknown,key:string){if(value===null||value===undefined||value==='')return'—';if(typeof value==='boolean')return <Status value={value?'ACTIVE':'NONACTIVE'}/>;if(/status|akses|jenis/.test(key))return <Status value={String(value)}/>;if(/tanggal|mulai|selesai|waktu|dibuat|tenggat|wafat|peringatan/.test(key))return dateId(String(value));return String(value)}
