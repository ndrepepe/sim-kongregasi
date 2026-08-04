'use client';
import { useEffect, useState } from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { api, dateId } from '@/lib/api';
import { Empty, PageHead } from '@/components/ui';
type Assignment={id:string;religious_name:string;title:string;location?:string;organization_name:string;start_date:string;end_date?:string};
export default function Assignments(){const[data,setData]=useState<Assignment[]>([]);const[error,setError]=useState('');useEffect(()=>{api<Assignment[]>('/assignments').then(setData).catch(e=>setError(e.message))},[]);return <><PageHead eyebrow="Perutusan" title="Penugasan" description="Riwayat perutusan, jabatan, lokasi pelayanan, dan masa tugas."/>{error&&<p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Anggota</th><th>Penugasan</th><th>Lokasi</th><th>Organisasi</th><th>Periode</th></tr></thead><tbody>{data.map(a=><tr key={a.id}><td><strong>{a.religious_name}</strong></td><td><BriefcaseBusiness size={14} style={{verticalAlign:'middle',marginRight:6}}/>{a.title}</td><td>{a.location||'—'}</td><td>{a.organization_name}</td><td>{dateId(a.start_date)} – {dateId(a.end_date)}</td></tr>)}</tbody></table>{!data.length&&<Empty/>}</div></>}
