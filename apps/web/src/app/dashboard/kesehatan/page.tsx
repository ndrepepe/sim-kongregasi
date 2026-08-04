'use client';
import { useEffect, useState } from 'react';
import { api, dateId } from '@/lib/api';
import { Empty, PageHead } from '@/components/ui';
type Visit={id:string;religious_name:string;visit_date:string;provider:string;complaint?:string;diagnosis?:string;follow_up_date?:string};
export default function Health(){const[data,setData]=useState<Visit[]>([]);const[error,setError]=useState('');useEffect(()=>{api<Visit[]>('/health/visits').then(setData).catch(e=>setError(e.message))},[]);return <><PageHead eyebrow="Kerahasiaan terjaga" title="Kesehatan" description="Riwayat kunjungan dan tindak lanjut hanya untuk petugas yang berwenang."/>{error&&<p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Anggota</th><th>Fasilitas</th><th>Keluhan</th><th>Diagnosis</th><th>Tindak lanjut</th></tr></thead><tbody>{data.map(v=><tr key={v.id}><td>{dateId(v.visit_date)}</td><td><strong>{v.religious_name}</strong></td><td>{v.provider}</td><td>{v.complaint||'—'}</td><td>{v.diagnosis||'—'}</td><td>{dateId(v.follow_up_date)}</td></tr>)}</tbody></table>{!data.length&&!error&&<Empty text="Belum ada kunjungan kesehatan tercatat."/>}</div></>}
